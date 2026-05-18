# ChatBox Agent (Mobile)

اپ اپراتور React Native (Expo) برای صندوق ورودی و پاسخ real-time.

## پیش‌نیاز

- Node 20+
- Expo Go روی گوشی، یا Android emulator / iOS simulator
- API در حال اجرا (`pnpm --filter api dev`)

## اجرا

```bash
# از ریشه monorepo
pnpm install
cd apps/mobile
pnpm dev
```

متغیر محیط (اختیاری):

```bash
# .env در apps/mobile
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3001
```

- **Android emulator:** از `http://10.0.2.2:3001` به‌جای localhost استفاده کنید.
- **دستگاه فیزیکی:** IP LAN ماشین توسعه را بگذارید.

## قابلیت‌های MVP (FL-40)

- ورود email/password + 2FA
- لیست مکالمات (inbox)
- نمایش و ارسال پیام با Socket.io
- ذخیره توکن در SecureStore

## بعداً

- Push (FCM/APNs) — FL-32
- چند workspace، فایل، اعلان‌ها
