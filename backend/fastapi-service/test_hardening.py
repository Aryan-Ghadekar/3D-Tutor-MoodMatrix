"""Tests for API-key protection, upload limits, scoring accuracy, caching, question styles, AI metadata and
bounded concurrency. Run with: pytest backend/fastapi-service"""
import io
import json
import os
import tempfile
import threading
import time

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ.pop("OPENROUTER_API_KEY", None)

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

TEXT = " ".join(
    f"Section {i} explains an important idea about topic number {i} and why the key concept matters for the exam." for i in range(1, 120)
)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(main, "get_semantic_model", lambda: None)
    monkeypatch.setattr(main, "process_yt_link", lambda link: TEXT)


# ----------------------------------------------------------------------------------------------- API key
def test_api_key_protects_everything_except_health_docs_and_classroom(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "s3cret")

    assert client.get("/health").status_code == 200
    assert client.get("/").json()["auth_required"] is True
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/classroom/NOPE12/state").status_code == 404          # reaches the router: not blocked

    for method, path in [("post", "/analyze-lecture"), ("get", "/get-lecture-plan"), ("post", "/rag/query"),
                         ("post", "/generate-topic-quiz"), ("post", "/save-quiz-results")]:
        r = getattr(client, method)(path)
        assert r.status_code == 401 and r.json() == {"detail": "Missing or invalid API key."}, path


