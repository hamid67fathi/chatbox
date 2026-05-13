"use client";

import type { Conversation } from "@/lib/api";
import styles from "./ConversationList.module.css";

interface Props {
	conversations: Conversation[];
	activeId: string | null;
	onSelect: (id: string) => void;
}

function statusBadge(status: string) {
	const map: Record<string, string> = {
		open: "🟢",
		pending: "🟡",
		resolved: "✅",
		closed: "⚫",
	};
	return map[status] ?? "⚪";
}

function timeAgo(iso: string | null): string {
	if (!iso) return "";
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "الان";
	if (mins < 60) return `${mins} دقیقه پیش`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs} ساعت پیش`;
	return `${Math.floor(hrs / 24)} روز پیش`;
}

export function ConversationList({ conversations, activeId, onSelect }: Props) {
	if (conversations.length === 0) {
		return <div className={styles.empty}>مکالمه‌ای وجود ندارد</div>;
	}

	return (
		<ul className={styles.list}>
			{conversations.map((conv) => (
				<li key={conv.id}>
					<button
						type="button"
						className={`${styles.item} ${conv.id === activeId ? styles.active : ""}`}
						onClick={() => onSelect(conv.id)}
					>
						<div className={styles.row}>
							<span className={styles.name}>
								{statusBadge(conv.status)}{" "}
								{conv.subject ?? `مکالمه ${conv.channel}`}
							</span>
							<span className={styles.time}>
								{timeAgo(conv.lastMessageAt ?? conv.createdAt)}
							</span>
						</div>
						<div className={styles.sub}>
							{conv.contact?.fullName ?? conv.contactId?.slice(0, 8)}
						</div>
					</button>
				</li>
			))}
		</ul>
	);
}
