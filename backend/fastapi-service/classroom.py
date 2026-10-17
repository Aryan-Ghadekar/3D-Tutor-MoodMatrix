"""Live classroom: a teacher publishes a lecture, students join with a code and report their cognitive load,
and the teacher sees the aggregate and can pause the class for a quiz or an avatar explanation.

State is in memory (a class is a live event, not long-term data). Only anonymous aggregate numbers are
shared with the teacher; no camera data ever reaches the server.
"""
import secrets
import threading
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I
ACTIVE_WINDOW_S = 20
HISTORY_STEP_S = 5
HISTORY_LIMIT = 720          # one hour at 5 s resolution
TRANSCRIPT_WINDOW_S = 180    # "last 2-3 minutes of lecture audio"
OVERLOAD_RATIO = 0.4         # share of active students in high load that counts as class overload
CLASS_TTL_S = 12 * 3600
MAX_CLASSES = 200

router = APIRouter(prefix="/classroom", tags=["classroom"])
_lock = threading.RLock()
_classes: dict = {}


class CreateRequest(BaseModel):
    lecture_plan: dict
    teacher_name: str = "Teacher"


class JoinRequest(BaseModel):
    name: Optional[str] = None


class HeartbeatRequest(BaseModel):
    studentId: str
    load: float            # 0-100
    level: str = "medium"  # low | medium | high
    signals: dict = {}


class ControlRequest(BaseModel):
    action: str            # set_topic | pause | resume
    topicIndex: Optional[int] = None
    mode: Optional[str] = None  # quiz | avatar (for pause)


class TranscriptRequest(BaseModel):
    text: str


class ResultRequest(BaseModel):
    studentId: str
    score: float
    pauseId: Optional[int] = None
    topicIndex: Optional[int] = None


def level_for(score: float) -> str:
    return "high" if score >= 65 else "low" if score <= 35 else "medium"


def _get(code: str) -> dict:
    cls = _classes.get(code.upper())
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found. Check the code and try again.")
    return cls


def _require_teacher(cls: dict, token: Optional[str]):
    if not token or not secrets.compare_digest(token, cls["teacherToken"]):
        raise HTTPException(status_code=403, detail="Only the teacher can do that.")


def _public_state(cls: dict) -> dict:
    return {
        "code": cls["code"],
        "topicIndex": cls["topicIndex"],
        "paused": cls["paused"],
        "pauseMode": cls["pauseMode"],
        "pauseId": cls["pauseId"],
        "ended": cls["ended"],
        "teacherName": cls["teacherName"],
    }


def _recent_transcript(cls: dict) -> str:
    cutoff = time.time() - TRANSCRIPT_WINDOW_S
    text = " ".join(seg["text"] for seg in cls["transcript"] if seg["t"] >= cutoff)
    return text[-1800:]


def _aggregate(cls: dict) -> dict:
    now = time.time()
    active = [s for s in cls["students"].values() if now - s["lastSeen"] <= ACTIVE_WINDOW_S]
    n = len(active)
    counts = {"low": 0, "medium": 0, "high": 0}
    for s in active:
        counts[s["level"] if s["level"] in counts else "medium"] += 1
    avg = round(sum(s["load"] for s in active) / n, 1) if n else 0.0
    ratio = counts["high"] / n if n else 0.0
    return {
        "joined": len(cls["students"]),
        "active": n,
        "averageLoad": avg,
        "levels": counts,
        "highRatio": round(ratio, 2),
        "overloaded": n > 0 and (ratio >= OVERLOAD_RATIO or avg >= 70),
    }


def _log(cls: dict, kind: str, **data):
    cls["events"].append({"t": time.time(), "kind": kind, **data})


def _purge():
    now = time.time()
    for code in [c for c, v in _classes.items() if now - v["createdAt"] > CLASS_TTL_S]:
        del _classes[code]


@router.post("")
def create_class(req: CreateRequest):
    """Start a live class from a lecture plan. Returns the join code and the teacher token (keep the token secret: it authorises dashboard and control calls)."""
    if not req.lecture_plan.get("impTopics"):
        raise HTTPException(status_code=400, detail="The lecture plan has no topics.")
    with _lock:
        _purge()
        if len(_classes) >= MAX_CLASSES:
            raise HTTPException(status_code=503, detail="Too many live classes right now.")
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        while code in _classes:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        cls = {
            "code": code,
            "teacherToken": secrets.token_urlsafe(24),
            "teacherName": req.teacher_name.strip()[:60] or "Teacher",
            "plan": req.lecture_plan,
            "createdAt": time.time(),
            "topicIndex": 0,
            "paused": False,
            "pauseMode": None,
            "pauseId": 0,
            "ended": False,
            "students": {},
            "history": [],
            "events": [],
            "transcript": [],
            "results": {},   # pauseId -> {studentId: score}
        }
        _classes[code] = cls
        _log(cls, "class_started")
        return {"code": code, "teacherToken": cls["teacherToken"], "state": _public_state(cls)}


@router.post("/{code}/join")
def join_class(code: str, req: JoinRequest):
    """Join a class by code. Returns a student id and the lecture plan the class is studying. Fails with 410 once the class has ended."""
    with _lock:
        cls = _get(code)
        if cls["ended"]:
            raise HTTPException(status_code=410, detail="This class has ended.")
        student_id = uuid.uuid4().hex[:12]
        cls["students"][student_id] = {
            "name": (req.name or "Student")[:40], "load": 0.0, "level": "medium", "lastSeen": time.time(), "signals": {}
        }
        _log(cls, "student_joined")
        return {"studentId": student_id, "plan": cls["plan"], "state": _public_state(cls)}


