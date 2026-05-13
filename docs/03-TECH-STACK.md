# 🧰 سند Tech Stack

> Chat-Box — انتخاب تکنولوژی‌ها با دلایل، trade-offها و جایگزین‌ها  
> ورژن 1.1 · مه 2026

**میزبان مرجع:** توسعه و استقرار (لانچ) در مخزن و اسناد همراه، روی **Ubuntu Desktop یا Server 22.04/24.04 LTS** فرض شده است؛ دستورات عملیاتی با **bash** روی اوبونتو هم‌راستا هستند ([`15-DEVELOPMENT-GUIDE-FA.md`](./15-DEVELOPMENT-GUIDE-FA.md)، [`14-INFRASTRUCTURE.md`](./14-INFRASTRUCTURE.md)).

---

## 1. فلسفه انتخاب

سه معیار اصلی برای هر تصمیم:

| معیار | وزن | چرا |
|---|---|---|
| **سرعت توسعه با Solo + AI Agent** | ۴۰٪ | تیم کوچک است؛ هر ابزار باید LLM-friendly باشد |
| **هزینه عملیاتی پایین در ایران** | ۳۰٪ | تحریم، نوسان ارز، زیرساخت محدود |
| **بلوغ + اکوسیستم** | ۳۰٪ | hire-ability، StackOverflow، Vendor support |

از انتخاب‌های **bleeding-edge** و **hype-driven** پرهیز می‌کنیم مگر دلیل قوی داشته باشیم.

---

## 2. خلاصه Stack در یک نگاه

| لایه | انتخاب | جایگزین رد شده | چرا انتخاب شد |
|---|---|---|---|
| Runtime — Backend | **Node.js 20 LTS** | Go, Bun, Deno | بزرگ‌ترین eco برای real-time، LLM-friendly |
| Framework — Backend | **Fastify 4** | NestJS, Express, Hono | سریع‌ترین، schema-first، Zod-native |
| Runtime — AI | **Python 3.12** | Node + LangChain.js | اکوسیستم AI/ML غنی‌تر، Unstructured/LangChain اصلی پایتون |
| Framework — AI | **FastAPI + LangChain** | Flask, Django REST | async، type-safe، LangChain integration |
| Frontend — Dashboard | **Next.js 14 (App Router)** | Remix, SvelteKit, Nuxt | بهترین SEO/SSR + RSC، اکوسیستم بزرگ |
| Frontend — Widget | **Vanilla TS + Web Components** | React widget | Bundle size < 30KB حیاتی است |
| Mobile | **React Native 0.74 (Expo)** | Flutter, Native | تیم single-stack، OTA updates |
| Real-time | **Socket.io 4 + Redis adapter** | Native WS, SSE, ws + uWS | reconnect/rooms/auth out of the box |
| Database — OLTP | **PostgreSQL 16** | MySQL, MongoDB | JSONB + RLS + pgvector + بلوغ |
| Database — Analytics | **ClickHouse 24** | TimescaleDB, BigQuery | self-host، سرعت بی‌نظیر، فشرده‌سازی |
| Search | **Postgres FTS** (فاز ۱) → Elasticsearch (فاز ۲) | Meilisearch, Typesense | شروع ساده، مهاجرت با حجم |
| Cache + Queue | **Redis 7 (cluster)** | Memcached, Hazelcast | Pub/Sub + Streams + JSON همه باهم |
| Message Bus | **Redpanda** (Kafka API) | Kafka, NATS | سبک‌تر از Kafka، Kafka-compatible |
| Job Queue | **BullMQ** | Temporal, Bree, RabbitMQ | Redis-based، retry/cron/repeat |
| ORM — Node | **Drizzle ORM** | Prisma, TypeORM, Knex | type-safe، SQL-honest، migration ساده |
| ORM — Python | **SQLAlchemy 2.0 (async)** | Tortoise, SQLModel | بالغ‌ترین، RLS-friendly |
| Vector DB | **PostgreSQL + pgvector** (فاز ۱) → Qdrant (فاز ۲) | Pinecone, Weaviate, Milvus | شروع با Postgres، migrate وقتی scale |
| Object Storage | **MinIO** (self-host) | S3, R2, B2 | داده در ایران؛ S3 API compatible |
| Container Orchestration | **Kubernetes (K3s در ایران)** | Docker Swarm, Nomad, ECS | استاندارد صنعتی، K3s سبک‌تر برای DC کوچک |
| CI/CD | **GitHub Actions + ArgoCD** | GitLab CI, Jenkins | GitOps پیشنهادی Kubernetes |
| API Gateway | **Traefik 3** | Kong, Nginx, Envoy | configuration declarative، Kubernetes-native |
| Observability | **Grafana Stack (Loki + Tempo + Prom)** | ELK, Datadog, NewRelic | self-host ارزان، یکپارچه |
| Error Tracking | **Sentry (self-hosted)** | Bugsnag, Rollbar | open-source، sourcemap support |
| AI Observability | **Langfuse (self-hosted)** | Helicone, LangSmith | LLM-focused، open-source |
| Auth | **Lucia v3** (built on Oslo) | Auth.js, Clerk, Supabase Auth | کنترل کامل، multi-tenant friendly |
| Payment | **Zarinpal SDK** + **NextPay** (fallback) | IDPay, PayPing | پوشش بازار ایران |
| Email | **Postal (self-host)** + Mailgun (fallback) | SendGrid, AWS SES | داده در ایران، fallback بین‌المللی |
| SMS | **Kavenegar** | Melipayamak, Tinitech | بهترین delivery rate در ایران |
| Push | **FCM + APNs** + custom WebPush | OneSignal, Pusher | بدون وندور وابسته |
| LLM Provider | **OpenAI GPT-4o-mini** (default) + Claude 3.5 Haiku (fallback) + Local Aya-23 (offline) | Cohere, Mistral | کیفیت فارسی + قیمت + redundancy |
| Embeddings | **OpenAI text-embedding-3-small** + bge-m3 (local) | Cohere embed, Voyage | کیفیت فارسی + multilingual |
| Reranker | **Cohere rerank-multilingual-v3** | bge-reranker | تنها reranker قوی برای فارسی |

