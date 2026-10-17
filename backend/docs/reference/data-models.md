# Data models

JSON shapes exchanged by the FastAPI service. For request validation rules see the endpoint docs; for the
machine-readable request schemas see [../openapi.json](../openapi.json).

Notation: `?` = optional / may be absent; `|` = alternatives. Types are JSON types.

## Lecture plan

Returned by `POST /analyze-lecture` and `GET /get-lecture-plan`; accepted by slide, quiz and classroom
endpoints.

```jsonc
{
  "sessionId": "uuid",            // key for retrieval, plan lookup and study sessions
  "lectureId": "uuid",
  "topic": "string",              // overall lecture title
  "duration": "45 minutes",       // LLM estimate, default "30-45 minutes"
  "date": "YYYY-MM-DD",
  "instructor": "string",         // LLM guess, default "Subject Matter Expert"
  "impTopics": [ Topic ],         // 1-20, in lecture order
  "metadata": {
    "analysisDepth": "signal-weighted-enhanced",
    "confidenceScore": 0.57,      // mean importance score of selected chunks
    "fallbackUsed": true,         // true when there was no transcript (not an error flag)
    "totalTopicsGenerated": 5,
    "wordCount": 780,
    "processingVersion": "2.1"
  },
  "generated_at": "ISO timestamp" // added when saved
}
```

### Topic

```jsonc
{
  "id": "topic-1",                       // topic-N, N = position
  "title": "string",
  "description": "string",               // 2-3 sentence summary
  "full_content": "string",              // first 500 chars of the source chunk
  "importance": "high | medium | low",
  "weightage": 57.5,                     // importance score × 100
  "prerequisites": ["string"],           // 0-4 items (empty without AI)
  "commonMisconceptions": ["string"],
  "keyInsights": ["string"]
}
```

Clients may add fields (for example `realWorldApplications`, `difficulty`); the service reads them if present.

## Slide

Returned (as `slide`) by `POST /generate-dynamic-slide`.

```jsonc
{
  "id": "slide_<unix ms>",
  "title": "string",
  "type": "concept_explanation | explain-more | ask-question | simplified-explanation | quiz-results | quiz-feedback | completion | <other>",
  "content": SlideContent,
  "images": [ Image ],                   // 0 or 1
  "metadata": {
    "generatedAt": "ISO", "sessionId": "string", "topicIndex": 0, "topicTitle": "string",
    "studentGoal": "gate", "knowledgeLevel": "intermediate", "actionType": "string",
    "hasImages": true, "generatedBy": "AI", "aiModel": "openai/gpt-3.5-turbo",
    "sources": [ Source ]
  }
}
```

### SlideContent (LLM-authored; every field optional for consumers)

```jsonc
{
  "title": "string",
  "narrative": "string",
  "keyInsights": ["string"],
  "analogies": [ { "domain": "string", "comparison": "string", "lesson": "string" } ],
  "realWorldScenario": { "situation": "string", "application": "string", "outcome": "string" },
  "interactiveElement": "string",
  "examRelevance": "string",
  "commonTraps": ["string"],
  "memoryHook": "string"
}
```

### Image

```jsonc
{ "id": "img_<10 hex>", "url": "https://...", "caption": "string", "alt": "string",
  "source": "wikimedia", "sourcePage": "https://commons.wikimedia.org/wiki/File:...", "isPlaceholder": false }
```

### Source

```jsonc
{ "id": "chunk-4", "kind": "lecture | transcript", "snippet": "≈220 chars", "score": 0.3347 }
```

## Retrieval document

Stored in `data/rag/*.json`; returned by `POST /rag/query`.

```jsonc
{ "id": "string", "text": "string", "kind": "lecture | transcript | explanation",
  "meta": { },                // lecture: {chunkIndex, topicId|null}; transcript: {chunkIndex}; explanation: {topicIndex, action}
  "score": 0.58 }             // only in query results
```

## Diagnostic question

