import { validationError } from "./errors.js";

export interface AttachmentInput {
	url: string;
	name: string;
	mime_type?: string;
	mimeType?: string;
	size_bytes?: number;
	sizeBytes?: number;
	type?: "image" | "file";
	id?: string;
}

export function normalizeAttachments(raw: unknown): AttachmentInput[] | null {
	if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
	const out: AttachmentInput[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const o = item as Record<string, unknown>;
		const url = typeof o.url === "string" ? o.url : "";
		const name = typeof o.name === "string" ? o.name : "file";
		if (!url.startsWith("/uploads/")) continue;
		out.push({
			id: typeof o.id === "string" ? o.id : undefined,
			url,
			name,
			mime_type:
				typeof o.mime_type === "string"
					? o.mime_type
					: typeof o.mimeType === "string"
						? o.mimeType
						: "application/octet-stream",
			size_bytes:
				typeof o.size_bytes === "number"
					? o.size_bytes
					: typeof o.sizeBytes === "number"
						? o.sizeBytes
						: 0,
			type: o.type === "image" ? "image" : "file",
		});
	}
	return out.length > 0 ? out : null;
}

export function resolveMessageType(
	type: string | undefined,
	attachments: AttachmentInput[] | null,
): "text" | "image" | "file" {
	if (type === "image" || type === "file" || type === "text") {
		return type;
	}
	if (attachments?.[0]?.type === "image") return "image";
	if (attachments && attachments.length > 0) return "file";
	return "text";
}

export function validateMessagePayload(body: {
	body?: string;
	type?: string;
	attachments?: unknown;
}) {
	const attachments = normalizeAttachments(body.attachments);
	const hasBody = Boolean(body.body?.trim());
	const hasAttachments = Boolean(attachments?.length);

	if (!hasBody && !hasAttachments) {
		throw validationError("body or attachments is required.");
	}

	const msgType = resolveMessageType(body.type, attachments);
	return {
		body: body.body?.trim() || attachments?.[0]?.name || "",
		type: msgType,
		attachments,
	};
}
