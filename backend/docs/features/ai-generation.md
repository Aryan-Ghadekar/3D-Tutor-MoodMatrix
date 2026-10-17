# Feature: LLM integration

Every AI-written artifact (topic titles, slides, quizzes) goes through one small client layer in `main.py`.

* **Code:** `validate_api_key`, `make_openrouter_request`, `llm_message`, `parse_llm_json`,
  `generate_topic_title`, `generate_summary`, `generate_structured_content`
* **Config:** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_URL` ([configuration](../configuration.md))

## 1. Call path

```
feature code ──► llm_message(payload, timeout) ──► make_openrouter_request ──► requests.post(OPENROUTER_URL)
                         │                                    │
                         │                                    └─ validate_api_key()  (raises if unset/blank)
                         └─ returns choices[0].message.content (stripped)
```

`payload` is a standard chat-completions body: `model`, `messages` (system + user), `temperature`,
`max_tokens`. Headers sent: `Authorization: Bearer <key>`, `Content-Type: application/json`,
`HTTP-Referer: http://localhost:3000`, `X-Title: Study Session AI`.

### Errors raised (as plain exceptions, caught by each caller)

| Condition | Message |
|---|---|
| No / blank key | `OPENROUTER_API_KEY is not configured. ...` |
| HTTP 401 | `OpenRouter API returned 401 Unauthorized. Please verify your API key is correct and active.` |
| Timeout | `OpenRouter API request timed out after Ns. Try again.` |
| Connection error | `Cannot connect to OpenRouter API: ...` |
| Other HTTP error (402, 404, 429, 5xx) | `requests.HTTPError` from `raise_for_status()` |
| Reply without `choices[0].message` | `Invalid API response format` |

There are **no retries**. A semaphore (`LLM_CONCURRENCY`, default 4) limits how many requests are in flight at
once, which protects the provider rate limit when several topics are processed in parallel.

### Success / failure statistics

While a lecture plan is built, every title / summary / list call reports success or failure into a per-request
counter (`contextvars` shared with the worker threads). The totals end up in the plan's `metadata.aiCalls`,
`aiGenerated` and `fallbackUsed` ([topic-scoring §5](topic-scoring-and-plans.md#5-plan-metadata)).

## 2. Timeouts and sampling by call

| Call | Timeout | Temperature | Max tokens |
|---|---|---|---|
| topic title | 30 s | 0.3 | 40 |
| summary | 30 s | 0.4 | 150 |
| structured list (prerequisites, misconceptions, insights, duration, instructor) | 30 s | 0.5 | 200 |
| single diagnostic MCQ | 30 s | 0.7 | 400 |
| teaching slide | 45 s | 0.7 | 2000 |
| topic quiz | 45 s | 0.6 | 2200 |

If a slide or quiz is long enough to hit `max_tokens`, the JSON is cut off and parsing fails (slides →
502, quizzes → 503). Raise the limits in `generate_slide_with_ai` / `generate_topic_quiz_with_llm` for
very verbose models.

## 3. Parsing model output: `parse_llm_json`

Models often wrap JSON in markdown fences or prose. The parser:

1. strips ```` ```json ```` and ```` ``` ```` fences and tries `json.loads`;
2. otherwise takes the text between the first `{` and the last `}`, then between the first `[` and the last
   `]`, and tries `json.loads` on each;
3. raises `ValueError("LLM reply did not contain valid JSON")` if nothing parses.

`generate_structured_content` additionally accepts a **bulleted list** reply (one item per line) when no JSON
is found, and returns `[]` on any error.

## 4. Graceful degradation matrix

| Feature | No key / LLM down | Visible to the caller as |
|---|---|---|
| Topic titles, summaries, lists | extractive fallbacks | normal 200 with plainer text |
| Overall title, duration, instructor | defaults | normal 200 |
| Diagnostic MCQ | template question built from the plan | `source: "template"` |
| Topic quiz | none: **503** | client uses its own fallback |
| Slides | none: **502** | client uses its own fallback |

Fallback strings never contain error text: a failed call never leaks "generation failed" into content that
students read.

## 5. What is sent to the provider

* Lecture text: up to 1000-1500 characters of a chunk per title/summary call, up to 1200 for list calls,
  800 characters of topic content per MCQ, the topic description/insights for slides and quizzes.
* Student data: goal, knowledge level, average score, weak-topic names, misconception count/summaries, the
  student's own question, and (in live classes) the teacher's recent speech.
* Retrieved lecture passages (see [rag](rag.md)).

No names, emails or account data are ever sent.

## 6. Prompt-injection note

Lecture content and student questions are interpolated into prompts. A malicious document could contain
instructions aimed at the model. Consequences are limited to the *content* of the generated slide/quiz (the
model has no tools and its output is only parsed as JSON), but treat generated content as untrusted text when
rendering it (the web app renders it as plain text).

## 7. Using a different model or provider

Set `OPENROUTER_MODEL` for another OpenRouter model, or `OPENROUTER_URL` for another OpenAI-compatible server
([configuration §1.6](../configuration.md#16-pointing-the-service-at-a-different-llm)). The prompts ask for
strict JSON, so models that follow JSON instructions well work best.

## 8. Testing without a real LLM

Tests replace `main.llm_message` with a fake (`monkeypatch.setattr(main, "llm_message", ...)`). Raising an
exception from the fake simulates an outage and exercises every fallback. See [testing](../guides/testing.md).
