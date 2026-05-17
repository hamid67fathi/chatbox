"use client";

import { Input } from "@/components/ui/input";
import type {
	Conversation,
	ConversationDetail,
	ConversationFilters,
	Message,
} from "@/lib/api";
import { fetchConversations } from "@/lib/api";
import { canAgentSeeConversation } from "@/lib/conversation-access";
import { getSocket } from "@/lib/socket";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConversationList } from "./ConversationList";
import { ConversationToolbar } from "./ConversationToolbar";
import { MessageThread } from "./MessageThread";
import { PresenceStats } from "./PresenceStats";

interface Props {
	workspaceId: string;
	userId: string;
	workspaceRole: string;
}

function normalizeConversation(raw: Conversation): Conversation {
	const meta =
		raw.metadata && typeof raw.metadata === "object"
			? raw.metadata
			: null;
	return {
		...raw,
		assignedAgentId:
			raw.assignedAgentId ?? raw.assignedUserId ?? null,
		lastAgentReplyAt: raw.lastAgentReplyAt ?? null,
		needsHuman: raw.needsHuman ?? raw.aiHandled === false,
		sentimentScore: raw.sentimentScore ?? null,
		summary:
			raw.summary ??
			(typeof meta?.summary === "string" ? meta.summary : null),
	};
}

type InboxView = "inbox" | "archived";

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

