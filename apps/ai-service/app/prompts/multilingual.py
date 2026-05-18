"""Per-language prompt templates for RAG and router stubs."""

from __future__ import annotations

from ..language import normalize_lang

RAG_SYSTEM: dict[str, str] = {
	"fa": """شما دستیار هوشمند پشتیبانی هستید. بر اساس اطلاعات زیر به سوال کاربر پاسخ دهید.
اگر مطمئن نیستید، بگویید «نیاز به بررسی بیشتر دارم».
فقط به فارسی پاسخ دهید.""",
	"en": """You are an intelligent support assistant. Answer the user's question using the context below.
If unsure, say you need further review.
Reply only in English.""",
	"ar": """أنت مساعد دعم ذكي. أجب على سؤال المستخدم بناءً على المعلومات أدناه.
إذا لم تكن متأكداً، قل أنك تحتاج إلى مراجعة إضافية.
أجب بالعربية فقط.""",
}

CHITCHAT: dict[str, dict[str, str]] = {
	"fa": {
		"thanks": "خواهش می‌کنم! اگر سوال دیگری دارید در خدمتم.",
		"bye": "خداحافظ! روز خوبی داشته باشید.",
		"default": "سلام! چطور می‌توانم کمکتان کنم؟",
	},
	"en": {
		"thanks": "You're welcome! Let me know if you have more questions.",
		"bye": "Goodbye! Have a great day.",
		"default": "Hello! How can I help you today?",
	},
	"ar": {
		"thanks": "عفواً! إذا كان لديك المزيد من الأسئلة فأنا هنا.",
		"bye": "مع السلامة! أتمنى لك يوماً سعيداً.",
		"default": "مرحباً! كيف يمكنني مساعدتك؟",
	},
}

OFF_TOPIC: dict[str, str] = {
	"fa": (
		"متأسفم، فقط در زمینه پشتیبانی و خدمات مربوط به این سامانه می‌توانم کمک کنم. "
		"لطفاً سوال خود را در همین زمینه بپرسید."
	),
	"en": (
		"Sorry, I can only help with support topics related to this service. "
		"Please ask your question in that scope."
	),
	"ar": (
		"عذراً، يمكنني المساعدة فقط في مواضيع الدعم المتعلقة بهذه الخدمة. "
		"يرجى طرح سؤالك في هذا الإطار."
	),
}

TRANSACTIONAL: dict[str, str] = {
	"fa": (
		"درخواست شما نیاز به پیگیری توسط تیم پشتیبانی دارد. "
		"هم‌اکنون شما را به اپراتور وصل می‌کنیم."
	),
	"en": (
		"Your request needs follow-up from our support team. "
		"We are connecting you to an agent now."
	),
	"ar": (
		"طلبك يحتاج إلى متابعة من فريق الدعم. "
		"نقوم بتوصيلك بمشغل الآن."
	),
}

COMPLAINT: dict[str, str] = {
	"fa": "از ناراحتی شما متأسفیم. مورد شما برای بررسی فوری به اپراتور ارجاع داده شد.",
	"en": "We're sorry for the inconvenience. Your case has been escalated to an agent.",
	"ar": "نعتذر عن الإزعاج. تم إحالة حالتك إلى مشغل للمراجعة الفورية.",
}


def get_rag_system_prompt(lang: str) -> str:
	code = normalize_lang(lang, "fa")
	return RAG_SYSTEM.get(code, RAG_SYSTEM["fa"])


def get_chitchat_reply(lang: str, question: str) -> str:
	code = normalize_lang(lang, "fa")
	pack = CHITCHAT.get(code, CHITCHAT["fa"])
	q = question.strip().lower()
	if any(w in q for w in ("ممنون", "متشکر", "مرسی", "thanks", "thank", "شكر", "شكرا")):
		return pack["thanks"]
	if any(w in q for w in ("خداحافظ", "bye", "شب بخیر", "مع السلامة", "وداع")):
		return pack["bye"]
	return pack["default"]


def get_off_topic_reply(lang: str) -> str:
	code = normalize_lang(lang, "fa")
	return OFF_TOPIC.get(code, OFF_TOPIC["fa"])


def get_transactional_reply(lang: str) -> str:
	code = normalize_lang(lang, "fa")
	return TRANSACTIONAL.get(code, TRANSACTIONAL["fa"])


def get_complaint_reply(lang: str) -> str:
	code = normalize_lang(lang, "fa")
	return COMPLAINT.get(code, COMPLAINT["fa"])
