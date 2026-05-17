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

export interface VisitorPresenceMeta {
	contact_id: string;
	connected_at: string;
	last_seen_at: string;
	ip?: string | null;
	country?: string | null;
	country_code?: string | null;
	device?: string | null;
	browser?: string | null;
	page_url?: string | null;
	page_title?: string | null;
	visit_count?: number;
	conversation_id?: string | null;
}

function visitorMetaKey(workspaceId: string, contactId: string) {
	return `presence:${workspaceId}:visitor:${contactId}:meta`;
}

export async function getOnlineVisitorIds(workspaceId: string): Promise<string[]> {
	return redis().smembers(membersSetKey(workspaceId, "visitor"));
}

export async function getVisitorPresenceMeta(
	workspaceId: string,
	contactId: string,
): Promise<VisitorPresenceMeta | null> {
	const raw = await redis().get(visitorMetaKey(workspaceId, contactId));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as VisitorPresenceMeta;
	} catch {
		return null;
	}
}

export async function setVisitorPresenceMeta(
	workspaceId: string,
	contactId: string,
	meta: VisitorPresenceMeta,
): Promise<void> {
	const key = visitorMetaKey(workspaceId, contactId);
	await redis().set(key, JSON.stringify(meta), "EX", TTL_SEC);
}

export async function removeVisitorPresenceMeta(
	workspaceId: string,
	contactId: string,
): Promise<void> {
	await redis().del(visitorMetaKey(workspaceId, contactId));
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
		if (type === "visitor") {
			await removeVisitorPresenceMeta(workspaceId, memberId);
		}
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
