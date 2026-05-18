export interface NotificationTemplateInput {
	title: string;
	body: string;
	ctaLabel?: string;
	ctaUrl?: string;
	unsubscribeUrl?: string;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function renderNotificationEmail(input: NotificationTemplateInput): {
	html: string;
	text: string;
} {
	const title = escapeHtml(input.title);
	const body = escapeHtml(input.body).replace(/\n/g, "<br/>");
	const cta =
		input.ctaUrl && input.ctaLabel
			? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(input.ctaLabel)}</a></p>`
			: "";
	const unsub = input.unsubscribeUrl
		? `<p style="margin-top:32px;font-size:12px;color:#6b7280"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280">لغو اشتراک ایمیل</a></p>`
		: "";

	const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Tahoma,'Segoe UI',sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:8px;border:1px solid #e5e7eb">
        <tr><td style="padding:24px">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280">ChatBox</p>
          <h1 style="margin:0 0 16px;font-size:18px;color:#111827">${title}</h1>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#374151">${body}</p>
          ${cta}
          ${unsub}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

	const text = [
		input.title,
		"",
		input.body,
		input.ctaUrl ? `${input.ctaLabel ?? "لینک"}: ${input.ctaUrl}` : "",
		input.unsubscribeUrl ? `لغو اشتراک: ${input.unsubscribeUrl}` : "",
	]
		.filter(Boolean)
		.join("\n");

	return { html, text };
}

export function templateNewConversation(
	contactName: string,
	channel: string,
	inboxUrl: string,
	unsubscribeUrl: string,
) {
	return renderNotificationEmail({
		title: "مکالمه جدید",
		body: `مکالمه‌ای از ${contactName || "مشتری"} در کانال ${channel} شروع شد.`,
		ctaLabel: "مشاهده در صندوق ورودی",
		ctaUrl: inboxUrl,
		unsubscribeUrl,
	});
}

export function templateAssigned(
	contactName: string,
	inboxUrl: string,
	unsubscribeUrl: string,
) {
	return renderNotificationEmail({
		title: "اختصاص مکالمه به شما",
		body: `مکالمه با ${contactName || "مشتری"} به شما اختصاص داده شد.`,
		ctaLabel: "باز کردن مکالمه",
		ctaUrl: inboxUrl,
		unsubscribeUrl,
	});
}

export function templateMention(
	authorName: string,
	notePreview: string,
	inboxUrl: string,
	unsubscribeUrl: string,
) {
	return renderNotificationEmail({
		title: "اشاره در یادداشت تیم",
		body: `${authorName} شما را در یادداشت ذکر کرد:\n${notePreview}`,
		ctaLabel: "مشاهده مکالمه",
		ctaUrl: inboxUrl,
		unsubscribeUrl,
	});
}

export function templateSuspiciousLogin(
	userLabel: string,
	clientIp: string,
	settingsUrl: string,
) {
	return renderNotificationEmail({
		title: "ورود از IP غیرمجاز",
		body: `کاربر ${userLabel} از آدرس IP ${clientIp} وارد داشبورد شد. این IP در لیست مجاز ورک‌اسپیس نیست.`,
		ctaLabel: "تنظیمات امنیت",
		ctaUrl: settingsUrl,
	});
}