Elements of `questions` from `POST /generate-diagnostic-mcq`.

```jsonc
{
  "id": "q1",
  "question": "string",
  "options": [ Option ×4 ],             // ids A-D, shuffled, exactly one isCorrect
  "correctAnswer": "A | B | C | D",
  "explanation": "string",
  "difficulty": "high | medium | low",   // the topic's importance
  "conceptsTested": ["topic title"],
  "topicId": "topic-1",
  "topicName": "string",
  "diagnosticFocus": "knowledge_verification",
  "source": "ai | template"
}
```

### Option

```jsonc
{ "id": "A", "text": "string", "isCorrect": true }
```

## Topic quiz

`quiz` from `POST /generate-topic-quiz`.

```jsonc
{
  "id": "ai_quiz_<10 hex>",
  "title": "GATE Quiz: <topic>",
  "topic": "string",
  "studentGoal": "string",
  "difficulty": "string",
  "questions": [ QuizQuestion ],
  "totalQuestions": 5,
  "estimatedTime": 375,                 // seconds
  "metadata": { "generatedAt": "ISO", "source": "ai", "topicId": "topic-1", "sessionId": "string|null" }
}
```

### QuizQuestion

```jsonc
{
  "id": "q1_<6 hex>",
  "text": "string", "question": "string",     // identical
  "type": "conceptual | application | analysis",
  "difficulty": "string",
  "options": [ Option ×4 ],
  "correctAnswer": "A | B | C | D",
  "explanation": "string",
  "misconception": "string",
  "conceptsTested": ["topic title"],
  "timeEstimate": 75,
  "topic": { "id": "topic-1", "title": "string" }
}
```

## Quiz analysis (response of `POST /analyze-quiz-results`)

```jsonc
{
  "success": true, "score": 50.0, "correct": 1, "total": 2,
  "misconceptions": [ { "topic": "string", "question": "string", "yourAnswer": "C|null", "correctAnswer": "B",
                        "explanation": "string", "type": "knowledge_gap" } ],
  "weakTopics": ["string"],
  "recommendations": ["string"],
  "knowledgeState": { "overallMastery": 50.0, "conceptualUnderstanding": 50.0, "needsReview": true }
}
```

## Stored quiz result (`data/quiz_results.json` element)

```jsonc
{ "session_id": "string", "lecture_id": "string", "score": 50.0, "correct": 1, "total": 2,
  "questions": [ ], "answers": [ ], "misconceptions": [ ], "weak_topics": ["string"], "recommendations": ["string"],
  "timestamp": "ISO (request)", "saved_at": "ISO (write)" }
```

## Classroom

### ClassState (in `state`)

```jsonc
{ "code": "ABC234", "topicIndex": 0, "paused": false, "pauseMode": "quiz | avatar | null",
  "pauseId": 0, "ended": false, "teacherName": "string" }
```

### Dashboard

```jsonc
{
  "state": ClassState,
  "aggregate": { "joined": 12, "active": 10, "averageLoad": 56.4,
                 "levels": { "low": 3, "medium": 4, "high": 3 }, "highRatio": 0.3, "overloaded": false },
  "history": [ { "t": 1792243672.4, "averageLoad": 56.4, "active": 10, "high": 3 } ],   // t = Unix seconds
  "events": [ { "t": 1792243672.4, "kind": "class_started | student_joined | topic_changed | paused | resumed | class_ended",
                "topicIndex": 0, "mode": "quiz", "pauseId": 1 } ],                      // extra keys depend on kind
  "quizResults": { "1": { "responses": 9, "averageScore": 72.5 } },
  "recentTranscript": "string",
  "topics": ["string"],
  "lectureTopic": "string",
  "startedAt": 1792243672.4
}
```

## Error body

```jsonc
{ "detail": "string" }                         // errors raised by the service
{ "detail": [ { "loc": ["body","x"], "msg": "...", "type": "..." } ] }   // request validation (422)
```
