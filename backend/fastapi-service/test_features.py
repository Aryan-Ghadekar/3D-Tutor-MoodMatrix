"""Tests for retrieval (RAG) and the live classroom. Run with: pytest backend/fastapi-service"""
import json
import os
import tempfile
import time

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ.pop("OPENROUTER_API_KEY", None)

import pytest
from fastapi.testclient import TestClient

import classroom
import main
from rag import VectorStore

client = TestClient(main.app)


# ----------------------------------------------------------------------------------------------
# RAG
# ----------------------------------------------------------------------------------------------
DOCS = [
    {"id": "d1", "text": "Hash tables map keys to buckets using a hash function. Collisions are resolved by chaining.", "kind": "lecture"},
    {"id": "d2", "text": "Binary search trees keep keys ordered, so lookup takes logarithmic time when balanced.", "kind": "lecture"},
    {"id": "d3", "text": "Dijkstra's algorithm greedily picks the closest unvisited vertex in a weighted graph.", "kind": "lecture"},
    {"id": "e1", "text": "Earlier we explained that chaining stores colliding keys in a linked list.", "kind": "explanation"},
]


@pytest.fixture
def store(tmp_path):
    s = VectorStore(tmp_path)
    s.add("lec", DOCS)
    return s


def test_query_ranks_the_relevant_passage_first(store):
    top = store.query("lec", "How are collisions handled in a hash table?", k=2)
    assert top[0]["id"] in ("d1", "e1")
    assert "d1" in [r["id"] for r in top]
    assert store.query("lec", "shortest path in a weighted graph", k=1)[0]["id"] == "d3"


def test_query_filters_by_kind_and_ignores_unrelated(store):
    only_explanations = store.query("lec", "chaining collisions", kinds=["explanation"])
    assert [r["id"] for r in only_explanations] == ["e1"]
    assert store.query("lec", "photosynthesis chlorophyll") == []
    assert store.query("missing-collection", "anything") == []


def test_add_replaces_by_id_and_persists(tmp_path):
    s = VectorStore(tmp_path)
    s.add("c", [{"id": "a", "text": "old text about trees"}])
    s.add("c", [{"id": "a", "text": "new text about graphs"}, {"id": "b", "text": ""}])
    assert s.count("c") == 1
    reloaded = VectorStore(tmp_path)
    assert reloaded.query("c", "graphs")[0]["text"] == "new text about graphs"


def test_dense_model_is_used_when_available_and_failures_fall_back(tmp_path):
    class FakeModel:
        def encode(self, texts):
            # 2-d "embedding": [mentions hash, mentions tree]
            return [[float("hash" in t.lower()), float("tree" in t.lower())] for t in texts]

    s = VectorStore(tmp_path, model_getter=lambda: FakeModel())
    s.add("c", DOCS[:2])
    assert s.query("c", "hash", k=1)[0]["id"] == "d1"

    class Broken:
        def encode(self, texts):
            raise RuntimeError("boom")

    s2 = VectorStore(tmp_path / "x", model_getter=lambda: Broken())
    s2.add("c", DOCS[:2])
    assert s2.query("c", "binary search trees", k=1)[0]["id"] == "d2"


def test_upload_indexes_all_chunks_and_rag_endpoint_finds_them(monkeypatch):
    monkeypatch.setattr(main, "llm_message", lambda *a, **k: (_ for _ in ()).throw(Exception("no llm")))
    monkeypatch.setattr(main, "get_semantic_model", lambda: None)
    text = (
        "Hash tables map keys to buckets with a hash function and resolve collisions by chaining. " * 40
        + "Graph traversal uses breadth first search with a queue and depth first search with a stack. " * 40
    )
    monkeypatch.setattr(main, "process_yt_link", lambda link: text)
    plan = client.post("/analyze-lecture", params={"yt_link": "https://youtu.be/dQw4w9WgXcQ"}).json()

    assert main.rag_store.count(plan["sessionId"], "lecture") > len(plan["impTopics"]) - 1
    res = client.post("/rag/query", json={"collection": plan["sessionId"], "query": "breadth first search queue"}).json()
    assert res["results"] and "breadth first" in res["results"][0]["text"]


SLIDE = {"title": "T", "narrative": "A narrative about chaining.", "keyInsights": ["chaining"], "analogies": [],
         "realWorldScenario": None, "interactiveElement": "?", "examRelevance": "x", "commonTraps": [], "memoryHook": "m"}


