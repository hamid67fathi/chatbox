"""
Smoke eval: sends Persian FAQ fixtures to ai-service /v1/ask and checks basic quality.

Usage:
    python eval/run_eval.py [--url http://localhost:8000]

Requires ai-service running. Does NOT need OpenAI key (works with stub mode).
"""

import argparse
import json
import sys
from pathlib import Path

import httpx

FIXTURE = Path(__file__).parent / "persian_faq.jsonl"
WORKSPACE_ID = "00000000-0000-0000-0000-000000000000"


def load_fixtures() -> list[dict]:
    items = []
    with open(FIXTURE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items


def run(base_url: str) -> bool:
    fixtures = load_fixtures()
    passed = 0
    failed = 0

    print(f"\n{'='*60}")
    print(f"  AI Service Smoke Eval — {len(fixtures)} fixtures")
    print(f"  URL: {base_url}")
    print(f"{'='*60}\n")

    for i, fx in enumerate(fixtures, 1):
        question = fx["question"]
        expected = fx["expected_answer"]

        try:
            resp = httpx.post(
                f"{base_url}/v1/ask",
                json={"workspace_id": WORKSPACE_ID, "question": question},
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  [{i}] FAIL  {question[:40]}...")
            print(f"         Error: {e}")
            failed += 1
            continue

        reply = data.get("reply", "")
        confidence = data.get("confidence", 0)
        handoff = data.get("handoff", False)

        if expected == "handoff":
            ok = handoff or confidence < 0.7
            label = "handoff expected"
        else:
            ok = len(reply) > 5 and confidence > 0
            label = f"conf={confidence:.2f}"

        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1

        print(f"  [{i}] {status}  {question[:40]}...  ({label})")

    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{len(fixtures)} passed, {failed} failed")
    print(f"{'='*60}\n")

    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Service smoke eval")
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()

    success = run(args.url)
    sys.exit(0 if success else 1)
