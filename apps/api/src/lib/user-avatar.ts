import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { UPLOAD_ROOT } from "./uploads.js";
import { validationError } from "./errors.js";

const AVATAR_MIMES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
]);

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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
		default:
			return "";
	}
}

/**
 * Store operator avatar under /uploads/avatars/{userId}/.
 */
export async function saveUserAvatar(
	userId: string,
	file: { filename: string; mimetype: string; buffer: Buffer },
): Promise<string> {
	const mime = file.mimetype?.toLowerCase() ?? "";
	if (!AVATAR_MIMES.has(mime)) {
		throw validationError(
			"Avatar must be JPEG, PNG, GIF, or WebP.",
			"mimetype",
		);
	}
	if (file.buffer.length > MAX_AVATAR_BYTES) {
		throw validationError(
			`Avatar too large (max ${MAX_AVATAR_BYTES} bytes).`,
			"file",
		);
	}

	const ext = extname(file.filename) || extFromMime(mime) || ".jpg";
	const storedName = `${randomUUID()}${ext}`;
	const relDir = join("avatars", userId);
	const absDir = join(UPLOAD_ROOT, relDir);
	await mkdir(absDir, { recursive: true });
	await writeFile(join(absDir, storedName), file.buffer);

	return `/uploads/${relDir.replace(/\\/g, "/")}/${storedName}`;
}
