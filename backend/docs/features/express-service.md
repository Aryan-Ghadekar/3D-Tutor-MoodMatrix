# Feature: Express API (cognitive-load & help-offer logging)

A small Node service that records cognitive-load readings and help offers and serves a demo quiz bank.
**It is optional**: the current web UI uses the FastAPI service for everything and does not call this API.
It remains available for integrations and for storing events in MySQL.

* **Endpoints:** [api/express.md](../api/express.md)
* **Code:** `backend/src/`: `server.js`, `routes/`, `models/`, `config/database.js`
* **Run:** `cd backend && npm install && npm run dev` (port 5000)

## 1. Two storage modes

`server.js` decides at startup from the `DB_NAME` environment variable:

| Mode | Condition | Routes mounted for `/api/cognitive` and `/api/help` | Persistence |
|---|---|---|---|
| **Memory** | `DB_NAME` unset | `routes/memoryRoutes.js` | none; data is lost on restart |
| **MySQL** | `DB_NAME` set | `routes/cognitiveRoutes.js`, `routes/helpRoutes.js` (Sequelize models) | tables in MySQL |

`/api/quiz/*` is **always** served from `routes/quizRoutes.js` with its built-in question bank.
`GET /api/health` reports the active mode in `storage`.

## 2. Components

```
src/
├─ server.js                 app, CORS, JSON parsing, mode selection, 404 + error handlers
├─ config/database.js       Sequelize connection (MySQL); connects when required
├─ models/
│  ├─ CognitiveLoad.js      table cognitive_loads
│  ├─ HelpOffer.js          table help_offers
│  ├─ QuizResult.js         table quiz_results   (defined, currently unused)
│  └─ index.js              exports models + syncDatabase()
└─ routes/
   ├─ cognitiveRoutes.js    MySQL implementation of /api/cognitive
   ├─ helpRoutes.js         MySQL implementation of /api/help
   ├─ memoryRoutes.js       in-memory implementation of both
   └─ quizRoutes.js         demo quiz bank + submit
```

### Server behaviour

* CORS limited to `CORS_ORIGINS` (default `http://localhost:3000,http://127.0.0.1:3000`).
* Unknown `/api/*` paths → `404 {"success": false, "error": "API endpoint not found", ...}`.
* The error handler has the four-argument signature Express requires. Client errors (for example invalid
  JSON, status < 500) return their message; server errors return `Internal server error` and are logged.
* `module.exports = app`; the server only calls `listen` when run directly (`require.main === module`), so
  the app can be imported by tests.

## 3. Data model (MySQL mode)

Tables are created by `sequelize.sync()` at startup. `sync()` **creates missing tables but never alters
existing ones**; change an existing table with a migration.

### `cognitive_loads`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER, PK, auto | |
| `userId` | INTEGER, not null | |
| `sessionId` | STRING, not null | |
| `loadValue` | FLOAT, not null | 0-100 |
| `emotionData`, `postureData`, `activityData` | JSON, nullable | free-form |
| `timestamp` | DATE, default now | |

### `help_offers`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER, PK, auto | |
| `userId`, `sessionId` | INTEGER, STRING | |
| `triggerType` | ENUM(`quiz`,`explanation`,`qa`,`general`), not null | |
| `loadValue` | FLOAT | load when the offer was shown |
| `offerShownAt` | DATE, default now | |
| `userChoice` | ENUM(`quiz`,`explanation`,`qa`,`continue`,`dismissed`), nullable | set by `record-choice` |
| `choiceTime`, `loadAfterAction` | DATE, FLOAT | |

### `quiz_results`

Defined (`userId, sessionId, questionCount, correctAnswers, difficultyLevel, loadBefore, loadAfter,
completionTime, completedAt`) but **not written by any route**: `POST /api/quiz/submit` computes and returns
a result without storing it.

## 4. Behaviour of each route group

### Cognitive load (`/api/cognitive`)

* `POST /record` validates `loadValue` (number 0-100, else 400), stores the reading and decides whether to
  offer help: `loadValue > 70`. Offer type: `explanation` when `> 80`; `qa` when `> 70` and
  `activityData.hesitation` is truthy; otherwise `quiz`.
* `GET /history/:sessionId` returns up to 100 readings (memory mode: the newest 100 per session).

### Help offers (`/api/help`)

* `POST /offer-shown` creates an offer (memory mode assigns incrementing integer ids starting at 1).
* `POST /record-choice` updates `userChoice`, `choiceTime` and `loadAfterAction`; unknown id → 404.

### Quiz (`/api/quiz`)

* `GET /questions/:topic?loadLevel=` filters the demo bank by difficulty (`high` → easy only;
  `medium` → no hard).
* `POST /submit` scores answers (`selectedOption` equals the question's `correctAnswer` index), returns the
  percentage and `loadAfter = max(0, loadBefore − 10 × correct)`.

## 5. Limitations

* No authentication or rate limiting.
* In-memory mode loses data on restart and does not bound the number of sessions held (each keeps 100 readings).
* The quiz bank is a two-topic demo (`backpropagation`, `calculus`); real questions come from the FastAPI service.
* MySQL mode is **not covered by the automated tests**; it was written to the same contract as the memory mode
  but should be smoke-tested against your database before relying on it.
* The database connection is attempted when `config/database.js` is first required (MySQL mode only); a failed
  connection is logged and requests then fail with 500.

## 6. Verifying the service

```bash
curl localhost:5000/api/health
curl -X POST localhost:5000/api/cognitive/record -H 'Content-Type: application/json' \
     -d '{"userId":1,"sessionId":"s1","loadValue":78,"activityData":{"hesitation":true}}'
```
