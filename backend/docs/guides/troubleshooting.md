# Troubleshooting

Find the symptom, read the cause, apply the fix. Messages in `code font` appear in the `detail` field of the
response or in the service's console.

## Startup

| Symptom | Cause | Fix |
|---|---|---|
| `WARNING: OPENROUTER_API_KEY not found in environment!` | No key | Create `backend/fastapi-service/.env` with `OPENROUTER_API_KEY=...`. The service runs without it but AI features use fallbacks |
| `python main.py` starts and the browser cannot connect | Wrong port or host | `python main.py` binds `127.0.0.1:8001`. The frontend expects `http://localhost:8001`. Use `uvicorn main:app --host 0.0.0.0 --port 8001` for other hosts |
| Uvicorn started on port 8000 | `uvicorn main:app` without `--port` | add `--port 8001` or use `python main.py` |
| `ModuleNotFoundError: pdfplumber / pptx / dotenv` | Dependencies not installed | `pip install -r requirements.txt` in the service folder |
| Browser console: CORS error | The page origin is not allowed | Add it to `CORS_ORIGINS` (comma-separated) and restart |
| Every request returns `401 Missing or invalid API key.` | `API_TOKEN` is set on the service but the caller does not send it | Set the same value as `BACKEND_API_TOKEN` in `frontend/.env.local`, or unset `API_TOKEN` for local development |
| Web app: `SESSION_SECRET is not set` when signing in under `npm start` | Production mode needs a signing secret | Set `SESSION_SECRET` to a long random string in `frontend/.env.local` |
| Port already in use | Another process on 8001 / 5000 | Stop it, or set `PORT` |

## Lecture analysis

| Symptom / message | Cause | Fix |
|---|---|---|
| `Provide at least one of: pdf, ppt, audio or yt_link.` (400) | Request had no file or link | Send a `pdf`, `ppt`, `audio` form part or `?yt_link=` |
| `Could not read the PDF file: ...` (422) | Corrupt or password-protected PDF | Re-export the PDF without a password |
| `Could not read the PowerPoint file (only .pptx is supported)` (422) | `.ppt` or corrupt file | Save as `.pptx` |
| `No readable text could be extracted from the input.` (422) | Scanned/image-only PDF, empty slides | OCR the PDF first, or use another input |
| `Could not find a video id in the YouTube link.` (422) | Link without an 11-character id | Use a standard `watch?v=`/`youtu.be/` link |
| `Could not transcribe the YouTube video: ...` (422) | No captions **and** audio download/transcription failed | Install `ffmpeg`, `yt-dlp`, `openai-whisper`; check the video is public; try again |
| `openai-whisper is not installed; ...` (501) | Audio / caption-less video without Whisper | `pip install openai-whisper` and install ffmpeg |
| `This video has no captions and yt-dlp is not installed.` (501) | | `pip install yt-dlp` |
| Audio upload returns 500 and the console mentions ffmpeg | ffmpeg not on `PATH` | Install ffmpeg and restart the shell |
| `413 ... larger than the 50 MB limit` | File above `MAX_UPLOAD_MB` | Compress the file or raise `MAX_UPLOAD_MB` (and any proxy limit) |
| Upload takes minutes | Many topics × LLM latency, or a long transcription | Normal. Use a smaller `WHISPER_MODEL`; raise `LLM_CONCURRENCY` if your provider allows it; the proxy waits up to 10 minutes |
| Topic titles are the first words of the text and insight lists are empty | No / invalid API key, LLM errors | Check `GET /` → `ai_configured`, the key, credits, and the console lines starting `Title generation failed` / `Structured content generation failed` |
| `OpenRouter API returned 401 Unauthorized` (console) | Invalid key | Replace the key |
| `OpenRouter API request timed out after 30s` | Slow model or network | Retry; choose a faster `OPENROUTER_MODEL` |

## Slides and quizzes