def plan_with_index(monkeypatch):
    monkeypatch.setattr(main, "get_semantic_model", lambda: None)
    plan = {"sessionId": "lec-rag", "impTopics": [{"id": "topic-1", "title": "Hash Tables", "description": "Hash tables."}]}
    main.rag_store.add("lec-rag", [
        {"id": "c1", "text": "Open addressing probes the next free slot when a collision happens in a hash table.", "kind": "lecture"}])
    return plan


def test_ask_question_is_grounded_in_retrieved_sources_and_remembered(monkeypatch):
    plan = plan_with_index(monkeypatch)
    prompts = []

    def fake_llm(payload, timeout=30):
        prompts.append(payload["messages"][-1]["content"])
        return json.dumps(SLIDE)

    monkeypatch.setattr(main, "llm_message", fake_llm)
    body = {"session_id": "s", "lecture_plan": plan, "current_topic_index": 0, "action_type": "ask-question",
            "user_question": "How does open addressing handle a collision?"}
    r = client.post("/generate-dynamic-slide", json=body).json()

    assert "SOURCE MATERIAL" in prompts[0] and "probes the next free slot" in prompts[0]
    assert r["slide"]["metadata"]["sources"][0]["id"] == "c1"
    assert main.rag_store.count("lec-rag", "explanation") == 1

    # the next question sees the earlier explanation
    prompts.clear()
    client.post("/generate-dynamic-slide", json={**body, "user_question": "Explain the chaining narrative again"})
    assert "EARLIER EXPLANATIONS" in prompts[0]


def test_simplified_explanation_action_uses_recent_teacher_audio(monkeypatch):
    plan = plan_with_index(monkeypatch)
    prompts = []
    monkeypatch.setattr(main, "llm_message", lambda payload, timeout=30: prompts.append(payload["messages"][-1]["content"]) or json.dumps(SLIDE))
    r = client.post("/generate-dynamic-slide", json={
        "session_id": "s", "lecture_plan": plan, "current_topic_index": 0,
        "action_type": "simplified-explanation", "context": "so the load factor is basically how full the table is"})
    assert r.status_code == 200
    assert "how full the table is" in prompts[0] and "short sentences" in prompts[0]


def test_topic_quiz_includes_recent_context(monkeypatch):
    prompts = []

    def fake(payload, timeout=30):
        prompts.append(payload["messages"][-1]["content"])
        q = {"question": "Q?", "type": "conceptual", "explanation": "e",
             "options": [{"text": "r", "isCorrect": True}] + [{"text": f"w{i}", "isCorrect": False} for i in range(3)]}
        return json.dumps({"questions": [q]})

    monkeypatch.setattr(main, "llm_message", fake)
    r = client.post("/generate-topic-quiz", json={"topic": {"title": "Hash Tables"}, "numberOfQuestions": 1,
                                                  "recentContext": "the teacher mentioned double hashing"})
    assert r.status_code == 200 and "double hashing" in prompts[0]


# ----------------------------------------------------------------------------------------------
# Classroom
# ----------------------------------------------------------------------------------------------
PLAN = {"topic": "Data Structures", "impTopics": [{"title": "Hash Tables"}, {"title": "Trees"}, {"title": "Graphs"}]}


@pytest.fixture
def live_class():
    classroom._classes.clear()
    created = client.post("/classroom", json={"lecture_plan": PLAN, "teacher_name": "Ms. Rao"}).json()
    return created["code"], {"X-Teacher-Token": created["teacherToken"]}


def join(code, name="S"):
    return client.post(f"/classroom/{code}/join", json={"name": name}).json()


def beat(code, sid, load, level=None):
    level = level or classroom.level_for(load)
    return client.post(f"/classroom/{code}/heartbeat", json={"studentId": sid, "load": load, "level": level})


def test_create_requires_topics_and_returns_code():
    assert client.post("/classroom", json={"lecture_plan": {"impTopics": []}}).status_code == 400
    created = client.post("/classroom", json={"lecture_plan": PLAN}).json()
    assert len(created["code"]) == 6 and created["teacherToken"]


def test_student_joins_with_code_and_receives_the_plan(live_class):
    code, _ = live_class
    joined = join(code.lower())          # codes are case-insensitive
    assert joined["plan"]["topic"] == "Data Structures" and joined["studentId"]
    assert client.post("/classroom/NOPE12/join", json={}).status_code == 404


def test_dashboard_requires_the_teacher_token(live_class):
    code, headers = live_class
    assert client.get(f"/classroom/{code}/dashboard").status_code == 403
    assert client.get(f"/classroom/{code}/dashboard", headers={"X-Teacher-Token": "wrong"}).status_code == 403
    assert client.get(f"/classroom/{code}/dashboard", headers=headers).status_code == 200


