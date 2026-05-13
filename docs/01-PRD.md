# 📋 سند نیازمندی‌های محصول (PRD)

> **Chat-Box** — پلتفرم AI-Native لایو چت برای بازار ایران
> ورژن 1.0 · مه 2026

---

## 1. چشم‌انداز محصول (Vision)

Chat-Box یک پلتفرم SaaS لایو چت است که از روز اول حول **AI Agent بومی** ساخته شده. برخلاف رقبا که AI را به‌عنوان add-on می‌فروشند، در Chat-Box هر مکالمه ابتدا توسط AI پاسخ داده می‌شود و فقط مکالمات پیچیده به اپراتور انسانی escalate می‌شوند.

> **One-liner:** "هر کسب‌وکار ایرانی یک تیم پشتیبانی هوشمند ۲۴/۷ با هزینه ۱/۱۰ تیم انسانی."

### اهداف کسب‌وکار

| افق | هدف |
|---|---|
| ماه ۳ | لانچ MVP عمومی، ۵۰ workspace فعال، ۱۰ مشتری پولی |
| ماه ۶ | ۵۰۰ workspace فعال، ۸۰ پولی، MRR ۸۰M تومان |
| ماه ۱۲ | ۳,۰۰۰ workspace، ۵۰۰ پولی، MRR ۲۵۰M تومان |
| ماه ۲۴ | توسعه به افغانستان/عراق، MRR ۸۰۰M تومان |

---

## 2. مخاطبان هدف (Personas)

### 🟢 Persona 1: «نازنین» — صاحب فروشگاه آنلاین (ICP اصلی)

- ۳۲ ساله، صاحب فروشگاه ووکامرس با ۲۰ سفارش روزانه
- خودش پشتیبانی می‌کند، شب‌ها از واتساپ/تلگرام جواب می‌دهد
- **درد:** نمی‌رسد به سؤالات قبل از خرید پاسخ دهد → از دست رفتن فروش
- **انتظار:** AI شبیه خودش جواب بدهد، فقط در موارد خاص بیدارش کند
- **بودجه:** ۲۰۰–۸۰۰ هزار تومان در ماه

### 🟡 Persona 2: «امیر» — مدیر پشتیبانی SaaS

- ۲۸ ساله، تیم ۵ نفره پشتیبانی یک SaaS B2B دارد
- روزانه ۳۰۰ تیکت دریافت می‌کند، ۶۰٪ سؤالات تکراری
- **درد:** ۶۰٪ زمان تیم صرف سؤالات FAQ می‌شود
- **انتظار:** AI سؤالات سطح ۱ را پاسخ دهد، تیکت‌های سخت به انسان
- **بودجه:** ۲–۵ میلیون تومان در ماه

### 🔵 Persona 3: «دکتر رضایی» — کلینیک پزشکی

- مطب با ۴ پزشک، ۲ منشی
- **درد:** ۸۰٪ تماس‌ها برای نوبت‌گیری و سؤال ساعت ویزیت است
- **انتظار:** بات نوبت بدهد، فقط موارد اورژانس را به منشی پاس بدهد
- **بودجه:** ۱–۳ میلیون تومان در ماه

### 🔴 Persona 4: «اپراتور پشتیبانی» — کاربر داخلی محصول

- ۲۴ ساله، کارمند پشتیبانی، روزی ۸ ساعت با محصول کار می‌کند
- **درد:** پنل‌های موجود کند هستند، typing تأخیر دارد، جستجوی تاریخچه ضعیف است
- **انتظار:** UI سریع، AI Copilot که پیشنهاد پاسخ بدهد، shortcut keyboard

---

## 3. اصول طراحی محصول

| # | اصل | چرا |
|---|---|---|
| 1 | **AI-First, Human-Fallback** | هر مکالمه ابتدا AI، فقط در صورت نیاز انسان |
| 2 | **RTL بومی نه ترجمه** | تمام UI/UX از پایه برای فارسی طراحی شود |
| 3 | **Latency < ۲۰۰ms** | پیام باید زیر ۲۰۰ میلی‌ثانیه delivery شود |
| 4 | **Mobile-First Dashboard** | ۷۰٪ اپراتورهای ایرانی موبایل استفاده می‌کنند |
| 5 | **Iran-Sovereign Data** | داده در سرور ایران، Backup خارج |
| 6 | **Self-Serve First** | تا پلن Enterprise، هیچ‌کس نباید با ما تماس بگیرد |
| 7 | **API + Webhook از روز اول** | حتی در MVP، یکپارچه‌سازی ممکن باشد |

---

## 4. محدوده MVP (Day 1 → Day 90)

