"""Tiny stand-in for OpenRouter so the whole stack can run offline. Answers by looking at the system prompt."""
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

TOPIC_WORDS = ["Binary Trees", "Hash Tables", "Graph Traversal", "Sorting Algorithms", "Dynamic Programming"]
counter = {"n": 0}


def mcq(i):
    return {
        "question": f"Mock question {i}: which statement about the topic is correct?",
        "type": ["conceptual", "application", "analysis"][i % 3],
        "options": [
            {"text": f"Correct statement {i}", "isCorrect": True},
            {"text": f"Wrong statement {i}a", "isCorrect": False},
            {"text": f"Wrong statement {i}b", "isCorrect": False},
            {"text": f"Wrong statement {i}c", "isCorrect": False},
        ],
        "explanation": f"Because statement {i} is the true one.",
        "misconception": f"Believing wrong statement {i}a",
    }


def reply(system, user):
    if "RESPONSE FORMAT (JSON)" in system:
        title = re.search(r"TOPIC: (.*)", user)
        action = "question" if "SPECIFIC QUESTION" in user else "slide"
        return json.dumps({
            "title": f"AI {action}: {title.group(1).strip() if title else 'Summary'}",
            "narrative": "Mock narrative paragraph explaining the idea in detail.",
            "keyInsights": ["Insight one", "Insight two", "Insight three"],
            "analogies": [{"domain": "Kitchen", "comparison": "Like a recipe", "lesson": "Order matters"}],
            "realWorldScenario": {"situation": "A web server", "application": "Use it", "outcome": "Faster"},
            "interactiveElement": "Can you explain this in your own words?",
            "examRelevance": "Appears often.",
            "commonTraps": ["Trap one", "Trap two"],
            "memoryHook": "Mock hook",
        })
    if "multiple choice quiz" in system:
        count = int(re.search(r"exactly (\d+) questions", system).group(1))
        return json.dumps({"questions": [mcq(i) for i in range(count)]})
    if "creating multiple choice questions" in system:
        counter["n"] += 1
        return json.dumps(mcq(counter["n"]))
    if "topic title" in system:
        counter["n"] += 1
        return TOPIC_WORDS[counter["n"] % len(TOPIC_WORDS)]
    if "Summarize" in system:
        return "A short mock summary of the section. It has two sentences."
    if "JSON array" in system:
        if "duration" in system:
            return '["45 minutes"]'
        if "instructor" in system:
            return '["Algorithms Professor"]'
        return '["First point worth knowing", "Second point worth knowing"]'
    return "ok"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        msgs = body["messages"]
        content = reply(msgs[0]["content"], msgs[-1]["content"])
        payload = json.dumps({"choices": [{"message": {"role": "assistant", "content": content}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 9100), Handler).serve_forever()
