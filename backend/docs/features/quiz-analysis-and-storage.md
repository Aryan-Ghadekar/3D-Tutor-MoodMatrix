# Feature: Quiz analysis & result storage

* **Endpoints:** [`POST /analyze-quiz-results`](../api/quiz-results.md#post-analyze-quiz-results),
  [`POST /save-quiz-results`](../api/quiz-results.md#post-save-quiz-results)
* **Code:** `main.py`: `analyze_quiz_results`, `save_quiz_results_endpoint`, `save_quiz_results`
  (storage in `data/quiz_results.json`, see [storage](storage.md))

## 1. Analysis

A deterministic, offline computation (no LLM):

1. Index the answers by `questionId` (compared as strings).
2. For every question:
   * answered **and** `selectedAnswer == correctAnswer` → correct;
   * otherwise (wrong **or unanswered**) → wrong: its topic (`conceptsTested[0]`, else `"Unknown"`) is added to
     the weak topics and a *misconception* record `{topic, question, yourAnswer, correctAnswer, explanation,
     type: "knowledge_gap"}` is created (`yourAnswer` is `null` when unanswered).
3. `score = correct / total × 100` (1 decimal; 0 with no questions).
4. Recommendations:

| Condition | Recommendation |
|---|---|
| `score < 60` | Review fundamental concepts from the lecture |
| any weak topic | Focus on: *first 3 distinct weak topics* |
| `score ≥ 80` | Strong understanding! Move to advanced topics |

5. `knowledgeState = {overallMastery: score, conceptualUnderstanding: score, needsReview: score < 70}`.

The two mastery fields are the same number today; they are separate keys so a future model can distinguish
them without changing the contract.

> The analysis is **not** used by the current web app, which analyses answers in the browser. The endpoint is a
> supported, tested server-side equivalent.

## 2. Saving

`POST /save-quiz-results` stores the record exactly as sent plus `timestamp` and `saved_at`, **newest first**,
keeping the latest **50** (`_prepend_json_list(path, item, keep=50)`). Writes are atomic and serialised by a
file lock ([storage](storage.md)).

The knowledge-test page posts its result here so a persistent copy exists outside the browser. Nothing in the
backend reads the file; it is an export for analysis.

## 3. Failure modes

| Situation | Result |
|---|---|
| Missing/invalid fields | 422 (validation) |
| Data directory not writable | 500 `Failed to save results: ...` |
| Existing file is corrupt JSON | treated as empty; the next save rewrites it (earlier records are lost) |

## 4. Tests

`test_api.py`: `test_save_quiz_results_round_trip`, `test_analyze_quiz_results_matches_answers_by_id`.
