"""Simple PII redaction — replaces common patterns before sending to external LLM."""

import re

_PATTERNS = [
    (re.compile(r"\b09\d{9}\b"), "[PHONE]"),
    (re.compile(r"\b\d{3}-\d{4}-\d{4}\b"), "[PHONE]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
    (re.compile(r"\b\d{10}\b"), "[NATIONAL_ID]"),
    (re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"), "[CARD]"),
]


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text
