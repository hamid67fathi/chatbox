import type { FastifyInstance } from "fastify";
import { saveWorkspaceUpload } from "../lib/uploads.js";
import { getWorkspaceId } from "../lib/workspace.js";
import { validationError } from "../lib/errors.js";

async function readUploadFile(
	data: { filename: string; mimetype: string; file: NodeJS.ReadableStream },
): Promise<{ filename: string; mimetype: string; buffer: Buffer }> {
	const chunks: Buffer[] = [];
	for await (const chunk of data.file) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return {
		filename: data.filename,
		mimetype: data.mimetype,
		buffer: Buffer.concat(chunks),
	};
}

export async function uploadRoutes(app: FastifyInstance) {
	app.post(
		"/v1/uploads",
		{ config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const data = await request.file();
			if (!data) throw validationError("file is required.", "file");

			const file = await readUploadFile(data);
			const attachment = await saveWorkspaceUpload(wsId, file);
			return { data: attachment };
		},
	);
}
