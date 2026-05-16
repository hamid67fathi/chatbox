"use client";

import { Input } from "@/components/ui/input";
import type { Conversation, ConversationFilters, Message } from "@/lib/api";
import { fetchConversations } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";

interface Props {
	workspaceId: string;
}

const STATUS_OPTIONS = [
	{ value: "", label: "همه وضعیت‌ها" },
	{ value: "open", label: "باز" },
	{ value: "pending", label: "در انتظار" },
	{ value: "resolved", label: "حل‌شده" },
	{ value: "closed", label: "بسته" },
];

const CHANNEL_OPTIONS = [
	{ value: "", label: "همه کانال‌ها" },
	{ value: "widget", label: "ویجت" },
];

export function Inbox({ workspaceId }: Props) {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [channelFilter, setChannelFilter] = useState("");
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [nextCursor, setNextCursor] = useState<string | null>(null);

	const apiFilters = useMemo((): ConversationFilters => {
		const f: ConversationFilters = { limit: 30 };
		if (statusFilter) f.status = statusFilter;
		if (channelFilter) f.channel = channelFilter;
		return f;
	}, [statusFilter, channelFilter]);

	const reloadConversations = useCallback(() => {
		if (!workspaceId) return;
		fetchConversations(workspaceId, apiFilters).then(({ data, error, page }) => {
			setConversations(data);
			setLoadError(error ?? null);
			setHasMore(page?.has_more ?? false);
			setNextCursor(page?.next_cursor ?? null);
		});
	}, [workspaceId, apiFilters]);

	const loadMore = useCallback(() => {
		if (!workspaceId || !hasMore || loadingMore || !nextCursor) return;
		setLoadingMore(true);
		fetchConversations(workspaceId, { ...apiFilters, cursor: nextCursor }).then(
			({ data, page, error }) => {
				setLoadingMore(false);
				if (error) {
					setLoadError(error);
					return;
				}
				setConversations((prev) => {
					const ids = new Set(prev.map((c) => c.id));
					return [...prev, ...data.filter((c) => !ids.has(c.id))];
				});
				setHasMore(page?.has_more ?? false);
				setNextCursor(page?.next_cursor ?? null);
			},
		);
	}, [workspaceId, apiFilters, hasMore, loadingMore, nextCursor]);

	useEffect(() => {
		reloadConversations();
	}, [reloadConversations]);

	useEffect(() => {
		if (!workspaceId) return;
		const interval = setInterval(reloadConversations, 8000);
		return () => clearInterval(interval);
	}, [workspaceId, reloadConversations]);

	useEffect(() => {
		if (!workspaceId) return;

		const socket = getSocket(workspaceId);

		const onConnected = () => {
			reloadConversations();
		};

		const onConversationNew = (data: { conversation: Conversation }) => {
			setConversations((prev) => {
				if (prev.some((c) => c.id === data.conversation.id)) return prev;
				return [data.conversation, ...prev];
			});
		};

		const onMessageNew = (data: { message: Message }) => {
			const convId = data.message.conversationId;
			setConversations((prev) => {
				const idx = prev.findIndex((c) => c.id === convId);
				if (idx === -1) {
					reloadConversations();
					return prev;
				}
				const next = [...prev];
				next[idx] = { ...next[idx], lastMessageAt: data.message.createdAt };
				next.sort(
					(a, b) =>
						new Date(b.lastMessageAt ?? b.createdAt).getTime() -
						new Date(a.lastMessageAt ?? a.createdAt).getTime(),
				);
				return next;
			});
		};

		const onNeedsHuman = (data: { conversation_id: string }) => {
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversation_id ? { ...c, needsHuman: true } : c,
				),
			);
		};

		socket.on("connected", onConnected);
		socket.on("conversation:new", onConversationNew);
		socket.on("message:new", onMessageNew);
		socket.on("conv:needs_human", onNeedsHuman);

		if (socket.connected) onConnected();

		return () => {
			socket.off("connected", onConnected);
			socket.off("conversation:new", onConversationNew);
			socket.off("message:new", onMessageNew);
			socket.off("conv:needs_human", onNeedsHuman);
		};
	}, [workspaceId, reloadConversations]);

	const filteredConversations = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return conversations;
		return conversations.filter((c) => {
			const name = c.contact?.fullName?.toLowerCase() ?? "";
			const id = c.id.toLowerCase();
			const subject = c.subject?.toLowerCase() ?? "";
			return name.includes(q) || id.includes(q) || subject.includes(q);
		});
	}, [conversations, search]);

	const handleSelect = useCallback((id: string) => {
		setActiveId(id);
	}, []);

	if (!workspaceId) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
				<p>
					متغیر <code className="rounded bg-muted px-1.5 py-0.5">NEXT_PUBLIC_WORKSPACE_ID</code>{" "}
					تنظیم نشده.
				</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1">
			<aside className="flex w-80 shrink-0 flex-col border-e border-border bg-card">
				<div className="space-y-3 border-b border-border p-4">
					<div>
						<h2 className="text-base font-semibold">صندوق ورودی</h2>
						<p className="text-xs text-muted-foreground">
							{filteredConversations.length} مکالمه
						</p>
					</div>
					<div className="relative">
						<Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="جستجو نام، شناسه…"
							className="ps-9"
						/>
					</div>
					<div className="flex gap-2">
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
						>
							{STATUS_OPTIONS.map((o) => (
								<option key={o.value || "all"} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
						<select
							value={channelFilter}
							onChange={(e) => setChannelFilter(e.target.value)}
							className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
						>
							{CHANNEL_OPTIONS.map((o) => (
								<option key={o.value || "all"} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</div>
				</div>
				{loadError && (
					<p className="px-4 py-2 text-xs text-destructive">
						خطا: {loadError} — دوباره وارد شوید.
					</p>
				)}
				<ConversationList
					conversations={filteredConversations}
					activeId={activeId}
					onSelect={handleSelect}
					hasMore={hasMore && !search.trim()}
					loadingMore={loadingMore}
					onLoadMore={loadMore}
				/>
			</aside>
			<section className="flex min-w-0 flex-1 flex-col bg-background">
				{activeId ? (
					<MessageThread workspaceId={workspaceId} conversationId={activeId} />
				) : (
					<div className="flex flex-1 items-center justify-center text-muted-foreground">
						<p>یک مکالمه را انتخاب کنید</p>
					</div>
				)}
			</section>
		</div>
	);
}
