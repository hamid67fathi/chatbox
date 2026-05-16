import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { kbDocuments, knowledgeBases } from "../db/schema/index.js";
import { ingestDocument } from "../lib/kb-ingest.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { getWorkspaceId } from "../lib/workspace.js";

const MAX_CONTENT_BYTES = 512_000;

async function getOrCreateDefaultKb(workspaceId: string) {
	const existing = await db.query.knowledgeBases.findFirst({
		where: eq(knowledgeBases.workspaceId, workspaceId),
		orderBy: (t, { asc }) => [asc(t.createdAt)],
	});
	if (existing) return existing;

	const [created] = await db
		.insert(knowledgeBases)
		.values({
			workspaceId,
			name: "پایگاه دانش پیش‌فرض",
			description: "اسناد آموزش AI",
		})
		.returning();
	return created;
}

export async function knowledgeRoutes(app: FastifyInstance) {
	app.get(
		"/v1/knowledge-bases",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			let rows = await db.query.knowledgeBases.findMany({
				where: eq(knowledgeBases.workspaceId, wsId),
				orderBy: (t, { asc }) => [asc(t.createdAt)],
			});
			if (rows.length === 0) {
				const kb = await getOrCreateDefaultKb(wsId);
				rows = [kb];
			}
			return { data: rows };
		},
	);

	app.post<{ Body: { name: string; description?: string } }>(
		"/v1/knowledge-bases",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const { name, description } = request.body ?? {};
			if (!name?.trim()) throw validationError("name is required.", "name");

			const [row] = await db
				.insert(knowledgeBases)
				.values({
					workspaceId: wsId,
					name: name.trim(),
					description: description?.trim() || null,
				})
				.returning();

			return reply.status(201).send(row);
		},
	);

	app.get<{ Params: { kbId: string } }>(
		"/v1/knowledge-bases/:kbId/documents",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const kb = await db.query.knowledgeBases.findFirst({
				where: and(
					eq(knowledgeBases.id, request.params.kbId),
					eq(knowledgeBases.workspaceId, wsId),
				),
			});
			if (!kb) throw notFound("Knowledge base not found.");

			const rows = await db.query.kbDocuments.findMany({
				where: and(
					eq(kbDocuments.kbId, request.params.kbId),
					eq(kbDocuments.workspaceId, wsId),
				),
				orderBy: (t, { desc: d }) => [d(t.createdAt)],
			});

			return { data: rows };
		},
	);

	app.post<{
		Params: { kbId: string };
		Body: { title?: string; filename: string; content: string; source_type?: string };
	}>(
		"/v1/knowledge-bases/:kbId/documents",
		{ preHandler: [requireWorkspace("agent")] },
		async (request, reply) => {
			const wsId = getWorkspaceId(request);
			const { title, filename, content, source_type } = request.body ?? {};

			if (!filename?.trim())
				throw validationError("filename is required.", "filename");
			if (!content?.trim())
				throw validationError("content is required.", "content");

			const sizeBytes = Buffer.byteLength(content, "utf8");
			if (sizeBytes > MAX_CONTENT_BYTES) {
				throw validationError(
					`File too large (max ${MAX_CONTENT_BYTES} bytes).`,
					"content",
				);
			}

			const ext = filename.split(".").pop()?.toLowerCase() ?? "";
			if (!["txt", "md", "markdown"].includes(ext)) {
				throw validationError(
					"Only .txt and .md files are supported for now.",
					"filename",
				);
			}

			const kb = await db.query.knowledgeBases.findFirst({
				where: and(
					eq(knowledgeBases.id, request.params.kbId),
					eq(knowledgeBases.workspaceId, wsId),
				),
			});
			if (!kb) throw notFound("Knowledge base not found.");

			const docTitle = title?.trim() || filename;

			const [doc] = await db
				.insert(kbDocuments)
				.values({
					workspaceId: wsId,
					kbId: kb.id,
					sourceType: source_type ?? "upload",
					title: docTitle,
					filePath: filename,
					status: "uploaded",
					sizeBytes,
					metadata: { content, filename },
				})
				.returning();

			try {
				const { chunkCount } = await ingestDocument(
					wsId,
					kb.id,
					doc.id,
					content,
					docTitle,
				);
				const updated = await db.query.kbDocuments.findFirst({
					where: eq(kbDocuments.id, doc.id),
				});
				return reply.status(201).send(updated ?? { ...doc, chunkCount });
			} catch (err) {
				const failed = await db.query.kbDocuments.findFirst({
					where: eq(kbDocuments.id, doc.id),
				});
				return reply.status(201).send(
					failed ?? {
						...doc,
						status: "failed",
						errorMessage: err instanceof Error ? err.message : String(err),
					},
				);
			}
		},
	);

	app.delete<{ Params: { kbId: string; docId: string } }>(
		"/v1/knowledge-bases/:kbId/documents/:docId",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			const wsId = getWorkspaceId(request);
			const [removed] = await db
				.delete(kbDocuments)
				.where(
					and(
						eq(kbDocuments.id, request.params.docId),
						eq(kbDocuments.kbId, request.params.kbId),
						eq(kbDocuments.workspaceId, wsId),
					),
				)
				.returning();
			if (!removed) throw notFound("Document not found.");
			return { ok: true };
		},
	);

	app.post<{ Params: { kbId: string; docId: string } }>(
		"/v1/knowledge-bases/:kbId/documents/:docId/reindex",
		{ preHandler: [requireWorkspace("agent")] },
		async (request) => {
			const wsId = getWorkspaceId(request);

			const doc = await db.query.kbDocuments.findFirst({
				where: and(
					eq(kbDocuments.id, request.params.docId),
					eq(kbDocuments.kbId, request.params.kbId),
					eq(kbDocuments.workspaceId, wsId),
				),
			});
			if (!doc) throw notFound("Document not found.");

			const stored = doc.metadata as { content?: string } | null;
			const content = stored?.content;
			if (!content) {
				throw validationError(
					"Original content not stored; upload the file again.",
					"content",
				);
			}

			await ingestDocument(wsId, doc.kbId, doc.id, content, doc.title);
			const updated = await db.query.kbDocuments.findFirst({
				where: eq(kbDocuments.id, doc.id),
			});
			return updated;
		},
	);
}
