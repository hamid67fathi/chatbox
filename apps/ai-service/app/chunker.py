"""Text chunking using LangChain's RecursiveCharacterTextSplitter."""

from langchain_text_splitters import RecursiveCharacterTextSplitter

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", ".", "؟", "!", "،", " "],
)


def chunk_text(text: str) -> list[str]:
    return _splitter.split_text(text)