def test_api_key_must_match_exactly(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "s3cret")
    assert client.post("/analyze-lecture", headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.post("/analyze-lecture", headers={"X-API-Key": ""}).status_code == 401
    # with the right key the request reaches the endpoint (which then rejects the empty body itself)
    assert client.post("/analyze-lecture", headers={"X-API-Key": "s3cret"}).status_code == 400


def test_cors_preflight_is_not_blocked_by_the_key(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "s3cret")
    r = client.options("/analyze-lecture", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
                                                     "Access-Control-Request-Headers": "x-api-key"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_open_service_when_no_key_is_configured(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", None)
    assert client.get("/").json()["auth_required"] is False
    assert client.post("/analyze-lecture").status_code == 400


# ----------------------------------------------------------------------------------------------- uploads
def test_oversized_upload_is_rejected_before_parsing(monkeypatch):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 100)
    big = b"x" * (2 * 1024 * 1024)
    r = client.post("/analyze-lecture", files={"pdf": ("big.pdf", big, "application/pdf")})
    assert r.status_code == 413 and "limit" in r.json()["detail"]


def test_upload_slightly_over_the_limit_is_rejected_while_saving(monkeypatch):
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 1000)
    files = {"pdf": ("a.pdf", b"x" * 5000, "application/pdf")}
    r = client.post("/analyze-lecture", files=files)
    assert r.status_code == 413
    # no temp file is left behind
    leftovers = [f for f in os.listdir(tempfile.gettempdir()) if f.endswith(".pdf") and os.path.getsize(os.path.join(tempfile.gettempdir(), f)) == 0]
    assert not leftovers


def test_upload_under_the_limit_still_works():
    r = client.post("/analyze-lecture", files={"pdf": ("bad.pdf", b"not a pdf", "application/pdf")})
    assert r.status_code == 422                                                # reached the parser


# ----------------------------------------------------------------------------------------------- keywords
def test_keywords_match_whole_words_only():
    assert main.keyword_hits("A monkey will denote nothing") == []
    assert main.keyword_hits("Notes: keys are Important, the main concepts") == ["important", "note", "key", "main", "concept"]
    assert main.keyword_hits("EXAM") == ["exam"]


def test_keyword_score_ignores_substrings():
    features = main.extract_features(["the monkey denotes a donkey"], None)
    assert features[0]["keyword"] == 0
    features = main.extract_features(["this is an important key point"], None)
    assert features[0]["keyword"] == pytest.approx(1.0)


# ----------------------------------------------------------------------------------------------- image cache
class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


FOUND = {"query": {"pages": {"1": {"index": 1, "title": "File:Binary_tree.svg", "imageinfo": [
    {"mime": "image/svg+xml", "width": 800, "thumburl": "https://x/t.png", "descriptionurl": "https://x/page"}]}}}}


def test_failed_image_lookups_are_not_remembered(monkeypatch):
    main.search_commons_image.cache_clear()
    calls = []

    def flaky(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise ConnectionError("offline")
        return FakeResponse(FOUND)

    monkeypatch.setattr(main.requests, "get", flaky)
    assert main.search_commons_image("binary tree diagram", ("binar",)) is None
    result = main.search_commons_image("binary tree diagram", ("binar",))      # network is back
    assert result and result["url"] == "https://x/t.png" and len(calls) == 2
    main.search_commons_image("binary tree diagram", ("binar",))               # now cached
    assert len(calls) == 2


def test_genuine_misses_are_cached_but_expire(monkeypatch):
    main.search_commons_image.cache_clear()
    calls = []
    monkeypatch.setattr(main.requests, "get", lambda *a, **k: calls.append(1) or FakeResponse({"query": {"pages": {}}}))
    assert main.search_commons_image("nothing relevant", ()) is None
    assert main.search_commons_image("nothing relevant", ()) is None
    assert len(calls) == 1
    key = ("nothing relevant", ())
    main._image_cache[key] = (time.time() - 1, None)                           # expired
    main.search_commons_image("nothing relevant", ())
    assert len(calls) == 2


def test_irrelevant_file_names_are_skipped(monkeypatch):
    main.search_commons_image.cache_clear()
    monkeypatch.setattr(main.requests, "get", lambda *a, **k: FakeResponse(FOUND))
    assert main.search_commons_image("tree", ("hash",)) is None


# ----------------------------------------------------------------------------------------------- question styles
PLAN = {"impTopics": [{"id": f"topic-{i}", "title": f"Topic {i}", "description": f"Topic {i} is about thing {i}.",
                       "keyInsights": [f"Insight number {i} is true."]} for i in range(1, 5)]}


def test_requested_question_styles_are_cycled_and_reported(monkeypatch):
    monkeypatch.setattr(main, "llm_message", lambda *a, **k: (_ for _ in ()).throw(Exception("down")))
    r = client.post("/generate-diagnostic-mcq", json={"lecture_plan": PLAN, "num_questions": 4,
                                                      "question_types": ["application", "analysis", "bogus"]})
    types = [q["type"] for q in r.json()["questions"]]
    skills = [q["assessedSkill"] for q in r.json()["questions"]]
    assert types == ["application", "analysis", "application", "analysis"]
    assert skills == ["practical_application", "analytical_thinking", "practical_application", "analytical_thinking"]


def test_default_style_is_conceptual_and_the_prompt_mentions_the_style(monkeypatch):
    prompts = []

    def fake(payload, timeout=30):
        prompts.append(payload["messages"][-1]["content"])
        return json.dumps({"question": "Q?", "explanation": "e", "options": [
            {"text": "r", "isCorrect": True}] + [{"text": f"w{i}", "isCorrect": False} for i in range(3)]})

    monkeypatch.setattr(main, "llm_message", fake)
    r = client.post("/generate-diagnostic-mcq", json={"lecture_plan": PLAN, "num_questions": 1})
    q = r.json()["questions"][0]
    assert q["type"] == "conceptual" and q["assessedSkill"] == "conceptual_understanding"
    assert "Question style (conceptual)" in prompts[0]

    prompts.clear()
    client.post("/generate-diagnostic-mcq", json={"lecture_plan": PLAN, "num_questions": 1, "question_types": ["misconception"]})
    assert "Question style (misconception)" in prompts[0] and "contradicts a common misconception" in prompts[0]


# ----------------------------------------------------------------------------------------------- plan metadata
def fake_openrouter(content_for):
    def fake(payload, timeout=30):
        return {"choices": [{"message": {"content": content_for(payload["messages"][0]["content"])}}]}
    return fake


def reply(system):
    if "topic title" in system:
        return "A Title"
    if "Summarize" in system:
        return "A summary."
    return '["one", "two"]'


def analyse():
    return client.post("/analyze-lecture", params={"yt_link": "https://youtu.be/dQw4w9WgXcQ"}).json()


def test_plan_metadata_tells_the_truth_about_ai_use(monkeypatch):
    monkeypatch.setattr(main, "OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(main, "make_openrouter_request", fake_openrouter(reply))
    plan = analyse()
    meta = plan["metadata"]
    n = len(plan["impTopics"])
    assert meta["aiGenerated"] is True and meta["fallbackUsed"] is False
    assert meta["aiCalls"] == {"succeeded": 5 * n + 3, "failed": 0}
    assert meta["transcriptUsed"] is True
    assert plan["impTopics"][0]["title"] == "A Title"


def test_plan_metadata_flags_fallbacks(monkeypatch):
    monkeypatch.setattr(main, "OPENROUTER_API_KEY", None)
    plan = analyse()
    meta = plan["metadata"]
    assert meta["aiGenerated"] is False and meta["fallbackUsed"] is True
    assert meta["aiCalls"]["succeeded"] == 0 and meta["aiCalls"]["failed"] > 0


def test_partial_ai_failure_is_reported(monkeypatch):
    monkeypatch.setattr(main, "OPENROUTER_API_KEY", "k")

    def sometimes(system):
        if "prerequisites" in system:
            raise RuntimeError("model hiccup")
        return reply(system)

    monkeypatch.setattr(main, "make_openrouter_request", fake_openrouter(sometimes))
    meta = analyse()["metadata"]
    assert meta["aiGenerated"] is True and meta["fallbackUsed"] is True and meta["aiCalls"]["failed"] > 0


# ----------------------------------------------------------------------------------------------- concurrency
def test_topics_are_built_in_parallel_but_model_requests_are_bounded_and_order_is_kept(monkeypatch):
    monkeypatch.setattr(main, "OPENROUTER_API_KEY", "k")
    lock = threading.Lock()
    state = {"now": 0, "peak": 0}

    def fake(payload, timeout=30):
        with lock:
            state["now"] += 1
            state["peak"] = max(state["peak"], state["now"])
        time.sleep(0.03)
        with lock:
            state["now"] -= 1
        system = payload["messages"][0]["content"]
        text = payload["messages"][-1]["content"]
        return {"choices": [{"message": {"content": f"T:{text[-30:]}" if "topic title" in system else reply(system)}}]}

    monkeypatch.setattr(main, "make_openrouter_request", fake)
    plan = analyse()
    assert len(plan["impTopics"]) >= 3
    assert 2 <= state["peak"] <= main.LLM_CONCURRENCY
    assert [t["id"] for t in plan["impTopics"]] == [f"topic-{i + 1}" for i in range(len(plan["impTopics"]))]
    # titles were generated from their own chunk: sections ascend through the lecture
    nums = [int("".join(c for c in t["full_content"].split("Section")[1].split()[0] if c.isdigit())) for t in plan["impTopics"] if "Section" in t["full_content"]]
    assert nums == sorted(nums)
