# API Reference

Base URL (FastAPI): `http://localhost:8001`. Interactive explorer: `/docs`. Machine-readable schema:
[../openapi.json](../openapi.json).

## Endpoint index

### FastAPI service (port 8001)

| Method | Path | Purpose | Doc |
|---|---|---|---|
| GET | `/` | Service banner, version, `ai_configured`, endpoint list | [system](system.md) |
| GET | `/health` | Liveness probe | [system](system.md) |
| POST | `/analyze-lecture` | Upload material → lecture plan | [lecture-analysis](lecture-analysis.md) |
| GET | `/get-lecture-plan` | Fetch a saved plan by session / lecture id or the latest | [lecture-analysis](lecture-analysis.md) |
| POST | `/generate-dynamic-slide` | Generate one teaching slide | [slides](slides.md) |
| POST | `/generate-diagnostic-mcq` | Knowledge-test questions from a plan | [quizzes](quizzes.md) |
| POST | `/generate-topic-quiz` | Adaptive quiz for one topic | [quizzes](quizzes.md) |
| POST | `/analyze-quiz-results` | Score answers, find weak topics | [quiz-results](quiz-results.md) |
| POST | `/save-quiz-results` | Persist a finished quiz | [quiz-results](quiz-results.md) |
| POST | `/rag/query` | Retrieve lecture passages for a question | [retrieval](retrieval.md) |
| POST | `/classroom` | Start a live class | [classroom](classroom.md) |
| POST | `/classroom/{code}/join` | Student joins | [classroom](classroom.md) |
| POST | `/classroom/{code}/heartbeat` | Student reports load, receives class state | [classroom](classroom.md) |
| GET | `/classroom/{code}/state` | Public class state | [classroom](classroom.md) |
| GET | `/classroom/{code}/dashboard` | Teacher aggregate view *(teacher token)* | [classroom](classroom.md) |
| POST | `/classroom/{code}/control` | Set topic / pause / resume *(teacher token)* | [classroom](classroom.md) |
| POST | `/classroom/{code}/transcript` | Add lecture speech *(teacher token)* | [classroom](classroom.md) |
| POST | `/classroom/{code}/result` | Student reports a pause-quiz score | [classroom](classroom.md) |
| POST | `/classroom/{code}/end` | End the class *(teacher token)* | [classroom](classroom.md) |

### Express service (port 5000, optional)

See [express](express.md): `GET /health`, `GET /api/health`, `/api/quiz/*`, `/api/cognitive/*`, `/api/help/*`.

## Conventions (FastAPI)

**Content types.** JSON bodies use `application/json`; `/analyze-lecture` uses `multipart/form-data`.

**Success.** HTTP 200 with a JSON object. Slide and quiz endpoints include `"success": true`.

**Errors.** Errors use FastAPI's standard shape:

```json
{ "detail": "Human-readable message" }
```

| Status | Meaning in this service |
|---|---|
| 400 | Missing or invalid input the service checked itself (no files, bad topic index, bad control action) |
| 403 | Missing / wrong `X-Teacher-Token` |
| 404 | Unknown class code, student, or lecture plan |
| 410 | Class has ended (join, control) |
| 422 | Either FastAPI **request validation** (then `detail` is an *array* of `{loc, msg, type}` objects) or **unreadable input** raised by the service (corrupt PDF/PPTX, no text, bad YouTube link, transcription failed; then `detail` is a *string*). Clients should handle both |
| 501 | An optional component is not installed (Whisper, yt-dlp) |
| 502 | The LLM call for a slide failed or returned unusable output |
| 503 | `generate-topic-quiz` could not get AI questions; or too many live classes |
| 500 | Unexpected server error, or the data directory could not be written |

**Timeouts.** Only `/analyze-lecture` can run for minutes (transcription plus about `5N+3` LLM calls). Use a
client timeout of several minutes (the Next.js proxy waits up to 10). Every other endpoint is bounded by the
LLM timeouts (30-45 s).

**Idempotency.** `analyze-lecture` creates a new plan (new ids) every call. `save-quiz-results` appends every
call. Classroom `join` creates a new student every call. `control`, `end` and `result` are safe to repeat.

**Authentication.** Only the three teacher endpoints and the dashboard check a token; everything else is open.
See [architecture §6](../architecture.md#6-security-model).

**CORS.** Browser calls are allowed from `CORS_ORIGINS` with any method and header (including
`X-Teacher-Token`).

## Common request fragments

### Student knowledge state (slides)

Optional object sent with slide requests; all fields optional:

```json
{
  "knowledgeLevel": "beginner | intermediate | advanced",
  "averageScore": 62,
  "weakTopics": ["Hash Tables"],
  "misconceptions": [{ "concept": "Chaining", "type": "knowledge_gap", "description": "..." }]
}
```

### Goals

`student_goal` / `studentGoal` is free text, upper-cased into the prompts. The UI uses
`gate`, `jee`, `neet`, `semester`, `concept`.