def test_aggregate_flags_overload_when_many_students_are_struggling(live_class):
    code, headers = live_class
    ids = [join(code)["studentId"] for _ in range(4)]
    for sid, load in zip(ids, [20, 25, 30, 30]):
        beat(code, sid, load)
    agg = client.get(f"/classroom/{code}/dashboard", headers=headers).json()["aggregate"]
    assert agg["active"] == 4 and not agg["overloaded"] and agg["levels"]["low"] == 4

    for sid in ids[:3]:
        beat(code, sid, 90)
    agg = client.get(f"/classroom/{code}/dashboard", headers=headers).json()["aggregate"]
    assert agg["levels"]["high"] == 3 and agg["overloaded"]


def test_inactive_students_are_left_out_of_the_aggregate(live_class):
    code, headers = live_class
    sid = join(code)["studentId"]
    beat(code, sid, 95)
    classroom._classes[code]["students"][sid]["lastSeen"] -= 120
    agg = client.get(f"/classroom/{code}/dashboard", headers=headers).json()["aggregate"]
    assert agg["joined"] == 1 and agg["active"] == 0 and not agg["overloaded"]


def test_pause_quiz_reaches_students_and_results_are_collected(live_class):
    code, headers = live_class
    sid = join(code)["studentId"]
    assert client.post(f"/classroom/{code}/control", json={"action": "pause", "mode": "quiz"}).status_code == 403

    r = client.post(f"/classroom/{code}/control", headers=headers, json={"action": "set_topic", "topicIndex": 2})
    assert r.json()["state"]["topicIndex"] == 2
    r = client.post(f"/classroom/{code}/control", headers=headers, json={"action": "pause", "mode": "quiz"}).json()["state"]
    assert r["paused"] and r["pauseMode"] == "quiz" and r["pauseId"] == 1

    state = beat(code, sid, 50).json()["state"]
    assert state["paused"] and state["topicIndex"] == 2

    client.post(f"/classroom/{code}/result", json={"studentId": sid, "score": 80, "pauseId": 1})
    dash = client.get(f"/classroom/{code}/dashboard", headers=headers).json()
    assert dash["quizResults"]["1"] == {"responses": 1, "averageScore": 80.0}

    resumed = client.post(f"/classroom/{code}/control", headers=headers, json={"action": "resume"}).json()["state"]
    assert not resumed["paused"]
    kinds = [e["kind"] for e in dash["events"]]
    assert "paused" in kinds and "topic_changed" in kinds


def test_control_validation(live_class):
    code, headers = live_class
    assert client.post(f"/classroom/{code}/control", headers=headers, json={"action": "set_topic", "topicIndex": 9}).status_code == 400
    assert client.post(f"/classroom/{code}/control", headers=headers, json={"action": "pause", "mode": "dance"}).status_code == 400
    assert client.post(f"/classroom/{code}/control", headers=headers, json={"action": "explode"}).status_code == 400


def test_transcript_window_keeps_only_recent_audio(live_class):
    code, headers = live_class
    client.post(f"/classroom/{code}/transcript", headers=headers, json={"text": "old remark"})
    classroom._classes[code]["transcript"][0]["t"] -= 600
    client.post(f"/classroom/{code}/transcript", headers=headers, json={"text": "we now cover chaining"})
    assert client.post(f"/classroom/{code}/transcript", json={"text": "x"}).status_code == 403
    state = client.get(f"/classroom/{code}/state").json()
    assert state["recentTranscript"] == "we now cover chaining"


def test_ending_a_class_blocks_new_students(live_class):
    code, headers = live_class
    client.post(f"/classroom/{code}/end", headers=headers)
    assert client.post(f"/classroom/{code}/join", json={}).status_code == 410
    assert client.post(f"/classroom/{code}/control", headers=headers, json={"action": "resume"}).status_code == 410


def test_unknown_student_heartbeat_is_rejected(live_class):
    code, _ = live_class
    assert beat(code, "ghost", 40).status_code == 404


def test_history_is_sampled_not_per_heartbeat(live_class):
    code, headers = live_class
    sid = join(code)["studentId"]
    for _ in range(5):
        beat(code, sid, 40)
    assert len(client.get(f"/classroom/{code}/dashboard", headers=headers).json()["history"]) == 1
    time.sleep(0)  # history step is 5 s; a second sample needs real time, covered by the e2e run
