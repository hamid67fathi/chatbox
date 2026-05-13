# 🏗️ سند معماری سیستم

> Chat-Box — Multi-tenant SaaS Architecture
> ورژن 1.0 · مه 2026

---

## 1. اصول معماری (Architectural Principles)

| # | اصل | پیامد عملی |
|---|---|---|
| 1 | **Event-Driven Core** | همه چیز روی Redis Pub/Sub + Kafka |
| 2 | **Stateless Services** | هر service horizontal scalable |
| 3 | **Multi-tenant by Design** | tenant_id در هر row + RLS |
| 4 | **API-First** | هر feature ابتدا API، بعد UI |
| 5 | **AI as a Service (Internal)** | لایه AI سرویس مستقل با خودش scale می‌شود |
| 6 | **Fail-Open for Reads, Fail-Closed for Writes** | خواندن همیشه، نوشتن فقط تأیید شده |
| 7 | **Iran-first Hosting** | Primary در ایران، DR در اروپا |

---

## 2. نمای کلان (C4 — Level 1: System Context)

```mermaid
C4Context
    title نمای System Context - Chat-Box

    Person(visitor, "بازدیدکننده", "کاربر نهایی سایت مشتری")
    Person(agent, "اپراتور", "کارمند پشتیبانی")
    Person(admin, "Admin Workspace", "صاحب کسب‌وکار")

    System(chatbox, "Chat-Box Platform", "AI-Native Live Chat SaaS")

    System_Ext(openai, "OpenAI / Anthropic", "LLM APIs")
    System_Ext(zarinpal, "Zarinpal", "Payment Gateway")
    System_Ext(telegram, "Telegram Bot API", "Messaging")
    System_Ext(s3, "Object Storage", "Files & Media")
    System_Ext(smtp, "SMTP / SMS", "Notifications")

    Rel(visitor, chatbox, "Chats via Widget", "WSS")
    Rel(agent, chatbox, "Manages chats", "HTTPS/WSS")
    Rel(admin, chatbox, "Configures workspace", "HTTPS")
    Rel(chatbox, openai, "AI inference", "HTTPS")
    Rel(chatbox, zarinpal, "Payments", "HTTPS")
    Rel(chatbox, telegram, "Bot integration", "HTTPS")
    Rel(chatbox, s3, "Stores files", "S3 API")
    Rel(chatbox, smtp, "Sends notifications", "SMTP/REST")
```

---

## 3. نمای داخلی (C4 — Level 2: Container)

```mermaid
flowchart TB
    subgraph Client["👤 Client Layer"]
        WIDGET["Chat Widget<br/>(Vanilla JS, <30KB)"]
        DASH["Agent Dashboard<br/>(Next.js 14)"]
        MOBILE["Mobile App<br/>(React Native)"]
        ADMIN["Admin Panel<br/>(Next.js)"]
    end

    subgraph Edge["🌐 Edge Layer"]
        CDN["CDN<br/>(Arvan + Cloudflare)"]
        LB["Load Balancer<br/>(Nginx)"]
    end

    subgraph Gateway["🚪 API Gateway"]
        GW["API Gateway<br/>(Kong / Traefik)"]
        WSGW["WebSocket Gateway<br/>(Socket.io Cluster)"]
    end

    subgraph Services["⚙️ Microservices"]
        AUTH["Auth Service<br/>(Node/Fastify)"]
        CHAT["Chat Service<br/>(Node/Fastify)"]
        AI["AI Service<br/>(Python/FastAPI)"]
        KB["Knowledge Service<br/>(Python)"]
        BILLING["Billing Service<br/>(Node)"]
        NOTIF["Notification Service<br/>(Node)"]
        ANALYTICS["Analytics Service<br/>(Node)"]
        INTEG["Integration Service<br/>(Node) — Telegram"]
    end

    subgraph Messaging["📨 Messaging Backbone"]
        REDIS["Redis<br/>(Pub/Sub + Cache)"]
        KAFKA["Kafka / Redpanda<br/>(Events)"]
        QUEUE["BullMQ<br/>(Jobs)"]
    end

    subgraph Data["🗄️ Data Layer"]
        PG[("PostgreSQL 16<br/>+ pgvector")]
        CLICK[("ClickHouse<br/>Analytics")]
        ES[("Elasticsearch<br/>Search")]
        S3[("MinIO / S3<br/>Files")]
    end

    WIDGET --> CDN
    DASH --> CDN
    MOBILE --> LB
    ADMIN --> CDN

    CDN --> LB
    LB --> GW
    LB --> WSGW

    GW --> AUTH
    GW --> CHAT
    GW --> BILLING
    GW --> ANALYTICS
    GW --> KB
    GW --> INTEG

    WSGW --> CHAT
    WSGW <--> REDIS

    CHAT --> PG
    CHAT --> REDIS
    CHAT --> KAFKA
    CHAT --> AI

    AI --> PG
    AI --> KB
    AI -.->|External| EXTERNAL["OpenAI / Claude / Cohere"]

    KB --> PG
    KB --> S3

    AUTH --> PG
    AUTH --> REDIS

    BILLING --> PG
    BILLING -.-> ZARINPAL["Zarinpal"]

    NOTIF --> QUEUE
    NOTIF -.-> EXT_SMS["SMS / Email / Push"]

    ANALYTICS --> CLICK
    KAFKA --> ANALYTICS
    KAFKA --> NOTIF

    INTEG --> CHAT
    INTEG -.-> TG["Telegram"]
```

