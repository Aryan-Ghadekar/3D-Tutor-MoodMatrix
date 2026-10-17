# End-to-end tests

Real browsers (Playwright) drive the whole stack against a **mock LLM**, so nothing calls OpenRouter and no key
is needed. `run.mjs` starts the mock LLM, the FastAPI service (with `API_TOKEN` enabled, like production) and
the Next.js app, runs the scenarios and stops everything.

```bash
cd e2e
npm install
npx playwright install chromium
PYTHON=/path/to/python node run.mjs               # all scenarios against a production build
node run.mjs auth student                         # a subset
node run.mjs --dev                                # use `next dev`
```

The Python interpreter needs the packages from `backend/fastapi-service/requirements.txt` (at least fastapi,
uvicorn, python-multipart, pdfplumber, python-pptx, requests). The first run builds the frontend if needed.
Logs and temporary data go to a temp folder that is printed at the start and deleted when everything passes.

| Scenario | File | What it proves |
|---|---|---|
| `auth` | `auth-flow.mjs` | "Remember me" cookie lifetimes, login lock-out, no dead links, the AI service refuses calls without its key |
| `student` | `student-flow.mjs` | the full student journey, no direct browser calls to the AI service, no false overload popup, medium-difficulty first quiz |
| `classroom` | `classroom-flow.mjs` | teacher + two students: topic sync, overload alert, pause quiz / avatar, camera sensor, notes, class report |
| `offline` | `offline-flow.mjs` | the AI service without any LLM: slides and quizzes built from the lecture text, correct scoring |

`mock_llm.py` answers by looking at the prompt; `make_pptx.py` creates the sample lecture.
