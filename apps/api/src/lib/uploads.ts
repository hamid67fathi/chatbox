import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { validationError } from "./errors.js";
import {
	assertCanUpload,
	notifyPlanUsageIfNeeded,
	recordUploadBytes,
} from "./plan-limits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const UPLOAD_ROOT = resolve(
	process.env.UPLOAD_DIR ?? join(__dirname, "../../uploads"),
);

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024);

const IMAGE_MIMES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
]);

const FILE_MIMES = new Set(["application/pdf", "text/plain"]);

export interface StoredAttachment {
	id: string;
	url: string;
	name: string;
	mime_type: string;
	size_bytes: number;
	type: "image" | "file";
}

function extFromMime(mime: string): string {
	switch (mime) {
		case "image/jpeg":
			return ".jpg";
		case "image/png":
			return ".png";
		case "image/gif":
			return ".gif";
		case "image/webp":
			return ".webp";
		case "application/pdf":
			return ".pdf";
		case "text/plain":
			return ".txt";
		default:
			return "";
	}
}

export function attachmentMessageType(mime: string): "image" | "file" {
	return IMAGE_MIMES.has(mime) ? "image" : "file";
}

export async function saveWorkspaceUpload(
	workspaceId: string,
	file: { filename: string; mimetype: string; buffer: Buffer },
): Promise<StoredAttachment> {
	const mime = file.mimetype?.toLowerCase() ?? "";
	if (!IMAGE_MIMES.has(mime) && !FILE_MIMES.has(mime)) {
		throw validationError(
			"File type not allowed. Use JPEG, PNG, GIF, WebP, PDF, or TXT.",
			"mimetype",
		);
	}

	if (file.buffer.length > MAX_UPLOAD_BYTES) {
		throw validationError(
			`File too large (max ${MAX_UPLOAD_BYTES} bytes).`,
			"file",
		);
	}

	await assertCanUpload(workspaceId, file.buffer.length);

	const safeBase = (file.filename || "file")
		.replace(/[^\w.\-()\s]/g, "_")
		.slice(0, 120);
	const ext = extname(safeBase) || extFromMime(mime);
	const id = randomUUID();
	const storedName = `${id}${ext}`;
	const relDir = workspaceId;
	const absDir = join(UPLOAD_ROOT, relDir);
	await mkdir(absDir, { recursive: true });
	await writeFile(join(absDir, storedName), file.buffer);
	await recordUploadBytes(workspaceId, file.buffer.length);
	void notifyPlanUsageIfNeeded(workspaceId);

	const type = attachmentMessageType(mime);
	return {
		id,
		url: `/uploads/${relDir}/${storedName}`,
		name: safeBase || storedName,
		mime_type: mime,
		size_bytes: file.buffer.length,
		type,
	};
}
