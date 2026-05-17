import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: Redis | null = null;

function redis(): Redis {
	if (!client) client = new Redis(redisUrl);
	return client;
}

function membersSetKey(workspaceId: string, type: "agent" | "visitor") {
	return `presence:${workspaceId}:${type}s`;
}

function socketsKey(
	workspaceId: string,
	type: "agent" | "visitor",
	memberId: string,
) {
	return `presence:${workspaceId}:${type}:${memberId}:sockets`;
}

const TTL_SEC = Number(process.env.PRESENCE_TTL_SEC ?? 120);

export interface PresenceCounts {
	agents_online: number;
	visitors_online: number;
}

export async function presenceConnect(
	workspaceId: string,
	type: "agent" | "visitor",
	memberId: string,
	socketId: string,
): Promise<PresenceCounts> {
	const r = redis();
	await r.sadd(socketsKey(workspaceId, type, memberId), socketId);
	await r.expire(socketsKey(workspaceId, type, memberId), TTL_SEC);
	await r.sadd(membersSetKey(workspaceId, type), memberId);
	return presenceCounts(workspaceId);
}

export async function presenceHeartbeat(
	workspaceId: string,
	type: "agent" | "visitor",
	memberId: string,
): Promise<void> {
	await redis().expire(socketsKey(workspaceId, type, memberId), TTL_SEC);
}

export async function presenceDisconnect(
	workspaceId: string,
	type: "agent" | "visitor",
	memberId: string,
	socketId: string,
): Promise<PresenceCounts> {
	const r = redis();
	const sk = socketsKey(workspaceId, type, memberId);
	await r.srem(sk, socketId);
	const remaining = await r.scard(sk);
	if (remaining === 0) {
		await r.del(sk);
		await r.srem(membersSetKey(workspaceId, type), memberId);
	}
	return presenceCounts(workspaceId);
}

export async function presenceCounts(workspaceId: string): Promise<PresenceCounts> {
	const r = redis();
	const [agents, visitors] = await Promise.all([
		r.scard(membersSetKey(workspaceId, "agent")),
		r.scard(membersSetKey(workspaceId, "visitor")),
	]);
	return {
		agents_online: agents,
		visitors_online: visitors,
	};
}
