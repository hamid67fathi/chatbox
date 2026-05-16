"use client";

import { type Socket, io } from "socket.io-client";
import { getAccessToken } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;
let socketWorkspaceId: string | null = null;

export function getSocket(workspaceId: string): Socket {
	const token = getAccessToken() ?? "dashboard-agent";

	if (socket && socketWorkspaceId === workspaceId) return socket;

	if (socket) {
		socket.disconnect();
		socket = null;
	}

	socketWorkspaceId = workspaceId;
	socket = io(API_URL, {
		query: { workspace_id: workspaceId, token },
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