| Symptom / message | Cause | Fix |
|---|---|---|
| `POST /generate-dynamic-slide` → 502 `Slide generation error: ...` | No key, provider error, or the reply was not valid JSON (often truncated at 2000 tokens) | Read the message; raise `max_tokens` in `generate_slide_with_ai` for verbose models |
| 502 `AI model unavailable: 402/404 ...` | Out of credit / model name wrong | Fix `OPENROUTER_MODEL` or add credit |
| 400 `Invalid topic index: N` | Index outside `impTopics` | Send a valid index (0-based) |
| `POST /generate-topic-quiz` → 503 | No AI, or the reply had no valid questions | Expected without AI; the caller falls back. With AI, check the console line `LLM quiz generation failed` |
| Quiz returned fewer questions than requested | Some LLM questions failed validation (not 4 options, not exactly one correct) | Retry; use a model that follows the JSON format |
| Slide has no `images` | No relevant Commons result for the topic title, or Wikimedia was unreachable | Failed lookups are not cached, so images return when the network does. "Nothing relevant" is remembered for an hour ([images §3](../features/images.md#3-caching-and-its-trade-off)) |
| `metadata.sources` is always empty | The lecture was analysed before retrieval existed, the collection was deleted, or the question shares no words with the lecture (TF-IDF mode) | Re-upload the lecture; install `sentence-transformers` for semantic matching |

## Retrieval

| Symptom | Cause | Fix |
|---|---|---|
| `/rag/query` returns `{"results": []}` | Wrong `collection` (must be the lecture's `sessionId`), empty query, or nothing above the 0.05 threshold | Use `plan.sessionId`; ask with words from the lecture |
| First dense query is slow | Embedding model loading/downloading on first use | Wait; later queries are fast |
| Duplicated near-identical results | The lecture text itself repeats (typical of test data) | Expected |

## Live classroom

| Symptom / message | Cause | Fix |
|---|---|---|
| `Class not found. Check the code and try again.` (404) | Wrong code, or the server restarted (classes are in memory), or the class expired (12 h) | Check the code; the teacher starts a new class |
| `Only the teacher can do that.` (403) | Missing/wrong `X-Teacher-Token` | Use the token from `POST /classroom`; it is only returned once |
| `This class has ended.` (410) | `join`/`control` after `end` | Start a new class |
| `Unknown student. Rejoin the class.` (404) | The student id is not in this class | Join again |
| Teacher sees 0 active students although some joined | No heartbeat in the last 20 s (tab in background throttles timers) | Keep the student tab visible; check the network |
| Dashboard never shows "overloaded" | Needs ≥40 % of active students in `high` or an average ≥ 70 | See [classroom §4](../features/classroom.md#4-cognitive-load-aggregation) |
| `Too many live classes right now.` (503) | 200 live classes | End unused classes or restart |

## Data & storage

| Symptom | Cause | Fix |
|---|---|---|
| Old lecture plan gone (`Lecture plan not found for that id`) | Only the 10 newest plans are kept | Re-upload; raise `keep=10` in `save_lecture_plan` |
| `Failed to save results: ...` (500) | `DATA_DIR` not writable | Fix permissions / set `DATA_DIR` |
| All stored plans/results vanished after one bad write | A corrupt JSON file is treated as empty and overwritten | Restore from backup; avoid editing files while the service runs |
| Changes to `.env` ignored | `.env` is read at startup | Restart the service |

## Express API

| Symptom | Cause | Fix |
|---|---|---|
| `Database connection failed` in the log | `DB_NAME` is set but MySQL is unreachable / credentials wrong | Fix `DB_*`, or unset `DB_NAME` to use memory mode |
| Data disappears after restart | Memory mode | Set `DB_NAME` and the MySQL variables |
| `400 loadValue must be a number between 0 and 100` | Non-numeric or out-of-range `loadValue` | Send a number |
| `400 answers must be a non-empty array` | `/api/quiz/submit` body | Send `answers: [{questionId, selectedOption}]` |

## Collecting information for a bug report

1. `curl localhost:8001/` (version, `ai_configured`).
2. The service console output around the failure.
3. The exact request and the response `detail`.
4. `pip list | grep -i -E "fastapi|whisper|sentence|pdfplumber|pptx|yt-dlp"` and the Python version.