---

## 4. تشریح سرویس‌ها

### 4.1 Auth Service
- **مسئولیت:** Signup, Login (OTP/Password), JWT, 2FA, Sessions, RBAC
- **زبان/فریمورک:** Node.js + Fastify
- **DB:** PostgreSQL (users, sessions, tokens)
- **Scale:** stateless, behind LB
- **Endpoints:** `/auth/*`

### 4.2 Chat Service (هسته سیستم)
- **مسئولیت:** پیام‌رسانی، Conversation lifecycle، Assignment، typing/read receipts
- **زبان/فریمورک:** Node.js + Fastify + Socket.io
- **DB:** PostgreSQL (conversations, messages), Redis (online state)
- **Pub/Sub:** Redis (real-time fan-out), Kafka (durable event log)
- **Scale:** N replicas + Redis Adapter for Socket.io

### 4.3 AI Service ⭐ (تمایز اصلی)
- **مسئولیت:**
  - تولید پاسخ به مشتری (RAG-based)
  - پیشنهاد پاسخ به اپراتور (Copilot)
  - دسته‌بندی intent، تشخیص sentiment
  - خلاصه‌سازی مکالمه
- **زبان/فریمورک:** Python + FastAPI + LangChain
- **مدل‌ها:** GPT-4o-mini (default), GPT-4o (premium tier), Local Persian model (fallback)
- **Vector DB:** PostgreSQL + pgvector (در فاز ۱)، Qdrant (در فاز ۲)
- **Scale:** stateless, GPU-optional

### 4.4 Knowledge Service
- **مسئولیت:** Ingest URL/PDF/Docx → Chunk → Embed → ذخیره
- **زبان/فریمورک:** Python + FastAPI + Unstructured.io
- **Job Queue:** BullMQ برای crawling

### 4.5 Billing Service
- **مسئولیت:** Subscription، Invoice، درگاه پرداخت، Trial، Grace
- **زبان/فریمورک:** Node.js + Fastify
- **Webhook:** Zarinpal callbacks

### 4.6 Notification Service
- **مسئولیت:** Email (SMTP)، SMS (Kavenegar)، Push (FCM/APNs)، In-app
- **زبان/فریمورک:** Node.js + BullMQ
- **Pattern:** Worker consume از queue

### 4.7 Analytics Service
- **مسئولیت:** ETL از Kafka → ClickHouse، dashboards، export
- **DB:** ClickHouse
- **Pattern:** Streaming ingestion

### 4.8 Integration Service
- **مسئولیت:** Telegram bot lifecycle، webhook دریافت، فرمت‌سازی
- **زبان/فریمورک:** Node.js + grammy.js

---

## 5. جریان پیام ریل‌تایم (Sequence Diagram)

### سناریو: بازدیدکننده پیامی می‌فرستد و AI پاسخ می‌دهد

```mermaid
sequenceDiagram
    actor V as Visitor
    participant W as Widget
    participant WSGW as WS Gateway
    participant CS as Chat Service
    participant PG as PostgreSQL
    participant R as Redis Pub/Sub
    participant AI as AI Service
    participant KB as Knowledge Base
    participant A as Agent Dashboard

    V->>W: تایپ پیام و enter
    W->>WSGW: emit("message:send", {text})
    WSGW->>CS: forwardMessage(tenantId, convId, text)
    CS->>PG: INSERT INTO messages (...)
    PG-->>CS: message_id
    CS->>R: publish "conv:{id}:message" {payload}
    R-->>WSGW: subscribers receive
    WSGW-->>W: ACK ("message:sent", id)
    WSGW-->>A: emit("inbox:newMessage")

    par AI Auto-Reply
        CS->>AI: requestReply(convId, text, context)
        AI->>KB: searchKnowledge(text)
        KB-->>AI: relevant_chunks[]
        AI->>AI: call LLM (GPT-4o-mini)
        AI-->>CS: reply{text, confidence}
        alt confidence > 0.7
            CS->>PG: INSERT message (sender=AI)
            CS->>R: publish AI reply
            R-->>W: visitor sees reply
        else escalate to human
            CS->>R: publish "conv:assign"
            R-->>A: notify agent
        end
    end
```

---

## 6. الگوهای کلیدی (Patterns)

### 6.1 Multi-Tenant Isolation
- هر row دارای `workspace_id`
- PostgreSQL Row-Level Security (RLS) فعال
- در application layer: middleware `tenantScope()` که هر query را به workspace فعلی محدود می‌کند
- در Redis: key prefix `ws:{id}:*`
- در S3: bucket per region، prefix path `workspaces/{id}/`

