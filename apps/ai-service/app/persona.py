"""Build workspace AI persona blocks for system prompts."""

from __future__ import annotations

TONE_HINTS: dict[str, dict[str, str]] = {
	"formal": {
		"fa": "لحن رسمی و محترمانه داشته باشید. از واژگان اداری استفاده کنید.",
		"en": "Use a formal, respectful tone with professional wording.",
		"ar": "استخدم نبراً رسمياً ومحترماً.",
	},
	"friendly": {
		"fa": "لحن گرم، دوستانه و قابل‌فهم داشته باشید.",
		"en": "Use a warm, friendly, and approachable tone.",
		"ar": "استخدم نبراً ودوداً وودياً.",
	},
	"technical": {
		"fa": "لحن فنی و دقیق داشته باشید؛ اصطلاحات تخصصی را در صورت نیاز به‌کار ببرید.",
		"en": "Use a precise technical tone; use domain terms when helpful.",
		"ar": "استخدم نبراً تقنياً ودقيقاً.",
	},
}


def _lang(persona: dict | None, default: str = "fa") -> str:
	if not persona:
		return default
	lang = persona.get("language") or default
	if lang in ("fa", "en", "ar"):
		return lang
	return default


def build_persona_block(persona: dict | None, lang: str = "fa") -> str:
	if not persona or persona.get("enabled") is False:
		return ""

	code = lang if lang in ("fa", "en", "ar") else "fa"
	parts: list[str] = []

	name = persona.get("name")
	if isinstance(name, str) and name.strip():
		if code == "en":
			parts.append(f"You are the support assistant named {name.strip()}.")
		elif code == "ar":
			parts.append(f"أنت مساعد الدعم باسم {name.strip()}.")
		else:
			parts.append(f"نام شما {name.strip()} است و به عنوان دستیار پشتیبانی پاسخ می‌دهید.")

	tone = persona.get("tone") or "friendly"
	if isinstance(tone, str):
		hint = TONE_HINTS.get(tone, TONE_HINTS["friendly"]).get(code, "")
		if hint:
			parts.append(hint)

	custom = persona.get("custom_instructions")
	if isinstance(custom, str) and custom.strip():
		parts.append(custom.strip()[:2000])

	if not parts:
		return ""
	return "\n".join(parts)


def merge_system_prompt(base: str, persona: dict | None, lang: str = "fa") -> str:
	block = build_persona_block(persona, lang)
	if not block:
		return base
	return f"{base}\n\n{block}"
