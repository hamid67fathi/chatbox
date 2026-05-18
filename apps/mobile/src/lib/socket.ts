import { io, type Socket } from "socket.io-client";
import { API_URL } from "./config";
import { getAccessToken } from "./auth";

let socket: Socket | null = null;
let socketWorkspaceId: string | null = null;

export async function getSocket(
	workspaceId: string,
	userId: string,
): Promise<Socket> {
	const token = (await getAccessToken()) ?? "mobile-agent";

	if (socket && socketWorkspaceId === workspaceId) return socket;

	if (socket) {
		socket.disconnect();
		socket = null;
	}

	socketWorkspaceId = workspaceId;
	socket = io(API_URL, {
		query: {
			workspace_id: workspaceId,
			token,
			client_type: "agent",
			user_id: userId,
		},
	});

	return socket;
}

export function disconnectSocket(): void {
	if (socket) {
		socket.disconnect();
		socket = null;
		socketWorkspaceId = null;
	}
}
