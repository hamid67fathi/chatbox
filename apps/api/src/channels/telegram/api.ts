const TELEGRAM_API = "https://api.telegram.org";

interface TelegramApiResponse<T> {
	ok: boolean;
	description?: string;
	result?: T;
}

async function telegramRequest<T>(
	botToken: string,
	method: string,
	body?: Record<string, unknown>,
): Promise<T> {
	const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
	const res = await fetch(url, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = (await res.json()) as TelegramApiResponse<T>;
	if (!json.ok) {
		throw new Error(json.description ?? `Telegram ${method} failed`);
	}
	return json.result as T;
}

export interface TelegramBotUser {
	id: number;
	is_bot: boolean;
	first_name: string;
	username?: string;
}

export async function telegramGetMe(botToken: string): Promise<TelegramBotUser> {
	return telegramRequest<TelegramBotUser>(botToken, "getMe");
}

export async function telegramSetWebhook(
	botToken: string,
	webhookUrl: string,
	secretToken: string,
): Promise<boolean> {
	return telegramRequest<boolean>(botToken, "setWebhook", {
		url: webhookUrl,
		secret_token: secretToken,
		allowed_updates: ["message"],
		drop_pending_updates: true,
	});
}

export async function telegramDeleteWebhook(botToken: string): Promise<boolean> {
	return telegramRequest<boolean>(botToken, "deleteWebhook", {
		drop_pending_updates: true,
	});
}

export async function telegramSendMessage(
	botToken: string,
	chatId: number,
	text: string,
): Promise<void> {
	const trimmed = text.trim();
	if (!trimmed) return;
	await telegramRequest(botToken, "sendMessage", {
		chat_id: chatId,
		text: trimmed.slice(0, 4096),
	});
}