---

## 3. توضیحات تفصیلی هر انتخاب کلیدی

### 3.1 چرا Node.js و نه Go / Rust؟

**استدلال:**
- **AI Agent بهره‌وری:** Claude/GPT با TS/JS کیفیت کد بسیار بالاتری تولید می‌کنند نسبت به Go/Rust
- **اکوسیستم real-time:** Socket.io، ws، Fastify همه روی Node بالغ‌اند
- **استخدام:** بازار ایران Node-heavy است، Go developer کمتر
- **Productivity-to-Performance ratio:** Fastify می‌تواند ۴۰k req/s بدهد — کافی برای phase 1 (10k workspaces)

**Trade-off پذیرفته‌شده:** ۲–۳ برابر memory نسبت به Go. در ازای آن، سرعت توسعه ۳ برابر.

**کِی reconsider کنیم؟**
- وقتی concurrent WebSocket > 200k در یک node — آن وقت GC pause مشکل می‌شود → پروسه‌ی hotpath را به Go منتقل کنیم

### 3.2 چرا Fastify و نه NestJS / Express؟

| فاکتور | Fastify | NestJS | Express |
|---|---|---|---|
| سرعت | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Schema-first (JSON Schema/Zod) | ✅ بومی | ⚠️ با decorator | ❌ |
| Boilerplate | کم | زیاد | کم |
| Plugin ecosystem | بزرگ | بزرگ‌تر | بزرگ‌ترین (ولی قدیمی) |
| LLM-friendliness | بالا | متوسط (decoratorها confusion ایجاد می‌کنند) | بالا |

**نتیجه:** Fastify بهترین تعادل سرعت/سادگی/تایپ‌ایمنی برای ما.

### 3.3 چرا Python برای AI و نه Node?

- **LangChain Python** بسیار بالغ‌تر از LangChain.js (آخرین قابلیت‌ها اول پایتون می‌آیند)
- **Unstructured.io، LlamaIndex، Haystack** همگی Python-first
- **مدل‌های local (Aya, PersianMind)** با Transformers/vLLM در Python اجرا می‌شوند
- **DSPy، RAGAS، promptlayer** برای evaluation همگی Python

