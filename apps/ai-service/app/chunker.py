"""Text chunking using LangChain's RecursiveCharacterTextSplitter."""

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .persian_normalize import normalize_persian

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", ".", "؟", "!", "،", " "],
)


def chunk_text(text: str) -> list[str]:
    raw = _splitter.split_text(text)
    out: list[str] = []
    for chunk in raw:
        normalized = normalize_persian(chunk)
        if normalized:
            out.append(normalized)
    return out
