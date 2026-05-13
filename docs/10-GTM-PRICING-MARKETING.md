# 📣 GTM, Pricing & Marketing — Chat-Box

> **نسخه:** 1.0 · مه 2026  
> **مالک سند (نقش):** GTM / Marketing — بدون تغییر یک‌طرفهٔ منطق auth/billing در کد

---

## خلاصهٔ استراتژی (فارسی)

**ICP فاز ۱:** کسب‌وکارهای آنلاین کوچک–متوسط ایران با حجم مکالمه متوسط و نیاز به پاسخ سریع قبل از خرید. **پیام اصلی:** «پشتیبانی ۲۴/۷ با AI؛ فقط موارد حساس به شما می‌رسد.» کانال‌های اول: SEO فارسی، محتوای آموزشی کوتاه، همکاری با آژانس‌های ووکامرس/فروشگاه‌ساز.

---

## Machine-readable (English)

```yaml
gtm_doc_id: 10-GTM-PRICING-MARKETING
icp_primary: iranian_smb_ecommerce
channels_mvp:
  - seo_fa_longtail
  - wordpress_woocommerce_communities
  - founder_led_linkedin_fa
pricing_model: hybrid_seat_plus_tier
plans:
  free:
    limits: { agents: 1, monthly_conversations: 200, ai_credits: "low" }
  pro:
    limits: { agents: 5, monthly_conversations: 5000, ai_credits: "medium" }
  business:
    limits: { agents: 25, monthly_conversations: 25000, ai_credits: "high" }
activation_definition: widget_installed_and_first_visitor_message_within_7_days
north_star_metric: paid_workspaces_with_mrr_gt_zero
```

> **توجه:** اعداد پلن نهایی محصول در PRD و کد billing باید هم‌تراز شوند؛ این جدول **پیشنهاد اولیه** است.

---

## بسته‌بندی پیشنهادی (ریال / ماه) — قابل بازنگری توسط Product

| پلن | مخاطب | جایگاه قیمت (تومان ماه) | یادداشت |
|-----|--------|-------------------------|---------|
| Free | آزمایش و نصب ویجت | ۰ | محدودیت سخت AI برای کنترل هزینه |
| Pro | فروشگاه‌های کوچک | ۲۹۹٬۰۰۰ – ۴۹۹٬۰۰۰ | تناسب با پرسونای «نازنین» |
| Business | تیم پشتیبانی | ۱٫۵M – ۳M | نزدیک پرسونای «امیر» |

**Annual discount پیشنهادی:** ۱۵٪ تخفیف سالانه برای بهبود cash flow.

---

## پیام‌های کلیدی (فارسی — برای لندینگ)

1. **AI-Native:** از اول برای پاسخ خودکار و Copilot ساخته شده، نه افزونهٔ جدا.  
2. **فارسی و RTL واقعی:** نه ترجمهٔ انگلیسی.  
3. **تلگرام و درگاه محلی:** همسو با عادت پرداخت و ارتباط ایران.

---

## قیف بازاریابی و اندازه‌گیری

| مرحله | معیار پیشنهادی |
|--------|-----------------|
| آگاهی | بازدید لندینگ، جستجوی برند |
| علاقه | ثبت‌نام workspace |
| فعال‌سازی | ویجت زنده + اولین مکالمه |
| درآمد | اولین پرداخت موفق |

---

## نقش‌ها و حدود مسئولیت

| نقش | در این سند |
|-----|------------|
| GTM / Marketing | مالک messaging، کانال، جدول پلن پیشنهادی |
| Product | تأیید نهایی محدودیت‌ها و هم‌ترازی با PRD |
| Engineering | پیاده‌سازی درگاه و محدودیت‌ها — خارج از متن این سند جزئیات فنی |

---

## مرجع‌های مرتبط

- [`01-PRD.md`](./01-PRD.md) — Persona و MVP scope  
- [`08-ROADMAP.md`](./08-ROADMAP.md) — فاز تحویل  
- [`11-SECURITY-PRIVACY.md`](./11-SECURITY-PRIVACY.md) — متن حریم خصوصی و retention
