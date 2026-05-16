"use client";

import { Button } from "@/components/ui/button";
import type { KbDocument, KnowledgeBase } from "@/lib/api";
import {
	deleteKbDocument,
	fetchKbDocuments,
	fetchKnowledgeBases,
	reindexKbDocument,
	uploadKbDocument,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
}

const STATUS_LABEL: Record<string, string> = {
	uploaded: "آپلود شد",
	processing: "در حال پردازش",
	indexed: "ایندکس شد",
	failed: "خطا",
};

function statusClass(status: string) {
	switch (status) {
		case "indexed":
			return "bg-primary/10 text-primary";
		case "processing":
			return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
		case "failed":
			return "bg-destructive/10 text-destructive";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function KnowledgePanel({ workspaceId, workspaceRole }: Props) {
	const canUpload =
		workspaceRole === "owner" ||
		workspaceRole === "admin" ||
		workspaceRole === "agent";
	const canDelete = workspaceRole === "owner" || workspaceRole === "admin";
	const fileRef = useRef<HTMLInputElement>(null);
	const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
	const [kbId, setKbId] = useState("");
	const [docs, setDocs] = useState<KbDocument[]>([]);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const [polling, setPolling] = useState(false);

	const reloadDocs = useCallback(() => {
		if (!kbId) return;
		fetchKbDocuments(workspaceId, kbId).then(setDocs);
	}, [workspaceId, kbId]);

	useEffect(() => {
		fetchKnowledgeBases(workspaceId).then((list) => {
			setKbs(list);
			if (list[0]) setKbId(list[0].id);
		});
	}, [workspaceId]);

	useEffect(() => {
		reloadDocs();
	}, [reloadDocs]);

	useEffect(() => {
		if (!polling) return;
		const t = setInterval(reloadDocs, 3000);
		return () => clearInterval(t);
	}, [polling, reloadDocs]);

	useEffect(() => {
		const busy = docs.some((d) => d.status === "processing");
		setPolling(busy);
	}, [docs]);

	async function handleFile(file: File) {
		if (!kbId) return;
		const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
		if (!["txt", "md", "markdown"].includes(ext)) {
			setError("فقط فایل‌های .txt و .md پشتیبانی می‌شوند.");
			return;
		}
		setError("");
		setUploading(true);
		try {
			const content = await file.text();
			const { doc, error: err } = await uploadKbDocument(workspaceId, kbId, {
				filename: file.name,
				title: file.name,
				content,
			});
			if (err) setError(err);
			if (doc) reloadDocs();
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	async function handleReindex(doc: KbDocument) {
		const { error: err } = await reindexKbDocument(workspaceId, kbId, doc.id);
		if (err) setError(err);
		reloadDocs();
	}

	async function handleDelete(doc: KbDocument) {
		if (!confirm(`حذف «${doc.title ?? doc.id}»؟`)) return;
		const ok = await deleteKbDocument(workspaceId, kbId, doc.id);
		if (!ok) setError("حذف ناموفق بود.");
		else reloadDocs();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">پایگاه دانش</h1>
				<p className="text-sm text-muted-foreground">
					آپلود .txt / .md برای پاسخ‌های AI — سرویس AI باید روی پورت ۸۰۰۰ فعال باشد
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
				{kbs.length > 1 && (
					<select
						value={kbId}
						onChange={(e) => setKbId(e.target.value)}
						className="h-9 rounded-md border border-input bg-background px-2 text-sm"
					>
						{kbs.map((kb) => (
							<option key={kb.id} value={kb.id}>
								{kb.name}
							</option>
						))}
					</select>
				)}
				{canUpload && (
					<>
						<input
							ref={fileRef}
							type="file"
							accept=".txt,.md,text/plain,text/markdown"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) void handleFile(f);
							}}
						/>
						<Button
							type="button"
							size="sm"
							disabled={uploading || !kbId}
							onClick={() => fileRef.current?.click()}
						>
							{uploading ? "در حال آپلود…" : "آپلود سند"}
						</Button>
					</>
				)}
			</div>
			{error && (
				<p className="px-6 py-2 text-sm text-destructive">{error}</p>
			)}
			<div className="flex-1 overflow-y-auto p-6">
				{docs.length === 0 ? (
					<p className="text-sm text-muted-foreground">سندی نیست — یک فایل آپلود کنید.</p>
				) : (
					<ul className="space-y-2">
						{docs.map((doc) => (
							<li
								key={doc.id}
								className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"
							>
								<div className="min-w-0">
									<p className="font-medium">{doc.title ?? doc.filePath ?? doc.id}</p>
									<p className="text-xs text-muted-foreground">
										{doc.chunkCount} chunk
										{doc.sizeBytes != null &&
											` · ${Math.round(doc.sizeBytes / 1024)} KB`}
										{doc.lastIndexedAt &&
											` · ${new Date(doc.lastIndexedAt).toLocaleString("fa-IR")}`}
									</p>
									{doc.errorMessage && (
										<p className="mt-1 text-xs text-destructive">{doc.errorMessage}</p>
									)}
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<span
										className={cn(
											"rounded-full px-2 py-0.5 text-xs font-medium",
											statusClass(doc.status),
										)}
									>
										{STATUS_LABEL[doc.status] ?? doc.status}
									</span>
									{canUpload &&
										(doc.status === "indexed" || doc.status === "failed") && (
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => handleReindex(doc)}
										>
											ایندکس مجدد
										</Button>
									)}
									{canDelete && (
										<Button
											type="button"
											size="sm"
											variant="destructive"
											onClick={() => handleDelete(doc)}
										>
											حذف
										</Button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