### 6.2 Real-time Fan-out
- Socket.io با **Redis Adapter** — همه instance ها به یک channel گوش می‌دهند
- پیام جدید → publish به `conv:{conversation_id}` → همه socket های connected دریافت می‌کنند
- برای presence (online/offline) از `set ws:{id}:online_agents` با TTL

### 6.3 Event Sourcing (سبک)
- هر اکشن مهم (پیام، assign، tag، close) به Kafka publish می‌شود
- Topic: `chatbox.events.v1`
- Consumer ها: Analytics, AI training feed, Audit log
- Format: CloudEvents 1.0 specification

### 6.4 AI Cascade (هزینه + کیفیت)
```
intent classifier (cheap, local model)
        ↓
if FAQ-like → RAG with mini model (GPT-4o-mini)
if complex → reasoning model (GPT-4o)
if confident < threshold → escalate to human
```

### 6.5 Optimistic UI
- پیام در client بلافاصله نمایش داده می‌شود (status: sending)
- بعد از ACK سرور: status: sent
- اگر error: status: failed، retry button

---

## 7. Deployment Topology

```mermaid
flowchart LR
    subgraph IranDC["🇮🇷 Iran DC (Primary)<br/>Arvan / ParsPack"]
        K8S_IR["Kubernetes Cluster<br/>3x Control + 6x Worker"]
        PG_PRIMARY[("PostgreSQL<br/>Primary + 2 Replicas")]
        REDIS_IR["Redis Cluster<br/>3 masters + 3 replicas"]
        S3_IR["MinIO<br/>3 nodes"]
        CLICK_IR["ClickHouse<br/>2 shards × 2 replicas"]
    end

    subgraph EU["🇪🇺 EU DC (DR + AI)<br/>Hetzner"]
        K8S_EU["Kubernetes Cluster<br/>AI Service + Backup"]
        PG_DR[("PostgreSQL<br/>WAL Replica")]
        AI_GPU["AI Service<br/>(GPU optional)"]
    end

    PG_PRIMARY -.->|Async WAL| PG_DR
    K8S_IR -.->|VPN tunnel| K8S_EU
    K8S_IR --> AI_GPU
```

**چرا:**
- داده ایرانی روی خاک ایران (تعهد به مشتری + الزام قانونی)
- AI Service خارج چون API های OpenAI/Anthropic از داخل بسته است → proxy via EU
- Backup در EU برای disaster recovery (سیلاب، قطع برق، ...)

---

## 8. Networking & Security

| لایه | تکنولوژی | یادداشت |
|---|---|---|
| WAF | Cloudflare + Arvan | DDoS، rate limit، bot detection |
| TLS Termination | Nginx Ingress | TLS 1.3، HSTS |
| Auth | JWT (RS256) | Access 15min، Refresh 7 days با rotation |
| Service-to-Service | mTLS + JWT | داخل cluster |
| Secrets | HashiCorp Vault | rotate ماهانه |
| Encryption at rest | AES-256 (LUKS + pg_tde) | |

---

## 9. Observability Stack

| دسته | ابزار | استفاده |
|---|---|---|
| Metrics | Prometheus + Grafana | RED metrics، USE metrics |
| Logs | Loki | structured JSON، correlation_id |
| Tracing | Tempo / Jaeger | OpenTelemetry SDK |
| Error tracking | Sentry (self-hosted) | با sourcemaps |
| Uptime | Uptime Kuma | external probes |
| AI Observability | Langfuse (self-hosted) | تمام prompt/response لاگ |

---

## 10. Failure Modes & Mitigation

| سناریو | تشخیص | پاسخ |
|---|---|---|
| OpenAI API down | error rate spike | switch به Claude، بعد به مدل local |
| PostgreSQL Primary down | health check fail | promote replica (15s RTO) |
| Redis cluster down | timeout | degrade: polling mode (HTTP long-poll fallback) |
| فیلترینگ WebSocket | client reports | fallback به HTTP long-polling روی پورت ۴۴۳ |
| Zarinpal timeout | webhook delayed | grace period ۷۲h + manual reconciliation |
| Telegram API rate limit | 429 | exponential backoff + queue |

---

## 11. مرجع‌های مرتبط

- [03-TECH-STACK.md](./03-TECH-STACK.md) — انتخاب تکنولوژی‌ها
- [04-DATABASE-SCHEMA.md](./04-DATABASE-SCHEMA.md) — Schema جزئیات
- [05-API-SPEC.md](./05-API-SPEC.md) — API
- [06-AI-ARCHITECTURE.md](./06-AI-ARCHITECTURE.md) — جزئیات AI Layer
- [14-INFRASTRUCTURE.md](./14-INFRASTRUCTURE.md) — سرورها، شبکه، کانفیگ و زیرساخت عملیاتی
