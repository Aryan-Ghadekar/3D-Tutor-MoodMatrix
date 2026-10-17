## How to Run the Project

The app is two required services plus one optional one. Run each in its own terminal.

| Service | Folder | Port | Required |
|---|---|---|---|
| Frontend (Next.js) | `frontend` | 3000 | yes |
| AI / lecture service (FastAPI) | `backend/fastapi-service` | **8001** | yes |
| Express API (cognitive-load / help-offer logging) | `backend` | 5000 | no, nothing in the UI depends on it yet |

### Prerequisites
- Node.js 18+ (20+ recommended)
- Python 3.10-3.11 (3.12+ may lack wheels for some ML packages)
- [ffmpeg](https://ffmpeg.org/download.html) on your `PATH`, needed only for audio uploads and YouTube videos without captions
- An [OpenRouter](https://openrouter.ai) API key (without one the app still runs, but lecture topics are extracted from the text instead of written by AI, and slides / quizzes use built-in templates)

### 1. FastAPI service (port 8001)

```bash
cd backend/fastapi-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then put your OPENROUTER_API_KEY in .env
python main.py                  # or: uvicorn main:app --port 8001 --reload
```

The first lecture that needs speech-to-text downloads the Whisper model, and the first analysis downloads the
`all-MiniLM-L6-v2` embedding model. Both are optional: if they cannot load, the service falls back gracefully.

Lecture plans and quiz results are stored in `backend/fastapi-service/data/` (git-ignored).

### 2. Frontend (port 3000)

```bash
cd frontend
npm install
cp .env.example .env.local      # optional; defaults match the ports above
npm run dev                     # production: npm run build && npm start
```

Open http://localhost:3000.

Accounts are stored in `frontend/.data/users.json` (git-ignored) with salted scrypt password hashes. This is meant for
local use; set `SESSION_SECRET` and swap in a real database before deploying.

### 3. Express API (optional, port 5000)

```bash
cd backend
npm install
npm run dev
```

Without `DB_NAME` set it stores data in memory. To use MySQL, copy `backend/.env.example` to `backend/.env` and fill in the `DB_*` values.

### Typical flow (student)
1. Register / sign in, then pick a learning goal.
2. Upload a PDF / PPTX (optionally with audio) or paste a YouTube link. A YouTube link or audio file alone is enough.
3. Take the short knowledge test (or skip it). Its result sets the difficulty of what follows.
4. Study: AI-generated slides per topic, plus *Explain More*, *Ask Questions* and adaptive quizzes. Answers cite the lecture passages they are based on.
5. Optional: **Avatar** (reads slides aloud, simplifies, takes voice questions), **Camera** (cognitive-load tracking), **Notes** (download Markdown or print to PDF).

### Live classroom (teacher + students)
1. Register as a **Teacher**, sign in (you land on `/teacher`), upload a lecture, then **Start class**. A 6-character code appears.
2. Students open **Join Class** (`/join`), enter the code and study the teacher's lecture. They report only an anonymous load score.
3. The dashboard shows the class's average load, how many students are overloaded and a warning when a large share are. You can set the current topic (students follow), **pause for a quiz** or **pause for an avatar explanation**, and resume.
4. Turn on **Capture lecture audio** (Chrome / Edge) so pause quizzes and explanations can use what you said in the last 2-3 minutes.
5. **End class** downloads a report.

Classes live in the FastAPI process's memory; restarting the server ends them. Use one server process.

### Camera load tracking
The first time it is enabled the browser downloads two MediaPipe model files (about 10 MB, from Google's public model bucket, then cached). To host them yourself, set `NEXT_PUBLIC_MEDIAPIPE_MODEL_BASE`. The WASM runtime is copied into `frontend/public/mediapipe/` by `npm install` / `npm run dev` / `npm run build`. Video never leaves the browser.

### Tests
```bash
pip install pytest httpx
pytest backend/fastapi-service       # API, retrieval and classroom tests with the LLM / network mocked
cd frontend && npm test              # cognitive-load model, speech scripts, notes
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | `backend/fastapi-service/.env` | LLM access |
| `OPENROUTER_MODEL`, `WHISPER_MODEL`, `PORT`, `CORS_ORIGINS`, `DATA_DIR` | same | optional overrides |
| `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` | `frontend/.env.local` | FastAPI URL (default `http://localhost:8001`) |
| `SESSION_SECRET` | `frontend/.env.local` | signs login cookies |

### More documentation
Backend architecture, API reference, per-feature internals and troubleshooting: [`backend/docs`](backend/docs/README.md).
