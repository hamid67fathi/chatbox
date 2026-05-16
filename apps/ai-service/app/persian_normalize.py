"""Persian text normalization for retrieval and matching."""

from __future__ import annotations

import re
import unicodedata

_ARABIC_TO_PERSIAN = str.maketrans(
    {
        "\u0643": "\u06a9",  # ك -> ک
        "\u064a": "\u06cc",  # ي -> ی
        "\u0649": "\u06cc",  # ى
    }
)
_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
_ARABIC_INDIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_MULTI_SPACE = re.compile(r"\s+")


def normalize_persian(text: str) -> str:
    """Normalize Persian/Arabic variants, digits, ZWNJ, and whitespace."""
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text.strip())
    t = t.translate(_ARABIC_TO_PERSIAN)
    t = t.translate(_PERSIAN_DIGITS).translate(_ARABIC_INDIC_DIGITS)
    # Half-space (ZWNJ) -> regular space for broader recall
    t = t.replace("\u200c", " ")
    t = _MULTI_SPACE.sub(" ", t)
    return t.strip()