@router.post("/{code}/heartbeat")
def heartbeat(code: str, req: HeartbeatRequest):
    """Report a student's cognitive-load score (0-100) and level. Returns the class state (current topic, pause status) and the teacher's last few minutes of speech. Students call this every few seconds."""
    with _lock:
        cls = _get(code)
        student = cls["students"].get(req.studentId)
        if not student:
            raise HTTPException(status_code=404, detail="Unknown student. Rejoin the class.")
        score = max(0.0, min(100.0, req.load))
        student.update(load=score, level=req.level if req.level in ("low", "medium", "high") else level_for(score),
                       lastSeen=time.time(), signals=req.signals if isinstance(req.signals, dict) else {})

        now = time.time()
        if not cls["history"] or now - cls["history"][-1]["t"] >= HISTORY_STEP_S:
            agg = _aggregate(cls)
            cls["history"].append({"t": now, "averageLoad": agg["averageLoad"], "active": agg["active"], "high": agg["levels"]["high"]})
            del cls["history"][:-HISTORY_LIMIT]

        return {"state": _public_state(cls), "recentTranscript": _recent_transcript(cls)}


@router.get("/{code}/state")
def class_state(code: str):
    """Public class state and recent lecture transcript, without reporting any load."""
    with _lock:
        cls = _get(code)
        return {"state": _public_state(cls), "recentTranscript": _recent_transcript(cls)}


@router.get("/{code}/dashboard")
def dashboard(code: str, x_teacher_token: Optional[str] = Header(None)):
    """Teacher view: class-wide aggregate load, history, event log, pause-quiz results and recent transcript. Requires the X-Teacher-Token header. Never exposes individual students."""
    with _lock:
        cls = _get(code)
        _require_teacher(cls, x_teacher_token)
        results = {
            pid: {"responses": len(scores), "averageScore": round(sum(scores.values()) / len(scores), 1)}
            for pid, scores in cls["results"].items() if scores
        }
        return {
            "state": _public_state(cls),
            "aggregate": _aggregate(cls),
            "history": cls["history"][-120:],
            "events": cls["events"][-100:],
            "quizResults": results,
            "recentTranscript": _recent_transcript(cls),
            "topics": [t.get("title", f"Topic {i + 1}") for i, t in enumerate(cls["plan"].get("impTopics", []))],
            "lectureTopic": cls["plan"].get("topic", ""),
            "startedAt": cls["createdAt"],
        }


@router.post("/{code}/control")
def control(code: str, req: ControlRequest, x_teacher_token: Optional[str] = Header(None)):
    """Teacher controls: set_topic, pause (mode quiz or avatar) and resume. Requires the X-Teacher-Token header."""
    with _lock:
        cls = _get(code)
        _require_teacher(cls, x_teacher_token)
        if cls["ended"]:
            raise HTTPException(status_code=410, detail="This class has ended.")

        topics = cls["plan"].get("impTopics", [])
        if req.action == "set_topic":
            if req.topicIndex is None or not 0 <= req.topicIndex < len(topics):
                raise HTTPException(status_code=400, detail="Invalid topic index.")
            cls["topicIndex"] = req.topicIndex
            _log(cls, "topic_changed", topicIndex=req.topicIndex)
        elif req.action == "pause":
            if req.mode not in ("quiz", "avatar"):
                raise HTTPException(status_code=400, detail="Pause mode must be 'quiz' or 'avatar'.")
            cls["paused"] = True
            cls["pauseMode"] = req.mode
            cls["pauseId"] += 1
            cls["results"][cls["pauseId"]] = {}
            _log(cls, "paused", mode=req.mode, topicIndex=cls["topicIndex"], pauseId=cls["pauseId"])
        elif req.action == "resume":
            cls["paused"] = False
            cls["pauseMode"] = None
            _log(cls, "resumed")
        else:
            raise HTTPException(status_code=400, detail="Unknown action.")
        return {"state": _public_state(cls)}


@router.post("/{code}/transcript")
def add_transcript(code: str, req: TranscriptRequest, x_teacher_token: Optional[str] = Header(None)):
    """Append recognised lecture speech to the class transcript (only the last few minutes are kept). Requires the X-Teacher-Token header."""
    with _lock:
        cls = _get(code)
        _require_teacher(cls, x_teacher_token)
        text = req.text.strip()
        if text:
            cls["transcript"].append({"t": time.time(), "text": text[:600]})
            cls["transcript"] = cls["transcript"][-200:]
        return {"recentTranscript": _recent_transcript(cls)}


@router.post("/{code}/result")
def report_result(code: str, req: ResultRequest):
    """A student reports their score (0-100) for a pause quiz. Re-reporting for the same pause overwrites the earlier score."""
    with _lock:
        cls = _get(code)
        if req.studentId not in cls["students"]:
            raise HTTPException(status_code=404, detail="Unknown student.")
        pause_id = req.pauseId if req.pauseId is not None else cls["pauseId"]
        cls["results"].setdefault(pause_id, {})[req.studentId] = max(0.0, min(100.0, req.score))
        return {"success": True}


@router.post("/{code}/end")
def end_class(code: str, x_teacher_token: Optional[str] = Header(None)):
    """End the class: students can no longer join and are told it ended. Requires the X-Teacher-Token header."""
    with _lock:
        cls = _get(code)
        _require_teacher(cls, x_teacher_token)
        cls["ended"] = True
        cls["paused"] = False
        cls["pauseMode"] = None
        _log(cls, "class_ended")
        return {"state": _public_state(cls)}
