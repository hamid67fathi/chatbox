"use client";

import { type Socket, io } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(workspaceId: string): Socket {
	if (socket) return socket;

	socket = io(API_URL, {
		query: { workspace_id: workspaceId, token: "dashboard-agent" },
	});

	return socket;
}
