import type { Server, Socket } from "socket.io";
import {
	presenceConnect,
	presenceCounts,
	presenceDisconnect,
	presenceHeartbeat,
} from "../lib/presence.js";

export type PresenceClientType = "agent" | "visitor";

export function parsePresenceFromSocket(socket: Socket): {
	type: PresenceClientType;
	memberId: string;
} | null {
	const q = socket.handshake.query;
	const clientType = q.client_type as string;
	if (clientType !== "agent" && clientType !== "visitor") return null;

	const memberId =
		clientType === "agent"
			? (q.user_id as string)
			: (q.contact_id as string);
	if (!memberId?.trim()) return null;

	return { type: clientType, memberId: memberId.trim() };
}

async function emitCounts(io: Server, workspaceId: string) {
	const counts = await presenceCounts(workspaceId);
	io.to(`workspace:${workspaceId}`).emit("presence:counts", counts);
}

export async function registerPresence(
	io: Server,
	socket: Socket,
	workspaceId: string,
): Promise<void> {
	const parsed = parsePresenceFromSocket(socket);
	if (!parsed) return;

	const { type, memberId } = parsed;
	socket.data.presenceType = type;
	socket.data.presenceMemberId = memberId;

	await presenceConnect(workspaceId, type, memberId, socket.id);
	await emitCounts(io, workspaceId);

	socket.on("presence:heartbeat", async () => {
		await presenceHeartbeat(workspaceId, type, memberId);
	});

	socket.on("presence:online", async () => {
		await presenceConnect(workspaceId, type, memberId, socket.id);
		await emitCounts(io, workspaceId);
	});

	socket.on("presence:away", async () => {
		await emitCounts(io, workspaceId);
	});
}

export async function unregisterPresence(
	io: Server,
	socket: Socket,
	workspaceId: string,
): Promise<void> {
	const type = socket.data.presenceType as PresenceClientType | undefined;
	const memberId = socket.data.presenceMemberId as string | undefined;
	if (!type || !memberId) return;
	await presenceDisconnect(workspaceId, type, memberId, socket.id);
	await emitCounts(io, workspaceId);
}
