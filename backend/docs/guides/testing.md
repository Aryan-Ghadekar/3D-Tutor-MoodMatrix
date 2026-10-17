# Testing

## 1. Running the tests

```bash
cd backend/fastapi-service
pip install pytest httpx           # plus requirements.txt
pytest -q                          # 65 tests, about 3 seconds
pytest test_features.py -k classroom
```

The suite is **fully offline and deterministic**: it needs no API key, no network, no GPU, no Whisper and no
sentence-transformers.

## 2. How isolation works

| Mechanism | Where | Purpose |
|---|---|---|
| `os.environ["DATA_DIR"] = tempfile.mkdtemp()` *before* `import main` | top of both test files | plans, results and retrieval files go to a throw-away directory |
| `os.environ.pop("OPENROUTER_API_KEY")` | top of both test files | tests start with "no AI" |
| `monkeypatch.setattr(main, "llm_message", fake)` | per test / autouse fixture | replaces the LLM; a fake that **raises** simulates an outage |
| `monkeypatch.setattr(main, "get_semantic_model", lambda: None)` | autouse fixture | forces TF-IDF retrieval and the constant semantic score |
| `monkeypatch.setattr(main, "search_commons_image", lambda q, s=(): None)` | autouse fixture in `test_api.py` | no Wikimedia calls |
| `monkeypatch.setattr(main, "process_yt_link", lambda link: text)` | YouTube tests | no YouTube access |
| `classroom._classes.clear()` | classroom fixture | each classroom test starts with no classes |

`fastapi.testclient.TestClient(main.app)` runs the real ASGI app in-process, so endpoints, validation,
status codes and JSON shapes are exercised exactly as in production.

## 3. What each test protects

### `test_api.py` (26 tests)

| Area | Tests |
|---|---|
| Service | `test_health_and_root` |
| YouTube ids | `test_extract_video_id` (4 URL shapes) |
| Ingestion | `test_analyze_lecture_requires_input`, `test_analyze_lecture_from_pptx_without_ai`, `test_analyze_lecture_from_youtube_transcript_only`, `test_analyze_lecture_topics_keep_lecture_order`, `test_corrupt_uploads_return_422_with_a_message` |
| Plan lookup | `test_get_lecture_plan_lookup_rules` |
| Diagnostic MCQs | `test_diagnostic_mcq_template_fallback_is_valid`, `test_normalize_mcq_rejects_bad_and_shuffles` |
| Topic quiz | `test_topic_quiz_unavailable_without_ai`, `test_topic_quiz_with_ai` |
| Slides | `test_dynamic_slide_all_actions` (6 cases), `test_dynamic_slide_bad_index_and_ai_failure`, `test_dynamic_slide_accepts_weak_topics_and_misconceptions` |
| LLM parsing | `test_parse_llm_json_variants` |
| Results | `test_save_quiz_results_round_trip`, `test_analyze_quiz_results_matches_answers_by_id` |

### `test_hardening.py` (18 tests)

| Area | Tests |
|---|---|
| API key | `test_api_key_protects_everything_except_health_docs_and_classroom`, `test_api_key_must_match_exactly`, `test_cors_preflight_is_not_blocked_by_the_key`, `test_open_service_when_no_key_is_configured` |
| Upload limit | `test_oversized_upload_is_rejected_before_parsing`, `test_upload_slightly_over_the_limit_is_rejected_while_saving`, `test_upload_under_the_limit_still_works` |
| Keyword scoring | `test_keywords_match_whole_words_only`, `test_keyword_score_ignores_substrings` |
| Image cache | `test_failed_image_lookups_are_not_remembered`, `test_genuine_misses_are_cached_but_expire`, `test_irrelevant_file_names_are_skipped` |
| Question styles | `test_requested_question_styles_are_cycled_and_reported`, `test_default_style_is_conceptual_and_the_prompt_mentions_the_style` |
| Plan metadata | `test_plan_metadata_tells_the_truth_about_ai_use`, `test_plan_metadata_flags_fallbacks`, `test_partial_ai_failure_is_reported` |
| Concurrency | `test_topics_are_built_in_parallel_but_model_requests_are_bounded_and_order_is_kept` |

