# Express API reference (port 5000)

Feature doc: [express-service](../features/express-service.md). This service is optional; the web UI does not
call it today.

All JSON. Successful responses carry `"success": true`. Failures carry `"success": false` and an `error`
message. Invalid JSON bodies return **400** with the parser's message; unknown `/api/*` paths return **404**
(`API endpoint not found`); unexpected errors return **500** `Internal server error`.

## Health

### `GET /health`

```json
{ "status": "healthy", "message": "Backend server is running!", "time": "2026-10-17T13:28:21.000Z" }
```

### `GET /api/health`

```json
{ "success": true, "message": "API is working", "version": "1.1.0", "storage": "memory" }
```

`storage` is `"mysql"` when `DB_NAME` is set, otherwise `"memory"`.

### `GET /`

Banner: `{ "message": "...", "endpoints": "Visit /api/health to check API status", "status": "running" }`.

---

## Quiz (demo question bank, always in-memory)

### `GET /api/quiz/test`

`{ "message": "Quiz routes are working!", "availableTopics": ["backpropagation", "calculus"] }`

### `GET /api/quiz/questions/:topic?loadLevel=high|medium|low`

Returns the topic's built-in questions, filtered by the student's load:

| `loadLevel` | Questions returned |
|---|---|
| `high` | only `difficulty: "easy"` |
| `medium` *(default)* | everything except `hard` |
| anything else | all |

Unknown topics return a single placeholder question (`"Sample question"`).

```json
{ "success": true, "topic": "backpropagation", "count": 1,
  "questions": [ { "id": 1, "question": "What is the main purpose of backpropagation in neural networks?",
                   "options": ["To initialize weights randomly", "To adjust weights based on error gradient", "..."],
                   "correctAnswer": 1, "difficulty": "easy" } ] }
```

Here `correctAnswer` is the **index** of the correct option (unlike the FastAPI quizzes, which use option ids).

### `POST /api/quiz/submit`

| Field | Type | Description |
|---|---|---|
| `answers` | object[] | *required*, non-empty: `{ "questionId": 1, "selectedOption": 1 }` |
| `topic` | string | picks the question bank (unknown → placeholder) |
| `loadBefore` | number | default `50` |
| `userId`, `sessionId`, `completionTime` | | echoed / informational |

```json
{ "success": true,
  "data": { "id": 1792243701929, "userId": 1, "sessionId": "s1", "topic": "backpropagation", "questionCount": 2,
            "correctAnswers": 1, "score": 50, "loadBefore": 80, "completedAt": "2026-10-17T13:28:21.929Z" },
  "loadAfter": 70, "message": "Quiz completed! Score: 50%" }
```

`score` is the rounded percentage; `loadAfter = max(0, loadBefore - correctAnswers * 10)`.
Errors: 400 `answers must be a non-empty array`. The result is **not stored** (see the feature doc).

---

## Cognitive load

### `POST /api/cognitive/record`

| Field | Type | Description |
|---|---|---|
| `loadValue` | number | *required*, 0-100 (400 otherwise) |
| `userId`, `sessionId` | | identifiers |
| `emotionData`, `postureData`, `activityData` | object | free-form; `activityData.hesitation` influences the offer type |

```json
{ "success": true,
  "data": { "userId": 1, "sessionId": "s1", "loadValue": 78, "activityData": { "hesitation": true }, "timestamp": "..." },
  "shouldOfferHelp": true, "offerType": "qa" }
```

`shouldOfferHelp` is `loadValue > 70`. `offerType`: `explanation` when `loadValue > 80`; `qa` when
`> 70` with `activityData.hesitation`; otherwise `quiz`; `null` if no help is offered.

### `GET /api/cognitive/history/:sessionId`

`{ "success": true, "data": [ ...records in time order... ] }`: the last 100 records (memory mode keeps 100 per
session; MySQL mode returns the first 100 ordered by timestamp).

---

## Help offers

### `POST /api/help/offer-shown`

Body: `userId`, `sessionId`, `triggerType` (`quiz` / `explanation` / `qa` / `general`), `loadValue`.
Returns `{ "success": true, "data": { "id": 1, ... }, "message": "Offer recorded" }`.

### `POST /api/help/record-choice`

Body: `offerId`, `userChoice` (`quiz` / `explanation` / `qa` / `continue` / `dismissed`), `loadAfterAction`.
Returns the updated offer, or **404** `Offer not found`.
