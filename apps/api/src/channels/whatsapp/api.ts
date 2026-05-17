const GRAPH_API = "https://graph.facebook.com/v21.0";

interface GraphResponse {
	error?: { message?: string };
}

export async function whatsappGetPhoneNumber(
	phoneNumberId: string,
	accessToken: string,
): Promise<{ display_phone_number?: string }> {
	const url = `${GRAPH_API}/${phoneNumberId}?fields=display_phone_number,verified_name`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	const json = (await res.json()) as GraphResponse & {
		display_phone_number?: string;
	};
	if (!res.ok) {
		throw new Error(json.error?.message ?? "WhatsApp API verify failed");
	}
	return { display_phone_number: json.display_phone_number };
}

export async function whatsappSendText(
	phoneNumberId: string,
	accessToken: string,
	toWaId: string,
	text: string,
): Promise<{ messageId: string }> {
	const trimmed = text.trim().slice(0, 4096);
	if (!trimmed) return { messageId: "" };

	const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messaging_product: "whatsapp",
			to: toWaId.replace(/\D/g, ""),
			type: "text",
			text: { body: trimmed },
		}),
	});

	const json = (await res.json()) as GraphResponse & {
		messages?: { id: string }[];
	};
	if (!res.ok) {
		throw new Error(json.error?.message ?? "WhatsApp send failed");
	}
	return { messageId: json.messages?.[0]?.id ?? "" };
}