### `test_features.py` (21 tests)

| Area | Tests |
|---|---|
| Retrieval store | `test_query_ranks_the_relevant_passage_first`, `test_query_filters_by_kind_and_ignores_unrelated`, `test_add_replaces_by_id_and_persists`, `test_dense_model_is_used_when_available_and_failures_fall_back` |
| Retrieval in the pipeline | `test_upload_indexes_all_chunks_and_rag_endpoint_finds_them`, `test_transcript_only_lectures_are_not_indexed_twice`, `test_transcript_is_indexed_separately_when_slides_are_the_source`, `test_ask_question_is_grounded_in_retrieved_sources_and_remembered` |
| Teacher-audio context | `test_simplified_explanation_action_uses_recent_teacher_audio`, `test_topic_quiz_includes_recent_context` |
| Classroom | `test_create_requires_topics_and_returns_code`, `test_student_joins_with_code_and_receives_the_plan`, `test_dashboard_requires_the_teacher_token`, `test_aggregate_flags_overload_when_many_students_are_struggling`, `test_inactive_students_are_left_out_of_the_aggregate`, `test_pause_quiz_reaches_students_and_results_are_collected`, `test_control_validation`, `test_transcript_window_keeps_only_recent_audio`, `test_ending_a_class_blocks_new_students`, `test_unknown_student_heartbeat_is_rejected`, `test_history_is_sampled_not_per_heartbeat` |

## 4. Not covered by automated tests

| Area | How to check by hand |
|---|---|
| Real OpenRouter responses | set a key and call `/generate-dynamic-slide`; confirm valid JSON and sensible content |
| Whisper transcription, ffmpeg | `curl -F audio=@sample.mp3 localhost:8001/analyze-lecture` |
| yt-dlp audio fallback | use a video without captions |
| Dense embeddings (`sentence-transformers`) | install it, upload a lecture, query `/rag/query` with a paraphrase |
| Wikimedia image lookup | call `main.get_wikimedia_images({"title": "Binary Search Tree"}, "x")` in a Python shell |
| Express MySQL mode | start with `DB_*` set and exercise `/api/cognitive/record` |
| Multi-process behaviour | not supported |

## 4a. Browser end-to-end tests

`e2e/` at the repository root starts the whole stack (a mock LLM, FastAPI **with `API_TOKEN` enabled**, the
Next.js app) and drives real browsers with Playwright:

```bash
cd e2e && npm install && npx playwright install chromium
PYTHON=path/to/python node run.mjs            # all scenarios (production build)
node run.mjs auth student                     # a subset: auth | student | classroom | offline
node run.mjs --dev                            # against `next dev`
```

| Scenario | Covers |
|---|---|
| `auth` | cookie lifetime ("Remember me"), login lock-out (429), no dead links, the AI service refusing calls without the key |
| `student` | register → goal → upload → knowledge test → slides → quiz → completion → restart; the browser never calls the AI service directly |
| `classroom` | teacher + two students: topic sync, overload alert, pause quiz / avatar, camera sensor, notes, class report |
| `offline` | AI service running without any LLM: lecture-based fallback slides and quizzes |

## 5. Writing a new test

```python
def test_my_feature(monkeypatch):
    monkeypatch.setattr(main, "llm_message", lambda payload, timeout=30: json.dumps({"title": "T"}))
    r = client.post("/generate-dynamic-slide", json={...})
    assert r.status_code == 200
```

Tips:

* Inspect the prompt the LLM would receive by recording `payload["messages"][-1]["content"]` in the fake
  (see `test_ask_question_is_grounded_in_retrieved_sources_and_remembered`).
* Use a unique collection / session id per test, because retrieval data is shared inside the test run.
* Reset `classroom._classes` in any test that creates classes.
* Add the new test to the table in this file and, if you changed a response shape, update
  [data-models](../reference/data-models.md) and re-run `python export_openapi.py`.

## 6. Express API

There is no automated test suite for the Express service. Smoke-test with the `curl` examples in
[features/express-service.md](../features/express-service.md#6-verifying-the-service). If you add tests,
`server.js` exports `app` (and only listens when run directly) so `supertest` can import it.
