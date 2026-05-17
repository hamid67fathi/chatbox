import { and, eq } from "drizzle-orm";
import type { Server, Socket } from "socket.io";
import { db } from "../db/index.js";
import { conversations, messages } from "../db/schema/index.js";

export function registerEvents(io: Server, socket: Socket) {
	const wsId = socket.data.workspaceId as string;

	socket.on("conv:join", ({ conv_id }: { conv_id: string }) => {
		socket.join(`conversation:${conv_id}`);
	});

	socket.on("conv:leave", ({ conv_id }: { conv_id: string }) => {
		socket.leave(`conversation:${conv_id}`);
	});

	socket.on(
		"message:send",
		async (
			data: { conv_id: string; type?: string; body: string },
			ack?: (res: Record<string, unknown>) => void,
		) => {
			try {
				const conv = await db.query.conversations.findFirst({
					where: and(
						eq(conversations.id, data.conv_id),
						eq(conversations.workspaceId, wsId),
					),
				});
				if (!conv) {
					ack?.({
						ok: false,
						error: { code: "not_found", message: "Conversation not found" },
					});
					return;
				}

				const [msg] = await db
					.insert(messages)
					.values({
						workspaceId: wsId,
						conversationId: data.conv_id,
						senderType: "agent",
						type: (data.type as "text") ?? "text",
						body: data.body,
					})
					.returning();

				io.to(`conversation:${data.conv_id}`).emit("message:new", {
					message: msg,
					conversation: { id: data.conv_id },
				});

				io.to(`workspace:${wsId}`).emit("message:new", {
					message: msg,
					conversation: { id: data.conv_id },
				});

				ack?.({ ok: true, message_id: msg.id });
			} catch (err) {
				ack?.({
					ok: false,
					error: { code: "internal_error", message: String(err) },
				});
			}
		},
	);

	socket.on(
		"message:read",
		async ({
			conv_id,
			message_id,
		}: { conv_id: string; message_id: string }) => {
			const now = new Date();
			await db
				.update(messages)
				.set({ readAt: now, status: "read" })
				.where(
					and(eq(messages.id, message_id), eq(messages.workspaceId, wsId)),
				);

			io.to(`conversation:${conv_id}`).emit("message:read", {
				conv_id,
				message_id,
				by: socket.data.token ?? socket.id,
			});
		},
	);

	socket.on("typing:start", ({ conv_id }: { conv_id: string }) => {
		socket.to(`conversation:${conv_id}`).emit("typing", {
			conv_id,
			sender: socket.data.token ?? socket.id,
			isTyping: true,
		});
	});

	socket.on("typing:stop", ({ conv_id }: { conv_id: string }) => {
		socket.to(`conversation:${conv_id}`).emit("typing", {
			conv_id,
			sender: socket.data.token ?? socket.id,
			isTyping: false,
		});
	});

}
