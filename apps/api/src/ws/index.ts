import type { Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server } from "socket.io";
import { registerEvents } from "./events.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export function createSocketServer(httpServer: HttpServer) {
	const io = new Server(httpServer, {
		cors: { origin: "*" },
		path: "/socket.io/",
	});

	const pubClient = new Redis(redisUrl);
	const subClient = pubClient.duplicate();

	io.adapter(createAdapter(pubClient, subClient));

	io.use((socket, next) => {
		const workspaceId = socket.handshake.query.workspace_id as string;
		if (!workspaceId) {
			return next(new Error("workspace_id query param is required"));
		}
		socket.data.workspaceId = workspaceId;
		// TODO: validate token from socket.handshake.query.token
		socket.data.token = socket.handshake.query.token as string;
		next();
	});

	io.on("connection", (socket) => {
		const wsId = socket.data.workspaceId as string;
		socket.join(`workspace:${wsId}`);
		socket.emit("connected", { workspace_id: wsId });

		registerEvents(io, socket);

		socket.on("disconnect", () => {
			socket.to(`workspace:${wsId}`).emit("presence:offline", {
				user: socket.data.token ?? socket.id,
			});
		});
	});

	return io;
}
