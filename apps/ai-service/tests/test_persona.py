from app.persona import build_persona_block, merge_system_prompt
from app.prompts import get_rag_system_prompt


def test_build_persona_block_friendly():
    block = build_persona_block(
        {
            "enabled": True,
            "name": "Sara",
            "tone": "friendly",
            "custom_instructions": "Keep answers short.",
        },
        "en",
    )
    assert "Sara" in block
    assert "friendly" in block.lower() or "warm" in block.lower()
    assert "short" in block


def test_merge_system_prompt():
    base = get_rag_system_prompt("fa")
    merged = merge_system_prompt(
        base,
        {"enabled": True, "name": "سارا", "tone": "formal"},
        "fa",
    )
    assert "سارا" in merged
    assert len(merged) > len(base)
