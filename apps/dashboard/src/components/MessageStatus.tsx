import type { Message } from "@/lib/api";

export function MessageStatus({ msg }: { msg: Message }) {
	if (msg.senderType !== "agent" && msg.senderType !== "contact") return null;

	const isAgent = msg.senderType === "agent";
	const read = Boolean(msg.readAt);
	const delivered = Boolean(msg.deliveredAt);

	if (isAgent) {
		return (
			<span
				className={read ? "text-sky-300" : ""}
				title={read ? "خوانده شد" : delivered ? "تحویل شد" : "ارسال شد"}
			>
				{read ? "✓✓" : delivered ? "✓✓" : "✓"}
			</span>
		);
	}

	// contact messages in dashboard (rare) — same ticks
	return (
		<span title={read ? "خوانده شد" : delivered ? "تحویل شد" : "ارسال شد"}>
			{read ? "✓✓" : delivered ? "✓" : "·"}
		</span>
	);
}
