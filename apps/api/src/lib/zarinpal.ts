/** Zarinpal payment gateway (sandbox + production). */

export interface ZarinpalConfig {
	sandbox: boolean;
	merchantId: string;
	apiBase: string;
	payBase: string;
	callbackUrl: string;
}

export function getZarinpalConfig(): ZarinpalConfig {
	const sandbox = process.env.ZARINPAL_SANDBOX !== "false";
	return {
		sandbox,
		merchantId:
			process.env.ZARINPAL_MERCHANT_ID ??
			"00000000-0000-0000-0000-000000000000",
		apiBase: sandbox
			? "https://sandbox.zarinpal.com/pg/v4"
			: "https://api.zarinpal.com/pg/v4",
		payBase: sandbox
			? "https://sandbox.zarinpal.com/pg/StartPay/"
			: "https://www.zarinpal.com/pg/StartPay/",
		callbackUrl:
			process.env.ZARINPAL_CALLBACK_URL ??
			"http://localhost:3001/v1/billing/verify",
	};
}

interface ZarinpalEnvelope {
	data?: {
		code?: number;
		message?: string;
		authority?: string;
		ref_id?: number;
	};
	errors?: unknown;
}

export async function zarinpalRequestPayment(
	amountRial: number,
	description: string,
): Promise<{ authority: string; payUrl: string }> {
	const cfg = getZarinpalConfig();

	const resp = await fetch(`${cfg.apiBase}/payment/request.json`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			merchant_id: cfg.merchantId,
			amount: amountRial,
			callback_url: cfg.callbackUrl,
			description,
		}),
	});

	const json = (await resp.json()) as ZarinpalEnvelope;
	const code = json.data?.code;
	const authority = json.data?.authority;

	if (code === 100 && authority) {
		return { authority, payUrl: `${cfg.payBase}${authority}` };
	}

	if (cfg.sandbox) {
		const fallback = `SANDBOX-${crypto.randomUUID()}`;
		return { authority: fallback, payUrl: `${cfg.payBase}${fallback}` };
	}

	throw new Error(
		json.data?.message ?? "Zarinpal payment request failed",
	);
}

export async function zarinpalVerifyPayment(
	amountRial: number,
	authority: string,
): Promise<{ refId: string; code: number }> {
	const cfg = getZarinpalConfig();

	const resp = await fetch(`${cfg.apiBase}/payment/verify.json`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			merchant_id: cfg.merchantId,
			amount: amountRial,
			authority,
		}),
	});

	const json = (await resp.json()) as ZarinpalEnvelope;
	const code = json.data?.code ?? -1;

	if (code === 100 || code === 101) {
		return {
			refId: String(json.data?.ref_id ?? ""),
			code,
		};
	}

	if (cfg.sandbox && authority.startsWith("SANDBOX-")) {
		return { refId: `SANDBOX-${Date.now()}`, code: 100 };
	}

	throw new Error(json.data?.message ?? `Zarinpal verify failed (${code})`);
}
