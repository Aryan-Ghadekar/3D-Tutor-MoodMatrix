"""Small on-disk vector store for retrieval-augmented answers.

Every lecture gets a collection holding its text chunks ("lecture"), transcript chunks ("transcript")
and the explanations the tutor has already generated ("explanation"). Retrieval uses dense sentence
embeddings when a model is available and falls back to TF-IDF cosine similarity otherwise, so it works
(and is testable) without any ML dependency.
"""
import json
import math
import os
import re
import threading
from collections import Counter
from pathlib import Path
from typing import Callable, Iterable, Optional

STOPWORDS = set(
    "a an and are as at be but by for from has have how i if in into is it its of on or that the their then "
    "there these they this to was we were what when where which who why will with you your can do does did not".split()
)


def tokenize(text: str) -> list:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 1 and w not in STOPWORDS]


def _cosine_sparse(a: dict, b: dict) -> float:
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def _cosine_dense(a, b) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


class _Collection:
    def __init__(self, docs: list):
        self.docs = docs
        self._tfidf = None
        self._idf = None
        self._dense = None

    def invalidate(self):
        self._tfidf = self._idf = self._dense = None

    # ---- TF-IDF -------------------------------------------------------
    def _build_tfidf(self):
        tokenised = [tokenize(d["text"]) for d in self.docs]
        df = Counter()
        for tokens in tokenised:
            df.update(set(tokens))
        n = max(len(self.docs), 1)
        self._idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        self._tfidf = [self._vector(tokens) for tokens in tokenised]

    def _vector(self, tokens: list) -> dict:
        counts = Counter(tokens)
        return {t: (1 + math.log(c)) * self._idf.get(t, 0.0) for t, c in counts.items() if t in self._idf}

    def tfidf_scores(self, query: str) -> list:
        if self._tfidf is None:
            self._build_tfidf()
        q = self._vector(tokenize(query))
        return [_cosine_sparse(q, d) for d in self._tfidf]

    # ---- dense --------------------------------------------------------
    def dense_scores(self, query: str, model) -> Optional[list]:
        try:
            if self._dense is None:
                self._dense = [list(map(float, v)) for v in model.encode([d["text"] for d in self.docs])]
            q = list(map(float, model.encode([query])[0]))
        except Exception as e:  # model failed at runtime: caller falls back to TF-IDF
            print(f"Dense retrieval unavailable: {e}")
            return None
        return [_cosine_dense(q, d) for d in self._dense]


class VectorStore:
    def __init__(self, directory: Path, model_getter: Optional[Callable] = None):
        self.directory = Path(directory)
        self.model_getter = model_getter
        self._collections = {}
        self._lock = threading.RLock()

    # ---- persistence --------------------------------------------------
    def _path(self, name: str) -> Path:
        safe = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:120]
        return self.directory / f"{safe}.json"

    def _load(self, name: str) -> _Collection:
        with self._lock:
            if name in self._collections:
                return self._collections[name]
            docs = []
            path = self._path(name)
            if path.exists():
                try:
                    docs = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    docs = []
            self._collections[name] = _Collection(docs)
            return self._collections[name]

    def _save(self, name: str, collection: _Collection):
        self.directory.mkdir(parents=True, exist_ok=True)
        tmp = self._path(name).with_suffix(".tmp")
        tmp.write_text(json.dumps(collection.docs, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self._path(name))

    # ---- API ----------------------------------------------------------
    def add(self, name: str, docs: Iterable[dict]) -> int:
        """Add documents ({id, text, kind, meta}); documents with an existing id are replaced."""
        with self._lock:
            collection = self._load(name)
            by_id = {d["id"]: i for i, d in enumerate(collection.docs)}
            added = 0
            for doc in docs:
                text = (doc.get("text") or "").strip()
                if not text:
                    continue
                entry = {"id": doc["id"], "text": text, "kind": doc.get("kind", "lecture"), "meta": doc.get("meta", {})}
                if entry["id"] in by_id:
                    collection.docs[by_id[entry["id"]]] = entry
                else:
                    by_id[entry["id"]] = len(collection.docs)
                    collection.docs.append(entry)
                added += 1
            collection.invalidate()
            self._save(name, collection)
            return added

    def count(self, name: str, kind: Optional[str] = None) -> int:
        docs = self._load(name).docs
        return len([d for d in docs if kind is None or d["kind"] == kind])

    def query(self, name: str, text: str, k: int = 4, kinds: Optional[list] = None, min_score: float = 0.05) -> list:
        """Return the k most similar documents as {id, text, kind, meta, score}."""
        with self._lock:
            collection = self._load(name)
            if not collection.docs or not text.strip():
                return []

            scores = None
            model = self.model_getter() if self.model_getter else None
            if model is not None:
                scores = collection.dense_scores(text, model)
            if scores is None:
                scores = collection.tfidf_scores(text)

            ranked = sorted(zip(scores, collection.docs), key=lambda p: p[0], reverse=True)
            results = []
            for score, doc in ranked:
                if kinds and doc["kind"] not in kinds:
                    continue
                if score < min_score:
                    break
                results.append({**doc, "score": round(float(score), 4)})
                if len(results) >= k:
                    break
            return results

    def delete(self, name: str):
        with self._lock:
            self._collections.pop(name, None)
            path = self._path(name)
            if path.exists():
                path.unlink()
