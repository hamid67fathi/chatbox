"use client";

import { fetchPresence, type PresenceCounts } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Headphones, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	userId: string;
}

export function PresenceStats({ workspaceId, userId }: Props) {
	const [counts, setCounts] = useState<PresenceCounts | null>(null);

	useEffect(() => {
		void fetchPresence(workspaceId).then(setCounts);
	}, [workspaceId]);

	useEffect(() => {
		const socket = getSocket(workspaceId, userId);
		const onCounts = (payload: PresenceCounts) => setCounts(payload);
		socket.on("presence:counts", onCounts);
		const interval = setInterval(() => {
			socket.emit("presence:heartbeat");
		}, 45_000);
		return () => {
			socket.off("presence:counts", onCounts);
			clearInterval(interval);
		};
	}, [workspaceId, userId]);

	if (!counts) return null;

	return (
		<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
			<span className="inline-flex items-center gap-1" title="اپراتور آنلاین">
				<Headphones className="h-3.5 w-3.5" />
				{counts.agents_online} اپراتور
			</span>
			<span className="inline-flex items-center gap-1" title="بازدیدکننده آنلاین">
				<Users className="h-3.5 w-3.5" />
				{counts.visitors_online} بازدیدکننده
			</span>
		</div>
	);
}