export function Inbox({ workspaceId, userId, workspaceRole }: Props) {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [inboxView, setInboxView] = useState<InboxView>("inbox");
	const [statusFilter, setStatusFilter] = useState("");
	const [channelFilter, setChannelFilter] = useState("");
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [nextCursor, setNextCursor] = useState<string | null>(null);

	const apiFilters = useMemo((): ConversationFilters => {
		const f: ConversationFilters = {
			limit: 30,
			archived: inboxView === "archived" ? "true" : "false",
		};
		if (statusFilter) f.status = statusFilter;
		if (channelFilter) f.channel = channelFilter;
		return f;
	}, [statusFilter, channelFilter, inboxView]);

	const reloadConversations = useCallback(() => {
		if (!workspaceId) return;
		fetchConversations(workspaceId, apiFilters).then(({ data, error, page }) => {
			setConversations(data.map(normalizeConversation));
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
					return [
						...prev,
						...data.map(normalizeConversation).filter((c) => !ids.has(c.id)),
					];
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

		const socket = getSocket(workspaceId, userId);

		const onConnected = () => {
			reloadConversations();
		};

		const onConversationNew = (data: { conversation: Conversation }) => {
			const conv = normalizeConversation(data.conversation);
			if (!canAgentSeeConversation(conv, userId, workspaceRole)) return;
			setConversations((prev) => {
				if (prev.some((c) => c.id === conv.id)) return prev;
				return [conv, ...prev];
			});
		};

		const onMessageNew = (data: {
			message: Message;
			conversation?: Partial<Conversation> & { id?: string };
		}) => {
			const convId = data.message.conversationId;
			const meta = data.conversation;
			setConversations((prev) => {
				const idx = prev.findIndex((c) => c.id === convId);
				if (meta?.assignedAgentId && meta.assignedAgentId !== userId) {
					if (!canAgentSeeConversation(
						{
							assignedAgentId: meta.assignedAgentId,
							lastAgentReplyAt: meta.lastAgentReplyAt ?? new Date().toISOString(),
						},
						userId,
						workspaceRole,
					)) {
						if (idx === -1) return prev;
						return prev.filter((c) => c.id !== convId);
					}
				}
				if (idx === -1) {
					reloadConversations();
					return prev;
				}
				const next = [...prev];
				next[idx] = {
					...next[idx],
					lastMessageAt: data.message.createdAt,
					...(meta?.assignedAgentId !== undefined
						? { assignedAgentId: meta.assignedAgentId }
						: {}),
					...(meta?.lastAgentReplyAt !== undefined
						? { lastAgentReplyAt: meta.lastAgentReplyAt }
						: {}),
				};
				next.sort(
					(a, b) =>
						new Date(b.lastMessageAt ?? b.createdAt).getTime() -
						new Date(a.lastMessageAt ?? a.createdAt).getTime(),
				);
				return next;
			});
		};

		const onConvAssigned = (data: { conv_id: string; agent_id: string }) => {
			if (!canAgentSeeConversation(
				{ assignedAgentId: data.agent_id, lastAgentReplyAt: new Date().toISOString() },
				userId,
				workspaceRole,
			)) {
				setConversations((prev) => prev.filter((c) => c.id !== data.conv_id));
				setActiveId((id) => (id === data.conv_id ? null : id));
			} else {
				setConversations((prev) =>
					prev.map((c) =>
						c.id === data.conv_id ? { ...c, assignedAgentId: data.agent_id } : c,
					),
				);
			}
		};

		const onNeedsHuman = (data: { conversation_id: string }) => {
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversation_id
						? { ...c, needsHuman: true, aiHandled: false }
						: c,
				),
			);
		};

		const onInsightsUpdated = (data: {
			conversation_id: string;
			sentiment_score?: string | null;
			summary?: string | null;
		}) => {
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversation_id
						? {
								...c,
								...(data.sentiment_score != null
									? { sentimentScore: data.sentiment_score }
									: {}),
								...(data.summary != null ? { summary: data.summary } : {}),
							}
						: c,
				),
			);
		};

		socket.on("connected", onConnected);
		socket.on("conversation:new", onConversationNew);
		socket.on("message:new", onMessageNew);
		socket.on("conv:assigned", onConvAssigned);
		socket.on("conv:needs_human", onNeedsHuman);
		socket.on("conv:insights_updated", onInsightsUpdated);

		if (socket.connected) onConnected();

		return () => {
			socket.off("connected", onConnected);
			socket.off("conversation:new", onConversationNew);
			socket.off("message:new", onMessageNew);
			socket.off("conv:assigned", onConvAssigned);
			socket.off("conv:needs_human", onNeedsHuman);
			socket.off("conv:insights_updated", onInsightsUpdated);
		};
	}, [workspaceId, userId, workspaceRole, reloadConversations]);

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

	const activeContactName = useMemo(() => {
		if (!activeId) return null;
		return (
			conversations.find((c) => c.id === activeId)?.contact?.fullName ?? null
		);
	}, [activeId, conversations]);

	const handleConversationPatch = useCallback(
		(id: string, patch: Partial<ConversationDetail>) => {
			setConversations((prev) =>
				prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
			);
		},
		[],
	);

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
						<h2 className="text-base font-semibold">
							{inboxView === "archived" ? "آرشیو" : "صندوق ورودی"}
						</h2>
						<p className="text-xs text-muted-foreground">
							{filteredConversations.length} مکالمه
						</p>
						<div className="mt-2">
							<PresenceStats workspaceId={workspaceId} userId={userId} />
						</div>
					</div>
					<div className="flex rounded-lg border border-border p-0.5 text-xs">
						<button
							type="button"
							className={`flex-1 rounded-md px-2 py-1 ${inboxView === "inbox" ? "bg-primary text-primary-foreground" : ""}`}
							onClick={() => setInboxView("inbox")}
						>
							فعال
						</button>
						<button
							type="button"
							className={`flex-1 rounded-md px-2 py-1 ${inboxView === "archived" ? "bg-primary text-primary-foreground" : ""}`}
							onClick={() => setInboxView("archived")}
						>
							آرشیو
						</button>
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
					<>
						<ConversationToolbar
							workspaceId={workspaceId}
							conversationId={activeId}
							userId={userId}
							onUpdated={(patch) => handleConversationPatch(activeId, patch)}
						/>
						<MessageThread
							workspaceId={workspaceId}
							conversationId={activeId}
							userId={userId}
							contactName={activeContactName}
						/>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center text-muted-foreground">
						<p>یک مکالمه را انتخاب کنید</p>
					</div>
				)}
			</section>
		</div>
	);
}
