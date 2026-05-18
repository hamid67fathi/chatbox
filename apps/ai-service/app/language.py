"""Detect user message language (fa / en / ar)."""

from __future__ import annotations

import re

SUPPORTED_LANGS = frozenset({"fa", "en", "ar"})

_PERSIAN_CHARS = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
_ARABIC_ONLY = re.compile(r"[\u0621-\u064A\u0660-\u0669]")
_LATIN = re.compile(r"[A-Za-z]")


def normalize_lang(code: str | None, default: str = "fa") -> str:
	if not code:
		return default if default in SUPPORTED_LANGS else "fa"
	low = code.strip().lower().replace("_", "-")
	if low in SUPPORTED_LANGS:
		return low
	prefix = low.split("-")[0]
	if prefix in SUPPORTED_LANGS:
		return prefix
	if prefix == "fa" or low.startswith("fa"):
		return "fa"
	if prefix == "ar" or low.startswith("ar"):
		return "ar"
	if prefix == "en" or low.startswith("en"):
		return "en"
	return default if default in SUPPORTED_LANGS else "fa"


def locale_to_lang(locale: str | None) -> str:
	return normalize_lang(locale, "fa")


def _heuristic_detect(text: str, default: str) -> tuple[str, float]:
	sample = text.strip()
	if not sample:
		return default, 0.5

	latin = len(_LATIN.findall(sample))
	persian_block = len(_PERSIAN_CHARS.findall(sample))

	if latin > persian_block and latin >= 3:
		return "en", 0.75

	if persian_block == 0 and latin >= 2:
		return "en", 0.7

	# Arabic vs Persian: Persian-specific letters
	if re.search(r"[پچژگک]", sample):
		return "fa", 0.85

	if _ARABIC_ONLY.search(sample) and not re.search(r"[پچژگ]", sample):
		# Could be Arabic; short messages in Arabic script default ar
		if re.search(r"[\u0627-\u064A]{3,}", sample):
			return "ar", 0.7

	return "fa", 0.8


def detect_language(text: str, default: str = "fa") -> tuple[str, float]:
	default = normalize_lang(default, "fa")
	sample = text.strip()
	if not sample:
		return default, 0.5

	try:
		from langdetect import DetectorFactory, detect_langs

		DetectorFactory.seed = 0
		candidates = detect_langs(sample[:2000])
		if candidates:
			best = candidates[0]
			code = best.lang
			if code in ("fa", "ur"):
				return "fa", float(best.prob)
			if code == "ar":
				return "ar", float(best.prob)
			if code in ("en", "de", "fr", "es", "it", "tr"):
				return "en", float(best.prob)
	except Exception:
		pass

	return _heuristic_detect(sample, default)