### ✅ شامل MVP

#### Core Chat
- [ ] چت ریل‌تایم WebSocket با delivery گارانتی
- [ ] Typing indicator + Read receipts
- [ ] فایل (تصویر، PDF، صوت تا 10MB)
- [ ] تاریخچه نامحدود قابل جستجو
- [ ] Emoji + reaction
- [ ] پاسخ به پیام (reply/quote)

#### Widget
- [ ] ویجت JS Vanilla < 30KB (gzipped)
- [ ] RTL + LTR auto-detect
- [ ] تنظیم رنگ، آواتار، متن خوشامد، position
- [ ] Pre-chat form (نام، ایمیل، تلفن)
- [ ] Trigger بر اساس صفحه / زمان / behavior
- [ ] Mobile-responsive

#### Dashboard اپراتور (Web)
- [ ] Inbox مشترک با sorting و filter
- [ ] Assignment manual + auto (round-robin)
- [ ] جستجوی full-text در مکالمات
- [ ] Tag, Note, Priority
- [ ] Canned responses (با variable مثل {name})
- [ ] Status اپراتور: Online / Away / Offline
- [ ] Keyboard shortcuts

#### 🤖 AI Layer (تمایز اصلی)
- [ ] **AI Auto-Reply:** بات اولیه که از Knowledge Base پاسخ می‌دهد
- [ ] **Knowledge Base Builder:** آپلود سند/URL → ساخت RAG
- [ ] **AI Copilot:** پیشنهاد پاسخ به اپراتور حین مکالمه
- [ ] **Auto-Summarize:** خلاصه مکالمه طولانی برای handoff
- [ ] **Sentiment Detection:** علامت‌گذاری مکالمات منفی
- [ ] **Smart Routing:** هدایت مکالمه به دپارتمان مناسب بر اساس intent

#### Multi-tenant + Auth
- [ ] ثبت‌نام با ایمیل/شماره موبایل (OTP)
- [ ] Workspace (هر کسب‌وکار)
- [ ] دعوت اعضای تیم
- [ ] نقش: Admin, Agent, Viewer
- [ ] 2FA

#### Billing
- [ ] درگاه پرداخت زرین‌پال
- [ ] اشتراک ماهانه و سالانه
- [ ] پلن رایگان + ۲ پلن پولی
- [ ] فاکتور رسمی PDF
- [ ] دوره trial ۱۴ روزه برای پلن پولی

#### Telegram Integration (تنها کانال در MVP)
- [ ] اتصال بات تلگرام به Workspace
- [ ] دریافت پیام تلگرام در Inbox
- [ ] پاسخ از Dashboard
- [ ] AI پاسخگو در تلگرام هم باشد

#### Mobile App اپراتور (React Native)
- [ ] Push notification
- [ ] دیدن و پاسخ به مکالمات
- [ ] AI Copilot روی موبایل

#### Analytics (Basic)
- [ ] تعداد مکالمات، میانگین زمان پاسخ، CSAT
- [ ] گزارش روزانه/هفتگی ایمیل
- [ ] AI Resolution Rate (چه درصد مکالمات بدون انسان حل شد)

#### Admin Panel ما (Internal)
- [ ] لیست workspace ها، metrics
- [ ] قابلیت suspend/refund
- [ ] لاگ سیستم

### ❌ خارج از MVP (Post-launch)

- WhatsApp Business API
- Instagram DM
- Email channel
- Video / Audio call (WebRTC)
- Co-browsing
- Knowledge Base عمومی (مقالات public)
- Workflow Builder بصری
- Marketplace integrations
- White-label
- SSO / SAML
- On-Premise

---

## 5. User Stories کلیدی (نمونه)

### US-001 — بازدیدکننده چت می‌کند

```
As a بازدیدکننده سایت,
I want تا روی آیکن چت کلیک کنم و سؤالم را بپرسم,
So that بتوانم بدون تماس تلفنی پاسخ بگیرم.

Acceptance Criteria:
- ویجت زیر ۲۰۰ms لود شود
- نام و ایمیل قبل از چت پرسیده شود (در صورت تنظیم)
- پیام اول من ظرف ۵ ثانیه پاسخ AI داشته باشد
- در صورت off-topic، AI به اپراتور انسانی escalate کند
- تاریخچه چت ذخیره شود و در بازگشت ادامه‌پذیر باشد
```

### US-002 — اپراتور با AI Copilot کار می‌کند

