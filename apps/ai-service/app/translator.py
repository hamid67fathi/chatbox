"""Optional text translation for KB / multilingual content."""

from __future__ import annotations

from .config import settings
from .language import normalize_lang

_client = None


def _get_client():
	global _client
	if _client is None:
		from openai import OpenAI

		_client = OpenAI(api_key=settings.openai_api_key)
	return _client


async def translate_text(
	text: str,
	target_lang: str,
	*,
	source_lang: str | None = None,
) -> dict:
	target = normalize_lang(target_lang, "fa")
	source_hint = (
		f" from {normalize_lang(source_lang, 'fa')}" if source_lang else ""
	)
	if not text.strip():
		return {"text": "", "model": "none", "target_lang": target}

	if not settings.use_openai:
		return {
			"text": text,
			"model": "stub",
			"target_lang": target,
		}

	lang_names = {"fa": "Persian (Farsi)", "en": "English", "ar": "Arabic"}
	target_name = lang_names.get(target, target)

	client = _get_client()
	response = client.chat.completions.create(
		model=settings.openai_chat_model,
		messages=[
			{
				"role": "system",
				"content": (
					f"Translate the following text{source_hint} into {target_name}. "
					"Preserve meaning and tone. Return only the translation."
				),
			},
			{"role": "user", "content": text[:8000]},
		],
		temperature=0.2,
		max_tokens=4000,
	)
	translated = (response.choices[0].message.content or "").strip()
	return {
		"text": translated,
		"model": settings.openai_chat_model,
		"target_lang": target,
		"input_tokens": response.usage.prompt_tokens if response.usage else 0,
		"output_tokens": response.usage.completion_tokens if response.usage else 0,
	}
