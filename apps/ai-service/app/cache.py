"""In-memory TTL caches for embedding, retrieval, answer, and intent."""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from typing import Any


class TTLCache:
    def __init__(self, maxsize: int = 512, ttl_seconds: int = 300) -> None:
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Any | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: Any) -> None:
        if key in self._data:
            del self._data[key]
        elif len(self._data) >= self.maxsize:
            self._data.popitem(last=False)
        self._data[key] = (time.monotonic() + self.ttl_seconds, value)

    def stats(self) -> dict[str, int]:
        return {"size": len(self._data), "maxsize": self.maxsize}


def make_key(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


embedding_cache = TTLCache(maxsize=1024, ttl_seconds=3600)
retrieval_cache = TTLCache(maxsize=256, ttl_seconds=600)
answer_cache = TTLCache(maxsize=128, ttl_seconds=300)
intent_cache = TTLCache(maxsize=256, ttl_seconds=600)