**هزینه:** سرویس polyglot. ولی isolation خوب است — تیم AI روی Python، تیم core روی Node.

### 3.4 چرا PostgreSQL و نه MongoDB / MySQL؟

| Feature | PostgreSQL | MongoDB | MySQL |
|---|---|---|---|
| JSONB | ✅ بومی + indexable | ✅ native | ⚠️ ضعیف‌تر |
| Row-Level Security | ✅ | ❌ | ❌ |
| pgvector (Embeddings) | ✅ | ❌ نیاز به Atlas | ❌ |
| Full-Text Search | ✅ کافی برای فاز ۱ | ⚠️ | ⚠️ |
| Transactions | ✅ ACID قوی | ⚠️ multi-doc محدود | ✅ |
| Hosting در ایران | ✅ همه provider | محدود | ✅ |

**یک DB برای همه‌چیز در فاز ۱**: کاربر/پیام/Vector/Search همه در Postgres. وقتی بیش از ۱۰GB embeddings شد، Qdrant.

### 3.5 چرا ClickHouse برای Analytics؟

- **میلیاردها row با چند گیگ RAM** — برای dashboard analytics ایده‌آل
- **فشرده‌سازی ۱۰x** — هزینه storage پایین
- **MaterializedView برای real-time aggregation**
- **self-host ساده** (یک باینری، بدون JVM)

**جایگزین رد شده:**
- TimescaleDB: فقط time-series، کمی محدودتر
- BigQuery: گران، خارج ایران
- ElasticSearch برای analytics: ضعیف‌تر و گران‌تر

### 3.6 چرا Drizzle و نه Prisma؟

| فاکتور | Drizzle | Prisma |
|---|---|---|
| SQL-honest | ✅ شبیه SQL می‌نویسی | ❌ DSL خودش |
| Bundle size | کوچک | بزرگ (Rust binary) |
| Edge-compatible | ✅ | ⚠️ محدود |
| Migrations | drizzle-kit، ساده | ✅ بالغ |
| Type-safety | عالی | عالی |
| RLS support | راحت | پیچیده |
| AI Agent friendly | ✅ خوانا | ✅ خوانا |

**برنده:** Drizzle بخاطر کنترل بیشتر روی SQL خام (که برای RLS و JSON queries نیاز است).

### 3.7 چرا Redpanda و نه Kafka؟

- **یک باینری**، بدون ZooKeeper، بدون JVM
- **Kafka API compatible** — هر Kafka client کار می‌کند
- **۱۰x ارزان‌تر** در memory
- **سرعت‌های مشابه** برای throughput تا ۱M msg/s

**ریسک:** community کوچک‌تر. ولی production-ready از ۲۰۲۲.

### 3.8 چرا Lucia و نه Auth.js / Clerk؟

- **Auth.js (next-auth):** OAuth-focused، multi-tenant سخت، magic-link حالت default
- **Clerk:** SaaS خارجی، گران، در ایران لاگین OAuth Google کار نمی‌کند
- **Supabase Auth:** قفل به Supabase
- **Lucia:** کتابخانه است، نه service. کنترل کامل بر روی sessions، tokens، 2FA

**کِی Clerk معقول می‌شد؟** اگر بازار خارج بود.

### 3.9 چرا Next.js برای Dashboard ولی Vanilla برای Widget؟

**Dashboard:** Next.js
- SEO نیاز نیست ولی RSC + Streaming برای performance خوب است
- اکوسیستم UI (shadcn، Radix) بزرگ
- Operator با اینترنت خوب کار می‌کند

**Widget:** Vanilla TS + Web Components
- روی سایت‌های ضعیف باید لود شود (Bundle size باید < 30KB)
- نباید با React سایت host مشتری clash داشته باشد
- Web Components ایزوله می‌کنند (Shadow DOM)

---

## 4. ابزارهای توسعه (Tooling)