```
As an اپراتور,
I want هنگام تایپ پاسخ پیشنهاد AI داشته باشم,
So that سریع‌تر و یکنواخت‌تر جواب بدهم.

Acceptance Criteria:
- با Tab پیشنهاد را قبول کنم
- پیشنهاد بر اساس Knowledge Base و تاریخچه‌ی همین مشتری باشد
- زمان پیشنهاد زیر ۸۰۰ms باشد
- پیشنهاد به فارسی صحیح و RTL ارائه شود
```

### US-003 — Admin Knowledge Base را تنظیم می‌کند

```
As an Admin,
I want URL سایتم یا فایل PDF بدهم تا AI ازشان یاد بگیرد,
So that AI بدون آموزش دستی، اطلاعات محصول من را بداند.

Acceptance Criteria:
- URL crawl شود، تا ۵۰۰ صفحه
- PDF/Word تا ۲۰MB پشتیبانی شود
- ساخت RAG ظرف ۵ دقیقه برای ۱۰۰ سند
- Preview بدهد چه چیزی یاد گرفته
- قابلیت override پاسخ AI با Q&A دستی
```

### US-004 — Owner پلن را upgrade می‌کند

```
As یک Workspace Owner,
I want با کارت ایرانی پلن خود را upgrade کنم,
So that بدون VPN و کارت ارزی استفاده کنم.

Acceptance Criteria:
- درگاه زرین‌پال داخل ایران
- فاکتور رسمی PDF با شماره مالیاتی
- در صورت عدم پرداخت ماه بعد، ۷ روز grace period
- email/sms یادآور قبل از انقضا
```

---

## 6. الزامات غیرکارکردی (NFR)

| دسته | الزام | مقدار هدف |
|---|---|---|
| Performance | Widget load time | < 200ms (p95) |
| Performance | Message latency (E2E) | < 200ms (p95) |
| Performance | AI Response time | < 2s (p95) |
| Performance | Dashboard initial load | < 1.5s |
| Scale | Concurrent WebSocket | 50,000+ |
| Scale | Workspaces per cluster | 10,000+ |
| Reliability | Uptime SLA | 99.9% |
| Reliability | Data durability | 99.999999% (8 nines) |
| Security | Encryption at rest | AES-256 |
| Security | TLS | 1.3 |
| Security | Password | bcrypt cost ≥ 12 |
| Compliance | Data residency | Iran (primary), EU (DR) |
| i18n | Languages | FA (default), EN, AR |
| Accessibility | WCAG | 2.1 AA |

---

## 7. ریسک‌ها و محدودیت‌ها

| ریسک | شدت | احتمال | استراتژی کاهش |
|---|---|---|---|
| API هوش مصنوعی دسترسی محدود از ایران | بالا | بالا | استفاده از proxy، fallback به مدل local، Caching سنگین |
| فیلترینگ WebSocket یا پروتکل | بالا | متوسط | استفاده از پورت ۴۴۳ + HTTPS، Polling fallback |
| نوسان ارز روی هزینه AI | بالا | بالا | Caching تهاجمی، مدل سبک‌تر برای queries ساده، AI Credits |
| رقبا (رایچت) کپی سریع | متوسط | بالا | سرعت اجرا، تمرکز روی AI as moat |
| جذب توسعه‌دهنده باتجربه | متوسط | متوسط | استفاده از AI Agent برای کاهش niaz به نیروی انسانی |

---

## 8. معیارهای موفقیت (Success Metrics)

### North Star Metric
**Weekly Active Workspaces (WAW)** — تعداد workspace هایی که حداقل ۵ مکالمه در هفته داشتند.

### KPI های اصلی
- **AI Resolution Rate** ≥ 60% در ماه ۶ (هدف ۸۰٪ در ماه ۱۲)
- **Free → Paid Conversion** ≥ 8% در ماه ۶
- **Monthly Churn** < 5% در ماه ۶
- **NPS** ≥ 40 در ماه ۶

---

## 9. وابستگی‌های خارجی

| وابستگی | اهمیت | جایگزین |
|---|---|---|
| OpenAI API (GPT-4o-mini) | بحرانی | Claude Haiku, مدل local (Aya, PersianMind) |
| Cohere Rerank / Embed | مهم | OpenAI embeddings, مدل bge-m3 local |
| زرین‌پال | بحرانی | آیدی‌پی، پی.آی‌آر |
| سرور ابری ایران (آروان) | بحرانی | پارس‌پک، ابرآسیاتک |
| تلگرام Bot API | بحرانی | بات‌های ایتا/روبیکا (آینده) |

---

## 10. تأییدیه و امضا

این PRD مرجع رسمی محصول است. هر تغییر باید با PR در همین فایل ثبت شود.

| نقش | نام | تاریخ |
|---|---|---|
| CTO / Product | — | — |
| AI Agent Lead | Claude | 1405-02-21 |
