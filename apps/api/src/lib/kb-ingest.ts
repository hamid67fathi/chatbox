import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { kbChunks, kbDocuments } from "../db/schema/index.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const INGEST_TIMEOUT_MS = Number(process.env.KB_INGEST_TIMEOUT_MS ?? 120_000);

export async function ingestDocument(
	workspaceId: string,
	kbId: string,
	documentId: string,
	text: string,
	title?: string | null,
): Promise<{ chunkCount: number }> {
	await db
		.update(kbDocuments)
		.set({ status: "processing", errorMessage: null })
		.where(eq(kbDocuments.id, documentId));

	await db.delete(kbChunks).where(eq(kbChunks.documentId, documentId));

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);

	try {
		const res = await fetch(`${AI_SERVICE_URL}/v1/ingest`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspace_id: workspaceId,
				kb_id: kbId,
				document_id: documentId,
				text,
				title: title ?? undefined,
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			throw new Error(`AI ingest failed: ${res.status} ${errText}`);
		}

		const data = (await res.json()) as { chunk_count: number };
		return { chunkCount: data.chunk_count ?? 0 };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(kbDocuments)
			.set({
				status: "failed",
				errorMessage: message.slice(0, 500),
				chunkCount: 0,
			})
			.where(eq(kbDocuments.id, documentId));
		throw err;
	} finally {
		clearTimeout(timeout);
	}
}

export async function markDocumentUploaded(
	documentId: string,
	meta: { sizeBytes: number; title: string },
) {
	await db
		.update(kbDocuments)
		.set({
			status: "uploaded",
			title: meta.title,
			sizeBytes: meta.sizeBytes,
			chunkCount: 0,
			errorMessage: null,
			lastIndexedAt: null,
		})
		.where(eq(kbDocuments.id, documentId));
}
