from app.language import detect_language, normalize_lang


def test_normalize_lang():
    assert normalize_lang("fa-IR") == "fa"
    assert normalize_lang("en-US") == "en"
    assert normalize_lang("ar") == "ar"


def test_detect_persian():
    lang, conf = detect_language("سلام، وضعیت سفارش من چیست؟", "fa")
    assert lang == "fa"
    assert conf > 0


def test_detect_english():
    lang, _ = detect_language("Hello, what is my order status?", "fa")
    assert lang == "en"