| دسته | ابزار | نسخه |
|---|---|---|
| Package Manager | **pnpm** | 9.x |
| Monorepo | **Turborepo** | 2.x |
| Bundler — Apps | **Next.js built-in (Turbopack)** | — |
| Bundler — Widget | **tsup** | 8.x |
| Linter | **Biome** (replace ESLint+Prettier) | 1.x |
| Type checker | **TypeScript 5.4 strict** | — |
| Test — Unit | **Vitest** | 1.x |
| Test — E2E | **Playwright** | 1.x |
| Test — Load | **k6** | — |
| API Mock | **MSW** | 2.x |
| Schema | **Zod** | 3.x |
| Date | **date-fns + date-fns-jalali** | — |
| Forms | **react-hook-form + Zod** | — |
| UI Library | **shadcn/ui + Radix** | — |
| Tailwind | **Tailwind 3.4 + tailwindcss-rtl** | — |
| Icons | **Lucide React** | — |
| State (Dashboard) | **Zustand + TanStack Query 5** | — |

### چرا Biome به جای ESLint + Prettier?

- **یک ابزار، نه دو تا**
- ۲۵x سریع‌تر از ESLint
- پیکربندی ۹۰٪ ساده‌تر
- AI Agent راحت‌تر می‌نویسد (config کم)

**Trade-off:** کمتر از ESLint rule دارد. ولی برای پروژه‌ی ما کافی است.

---

## 5. سرویس‌های شخص ثالث

| سرویس | استفاده | پلن اولیه | هزینه تخمینی ماه ۱ |
|---|---|---|---|
| OpenAI API | LLM | Pay-as-you-go | $50–200 |
| Anthropic API | Fallback LLM | Pay-as-you-go | $20 |
| Cohere | Rerank + Embed | Production tier | $30 |
| Zarinpal | Payment | — | کارمزد ۲٪ |
| Kavenegar | SMS | — | ۲۰۰ ت/پیامک |
| آروان ابر | Server + CDN | Custom | ۱۰M تومان |
| Hetzner | EU DR | CPX31 | €18 |
| Sentry self-host | Errors | docker | $0 |
| GitHub | Code + CI | Team | $4/user |
| Cloudflare | DNS + WAF | Free → Pro | $20 |

**کل ماه ۱:** ~ ۱۲–۱۵M تومان infra + $150 ارز

---

## 6. تصمیم‌های آینده (Open Questions)

| سؤال | تصمیم تا کِی | معیار |
|---|---|---|
| مهاجرت به Qdrant؟ | ماه ۶ | اگر embeddings > 5M vectors شد |
| اضافه‌کردن Elasticsearch؟ | ماه ۹ | اگر FTS Postgres slow شد روی > 10M messages |
| مهاجرت بخش hot به Go؟ | ماه ۱۲ | اگر concurrent WS > 200k در یک node |
| محصول جدا برای WhatsApp؟ | ماه ۸ | بعد از validation Telegram |
| مدل local fine-tune شده؟ | ماه ۹ | اگر هزینه LLM > ۳۰٪ revenue |

---

## 7. ابزارهایی که آگاهانه **انتخاب نکردیم**

| ابزار | چرا نه |
|---|---|
| **Supabase** | قفل platform، در ایران مشکل دسترسی |
| **Vercel** | hosting در خارج، Edge function نیاز نیست برای ما |
| **GraphQL** | overkill برای MVP، REST + WebSocket کافی است |
| **tRPC** | فقط TypeScript، نمی‌تواند widget public API ما باشد |
| **Prisma** | bundle size + edge limitations |
| **Hasura** | قفل به engine، schema-first ما با Drizzle راحت‌تر |
| **NestJS** | boilerplate زیاد، AI Agent confused می‌شود |
| **MongoDB** | بدون RLS، JSONB Postgres کافی است |
| **Redis Stack JSON** | احتیاج نیست، Postgres JSONB کفایت می‌کند |
| **AWS** | قابل دسترسی نیست از ایران، vendor lock-in |

---

## 8. مرجع‌های مرتبط

- [`02-ARCHITECTURE.md`](./02-ARCHITECTURE.md) — کجای معماری هر کدام را استفاده می‌کنیم
- [`04-DATABASE-SCHEMA.md`](./04-DATABASE-SCHEMA.md) — جزئیات استفاده Postgres
- [`07-PROJECT-STRUCTURE.md`](./07-PROJECT-STRUCTURE.md) — چگونه monorepo را با این ابزارها سازماندهی می‌کنیم
