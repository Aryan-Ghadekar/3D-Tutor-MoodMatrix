# Classroom endpoints

Feature doc: [classroom](../features/classroom.md) (state machine, aggregation rules, privacy).

All paths are under the FastAPI service. `{code}` is the 6-character class code; it is **case-insensitive**
(`abc234` and `ABC234` are the same class).

**Teacher authentication.** Endpoints marked *(teacher)* require the header

```
X-Teacher-Token: <teacherToken returned by POST /classroom>
```

Missing or wrong token → `403 {"detail": "Only the teacher can do that."}`.
Unknown code → `404 {"detail": "Class not found. Check the code and try again."}` on every endpoint.

---

## `POST /classroom`: start a class

| Field | Type | Description |
|---|---|---|
| `lecture_plan` | object | *required*. A [lecture plan](../reference/data-models.md#lecture-plan) with non-empty `impTopics` |
| `teacher_name` | string | default `"Teacher"`; trimmed to 60 characters |

**Response 200**

```json
{
  "code": "VVD2LW",
  "teacherToken": "f_kxv2yI2bfvtyZb0u6r_C27BmA1E3LX",
  "state": { "code": "VVD2LW", "topicIndex": 0, "paused": false, "pauseMode": null, "pauseId": 0, "ended": false, "teacherName": "Ms Rao" }
}
```

Codes use the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0 O 1 I`). Keep `teacherToken` private: it is
shown once and never again.

Errors: 400 `The lecture plan has no topics.`; 503 `Too many live classes right now.` (200 live classes).

---

## `POST /classroom/{code}/join`: student joins

| Field | Type | Description |
|---|---|---|
| `name` | string \| null | Display name; default `"Student"`, trimmed to 40 characters. Stored but never returned by any endpoint |

**Response 200**

```json
{ "studentId": "afbb0c06e84d", "plan": { "...the teacher's lecture plan..." }, "state": { "...class state..." } }
```

Errors: 410 `This class has ended.`

---

## `POST /classroom/{code}/heartbeat`: report load, get state

Students call this every ~3 seconds. It both **reports** the student's load and **returns** the current class
state, so one request drives the whole live experience.

| Field | Type | Description |
|---|---|---|
| `studentId` | string | *required*, from `join` |
| `load` | number | *required*, cognitive-load score; clamped to 0-100 |
| `level` | string | `low` / `medium` / `high` (default `medium`). Any other value is replaced by the level derived from `load` (≥65 high, ≤35 low) |
| `signals` | object | Free-form diagnostics (for example `{"behavior": 71}`); stored, never returned |

**Response 200**

```json
{
  "state": { "code": "VVD2LW", "topicIndex": 0, "paused": false, "pauseMode": null, "pauseId": 0, "ended": false, "teacherName": "Ms Rao" },
  "recentTranscript": "remember the load factor"
}
```

Errors: 404 `Unknown student. Rejoin the class.` (invalid student id). After a server restart the whole class
is gone, so the error is `Class not found...` instead.
A heartbeat still works after the class ended, so students receive `state.ended = true`.

---

## `GET /classroom/{code}/state`: public state

Same `state` + `recentTranscript` as a heartbeat, **without** reporting load or touching the student's
activity. Handy for a lobby screen.

---

## `GET /classroom/{code}/dashboard` *(teacher)*

```json
{
  "state": { "...": "..." },
  "aggregate": {
    "joined": 1, "active": 1, "averageLoad": 72.0,
    "levels": { "low": 0, "medium": 0, "high": 1 },
    "highRatio": 1.0, "overloaded": true
  },
  "history": [ { "t": 1792243672.43, "averageLoad": 72.0, "active": 1, "high": 1 } ],
  "events": [
    { "t": 1792243672.41, "kind": "class_started" },
    { "t": 1792243672.42, "kind": "student_joined" },
    { "t": 1792243672.43, "kind": "paused", "mode": "quiz", "topicIndex": 0, "pauseId": 1 }
  ],
  "quizResults": { "1": { "responses": 1, "averageScore": 80.0 } },
  "recentTranscript": "remember the load factor",
  "topics": ["Hash Tables", "Trees"],
  "lectureTopic": "Data Structures",
  "startedAt": 1792243672.41
}
```

| Field | Notes |
|---|---|
| `aggregate.active` | Students whose last heartbeat was within the last **20 s** |
| `aggregate.averageLoad` | Mean `load` of active students (1 decimal); `0` when nobody is active |
| `aggregate.overloaded` | `active > 0` **and** (`highRatio ≥ 0.4` **or** `averageLoad ≥ 70`) |
| `history` | Class average sampled at most every 5 s (last 120 samples returned, 720 kept). `t` is Unix seconds |
| `events[].kind` | `class_started`, `student_joined`, `topic_changed` (`topicIndex`), `paused` (`mode`, `topicIndex`, `pauseId`), `resumed`, `class_ended`. Last 100 returned |
| `quizResults` | Keyed by `pauseId` (as a string): number of responses and mean score |

Only **aggregates** are returned: there is no list of students, names or individual loads.

---

## `POST /classroom/{code}/control` *(teacher)*

| Field | Type | Description |
|---|---|---|
| `action` | string | `set_topic`, `pause` or `resume` |
| `topicIndex` | integer | required for `set_topic`; must be a valid topic index |
| `mode` | string | required for `pause`: `quiz` or `avatar` |

```json
{ "action": "pause", "mode": "quiz" }
```

**Response 200:** `{ "state": { ... } }` (the new state; `pauseId` increases by 1 on every pause).

Errors: 400 `Invalid topic index.`, 400 `Pause mode must be 'quiz' or 'avatar'.`, 400 `Unknown action.`,
410 if the class ended.

---

## `POST /classroom/{code}/transcript` *(teacher)*

Adds a piece of recognised lecture speech.

| Field | Type | Description |
|---|---|---|
| `text` | string | Trimmed; each segment is cut to 600 characters; blank text is ignored |

**Response 200:** `{ "recentTranscript": "..." }`: segments from the last 180 s joined, the last 1800 characters.

---

## `POST /classroom/{code}/result`: pause-quiz score

| Field | Type | Description |
|---|---|---|
| `studentId` | string | *required* |
| `score` | number | *required*; clamped to 0-100 |
| `pauseId` | integer | default: the current `pauseId` |
| `topicIndex` | integer | accepted; unused |

Reporting twice for the same pause by the same student overwrites the earlier score. Response `{"success": true}`.
Errors: 404 `Unknown student.`

---

## `POST /classroom/{code}/end` *(teacher)*

Ends the class (idempotent). Afterwards `join` and `control` return 410, and students see `ended: true`.
Response `{ "state": { ... } }`. The class stays in memory (so the teacher can still fetch the dashboard for a
final report) until its 12-hour lifetime elapses.
