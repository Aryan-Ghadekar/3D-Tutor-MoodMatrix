# Configuration & Operations

## 1. FastAPI service

### 1.1 Environment variables

Loaded from the process environment and from `backend/fastapi-service/.env` (via `python-dotenv`; real
environment variables win over the file). Copy `.env.example` to `.env` to start.

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | *(unset)* | Key for the LLM. Without it the service still runs but uses non-AI fallbacks (see [ai-generation](features/ai-generation.md)). `GET /` reports `ai_configured` |
| `OPENROUTER_MODEL` | `openai/gpt-3.5-turbo` | Model id sent to OpenRouter for every LLM call |
| `OPENROUTER_URL` | `https://openrouter.ai/api/v1/chat/completions` | Chat-completions endpoint. Any OpenAI-compatible server works (local gateway, a mock for tests) |
| `WHISPER_MODEL` | `base` | Whisper model size: `tiny`, `base`, `small`, `medium`, `large`. Larger = more accurate and slower; loaded lazily on first use |
| `PORT` | `8001` | Port used by `python main.py` (not by `uvicorn main:app`, which uses `--port`) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000` | Comma-separated list of browser origins allowed to call the service |
| `DATA_DIR` | `backend/fastapi-service/data` | Where plans, quiz results and the vector index are stored. Read once at import time |

### 1.2 Running

| Command | Notes |
|---|---|
| `python main.py` | Binds **127.0.0.1** on `PORT`. Fine for local development |
| `uvicorn main:app --port 8001 --reload` | Development with auto-reload |
| `uvicorn main:app --host 0.0.0.0 --port 8001` | Reachable from other machines. Put authentication / TLS in front of it |

The frontend expects the service at `http://localhost:8001` (`BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` in
`frontend/.env.local`). **Use one worker process**; see [architecture §4](architecture.md#4-concurrency-model).

Startup prints whether the API key was found. The Whisper and embedding models are **not** loaded at startup;
they load on first use (a few seconds, plus a one-time download).

### 1.3 Dependencies by feature

`requirements.txt` pins everything. What each feature actually needs:

| Feature | Needs | If missing |
|---|---|---|
| API server | `fastapi`, `uvicorn`, `python-multipart`, `pydantic`, `python-dotenv`, `requests` | cannot start |
| PDF text | `pdfplumber` | `ModuleNotFoundError` at import |
| PPTX text | `python-pptx` | `ModuleNotFoundError` at import |
| Audio transcription | `openai-whisper` + system **ffmpeg** | 501 on audio / caption-less YouTube |
| YouTube captions | `youtube-transcript-api` (1.x and 0.x APIs both supported) | falls through to audio download |
| YouTube audio fallback | `yt-dlp` + ffmpeg + Whisper | 501 / 422 |
| Semantic importance scoring and dense retrieval | `sentence-transformers` (model `all-MiniLM-L6-v2`, ~90 MB download on first use) | constant semantic score / TF-IDF retrieval |
| Tests | `pytest`, `httpx` | |

> Python 3.10-3.11 has wheels for the whole stack. On newer interpreters some ML wheels (torch, whisper)
> may be unavailable; the non-ML features still work without them.

### 1.4 Files created at runtime

All under `DATA_DIR` (git-ignored). See [features/storage.md](features/storage.md).

```
data/
├─ lecture_plans.json      newest first, last 10 plans
├─ quiz_results.json       newest first, last 50 results
└─ rag/<sessionId>.json    one retrieval collection per lecture
```

### 1.5 Operational limits (constants in code)

| Limit | Value | Constant / location |
|---|---|---|
| Words per chunk | 150 | `chunk_text(max_tokens=150)` |
| Max topics per lecture | 20 | `calculate_topic_count`, `build_lecture_plan` |
| LLM timeout (default / MCQ / slide / topic quiz) | 30 s / 30 s / 45 s / 45 s | `make_openrouter_request`, call sites |
| Diagnostic MCQs per request | 1-30 | `generate_diagnostic_mcq` |
| Topic-quiz questions per request | 1-10 | `generate_topic_quiz_with_llm` |
| Retrieval results per query | 1-10 (`/rag/query`); 4 sources + 2 earlier explanations (slides) | `rag_query`, `retrieve_reference` |
| Wikimedia lookup timeout | 8 s | `search_commons_image` |
| Image-search cache | 256 entries | `@lru_cache(maxsize=256)` |
| Live classes | 200 concurrently, 12 h lifetime | `classroom.MAX_CLASSES`, `CLASS_TTL_S` |
| Student "active" window | 20 s without a heartbeat | `classroom.ACTIVE_WINDOW_S` |
| Class transcript window | 180 s (last 1800 characters) | `classroom.TRANSCRIPT_WINDOW_S` |

### 1.6 Pointing the service at a different LLM

Any server that speaks the OpenAI chat-completions protocol works:

```bash
OPENROUTER_URL=http://localhost:11434/v1/chat/completions   # e.g. Ollama's OpenAI-compatible endpoint
OPENROUTER_MODEL=llama3.1
OPENROUTER_API_KEY=anything-non-empty                        # the code requires a non-empty key
```

The service always sends `Authorization: Bearer <key>`, `HTTP-Referer: http://localhost:3000` and
`X-Title: Study Session AI`, and expects a response of the form `{"choices":[{"message":{"content":"..."}}]}`.

## 2. Express API

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Listening port |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed browser origins |
| `DB_NAME` | *(unset)* | **If set, MySQL mode is enabled**; if unset the API stores everything in memory |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | | MySQL connection (used only when `DB_NAME` is set) |

```bash
cd backend && npm install && npm run dev      # nodemon; `npm start` for plain node
```

`GET /api/health` reports `"storage": "memory"` or `"mysql"`. Details: [features/express-service.md](features/express-service.md).
