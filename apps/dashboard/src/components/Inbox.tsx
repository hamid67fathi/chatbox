"use client";

import { Input } from "@/components/ui/input";
import type {
	Conversation,
	ConversationDetail,
	ConversationFilters,
	Message,
} from "@/lib/api";
import { fetchConversationDetail, fetchConversations } from "@/lib/api";
import {
	buildInboxCacheKey,
	loadOfflineInbox,
	saveOfflineInbox,
} from "@/lib/offline-inbox-cache";
import { canAgentSeeConversation } from "@/lib/conversation-access";
import {
	maybeShowBrowserConversationNotification,
	maybeShowBrowserMessageNotification,
	maybeShowBrowserNeedsHumanNotification,
} from "@/lib/browser-notifications";
import {
	loadNotificationSoundPrefs,
	maybePlayIncomingMessageSound,
} from "@/lib/notification-sound-prefs";
import { getSocket } from "@/lib/socket";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConversationList } from "./ConversationList";
import { ConversationToolbar } from "./ConversationToolbar";
import { HandoffBriefPanel } from "./HandoffBriefPanel";
import { MessageThread } from "./MessageThread";
import { PresenceStats } from "./PresenceStats";
import { VisitorInfoPanel } from "./VisitorInfoPanel";

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
	{ value: "telegram", label: "تلگرام" },
	{ value: "email", label: "ایمیل" },
	{ value: "whatsapp", label: "واتساپ" },
];

export function Inbox({ workspaceId, userId, workspaceRole }: Props) {
	const searchParams = useSearchParams();
	const deepLinkConvId = searchParams.get("c");
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
	const [suggestedReply, setSuggestedReply] = useState<string | null>(null);
	const [handoffBrief, setHandoffBrief] = useState<
		import("@/lib/api").HandoffBrief | null
	>(null);

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
		const cacheKey = buildInboxCacheKey(workspaceId, apiFilters);
		if (typeof navigator !== "undefined" && !navigator.onLine) {
			const cached = loadOfflineInbox(cacheKey);
			if (cached?.length) {
				setConversations(cached.map(normalizeConversation));
				setLoadError("آفلاین — آخرین لیست ذخیره‌شده");
				setHasMore(false);
				setNextCursor(null);
				return;
			}
		}
		fetchConversations(workspaceId, apiFilters).then(({ data, error, page }) => {
			const normalized = data.map(normalizeConversation);
			if (normalized.length > 0) {
				saveOfflineInbox(cacheKey, normalized);
			}
			if (error && normalized.length === 0) {
				const cached = loadOfflineInbox(cacheKey);
				if (cached?.length) {
					setConversations(cached.map(normalizeConversation));
					setLoadError("آفلاین — آخرین لیست ذخیره‌شده");
					setHasMore(false);
					setNextCursor(null);
					return;
				}
			}
			setConversations(normalized);
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
		if (!deepLinkConvId || conversations.length === 0) return;
		if (conversations.some((c) => c.id === deepLinkConvId)) {
			setActiveId(deepLinkConvId);
		}
	}, [deepLinkConvId, conversations]);

	useEffect(() => {
		if (!workspaceId) return;
		const interval = setInterval(reloadConversations, 8000);
		return () => clearInterval(interval);
	}, [workspaceId, reloadConversations]);

	useEffect(() => {
		if (!workspaceId) return;
		void loadNotificationSoundPrefs(workspaceId);
	}, [workspaceId]);

	useEffect(() => {
		if (!workspaceId) return;

		const socket = getSocket(workspaceId, userId);

		const onConnected = () => {
			reloadConversations();
		};

		const onConversationNew = (data: { conversation: Conversation }) => {
			const conv = normalizeConversation(data.conversation);
			if (!canAgentSeeConversation(conv, userId, workspaceRole)) return;
			maybeShowBrowserConversationNotification({
				conversationId: conv.id,
				contactName: conv.contact?.fullName,
			});
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
			maybePlayIncomingMessageSound({
				senderType: data.message.senderType,
				conversationId: convId,
				activeConversationId: activeId,
			});
			const convRow = conversations.find((c) => c.id === convId);
			maybeShowBrowserMessageNotification({
				senderType: data.message.senderType,
				conversationId: convId,
				contactName: convRow?.contact?.fullName,
				messageBody: data.message.body,
			});
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
			const convRow = conversations.find((c) => c.id === data.conversation_id);
			maybeShowBrowserNeedsHumanNotification({
				conversationId: data.conversation_id,
				contactName: convRow?.contact?.fullName,
			});
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

		const onHandoffBrief = (data: {
			conversation_id: string;
			handoff_brief?: import("@/lib/api").HandoffBrief;
			summary?: string;
		}) => {
			if (data.handoff_brief) {
				if (activeId === data.conversation_id) {
					setHandoffBrief(data.handoff_brief);
				}
				setConversations((prev) =>
					prev.map((c) =>
						c.id === data.conversation_id
							? {
									...c,
									summary: data.summary ?? data.handoff_brief?.summary ?? c.summary,
								}
							: c,
					),
				);
			}
		};

		socket.on("connected", onConnected);
		socket.on("conversation:new", onConversationNew);
		socket.on("message:new", onMessageNew);
		socket.on("conv:assigned", onConvAssigned);
		socket.on("conv:needs_human", onNeedsHuman);
		socket.on("conv:insights_updated", onInsightsUpdated);
		socket.on("conv:handoff_brief", onHandoffBrief);

		if (socket.connected) onConnected();

		return () => {
			socket.off("connected", onConnected);
			socket.off("conversation:new", onConversationNew);
			socket.off("message:new", onMessageNew);
			socket.off("conv:assigned", onConvAssigned);
			socket.off("conv:needs_human", onNeedsHuman);
			socket.off("conv:insights_updated", onInsightsUpdated);
			socket.off("conv:handoff_brief", onHandoffBrief);
		};
	}, [
		workspaceId,
		userId,
		workspaceRole,
		reloadConversations,
		activeId,
		conversations,
	]);

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
		setSuggestedReply(null);
		setHandoffBrief(null);
	}, []);

	useEffect(() => {
		if (!workspaceId || !activeId) return;
		void fetchConversationDetail(workspaceId, activeId).then((d) => {
			if (d?.handoff_brief) setHandoffBrief(d.handoff_brief);
		});
	}, [workspaceId, activeId]);

	const activeConversation = useMemo(
		() => conversations.find((c) => c.id === activeId) ?? null,
		[activeId, conversations],
	);

	const activeContactName = activeConversation?.contact?.fullName ?? null;

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
							workspaceRole={workspaceRole}
							onUpdated={(patch) => handleConversationPatch(activeId, patch)}
						/>
						<HandoffBriefPanel
							workspaceId={workspaceId}
							conversationId={activeId}
							needsHuman={activeConversation?.needsHuman}
							initialBrief={handoffBrief}
							onBriefChange={setHandoffBrief}
							onUseSuggestedReply={setSuggestedReply}
						/>
						<VisitorInfoPanel
							workspaceId={workspaceId}
							conversationId={activeId}
							channel={activeConversation?.channel ?? "widget"}
							canEditContact={
								workspaceRole === "owner" || workspaceRole === "admin"
							}
						/>
						<MessageThread
							workspaceId={workspaceId}
							conversationId={activeId}
							userId={userId}
							contactName={activeContactName}
							suggestedReply={suggestedReply}
							onSuggestedReplyApplied={() => setSuggestedReply(null)}
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
