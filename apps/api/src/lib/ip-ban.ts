import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces } from "../db/schema/index.js";
import { notFound, validationError } from "./errors.js";

const IPV4 =
	/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;


export function parseDashboardIpWhitelist(settings: unknown): string[] {
	if (!settings || typeof settings !== "object") return [];
	const security = (settings as { security?: unknown }).security;
	if (!security || typeof security !== "object") return [];
	const raw =
		(security as { dashboard_ip_whitelist?: unknown }).dashboard_ip_whitelist ??
		(security as { dashboardIpWhitelist?: unknown }).dashboardIpWhitelist;
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== "string") continue;
		const normalized = normalizeBanRule(item);
		if (normalized) out.push(normalized);
	}
	return [...new Set(out)];
}

export function isIpAllowedByRules(
	ip: string | null | undefined,
	rules: string[],
): boolean {
	if (rules.length === 0) return true;
	if (!ip) return false;
	return isIpBanned(ip.trim(), rules);
}

export function mergeDashboardIpWhitelist(
	settings: unknown,
	ips: string[],
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const security =
		base.security && typeof base.security === "object"
			? { ...(base.security as Record<string, unknown>) }
			: {};
	const normalized = ips
		.map((ip) => normalizeBanRule(ip))
		.filter((ip): ip is string => Boolean(ip));
	security.dashboard_ip_whitelist = [...new Set(normalized)];
	base.security = security;
	return base;
}

export function parseBannedIps(settings: unknown): string[] {
	if (!settings || typeof settings !== "object") return [];
	const security = (settings as { security?: unknown }).security;
	if (!security || typeof security !== "object") return [];
	const raw =
		(security as { banned_ips?: unknown }).banned_ips ??
		(security as { bannedIps?: unknown }).bannedIps;
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== "string") continue;
		const normalized = normalizeBanRule(item);
		if (normalized) out.push(normalized);
	}
	return [...new Set(out)];
}

export function normalizeBanRule(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	if (trimmed.includes("/")) {
		const [addr, bitsStr] = trimmed.split("/", 2);
		if (!addr || !bitsStr || !IPV4.test(addr)) return null;
		const bits = Number(bitsStr);
		if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
		return `${addr}/${bits}`;
	}

	if (trimmed.includes("*")) {
		const parts = trimmed.split(".");
		if (parts.length !== 4) return null;
		for (const p of parts) {
			if (p !== "*" && !/^\d{1,3}$/.test(p)) return null;
			if (p !== "*") {
				const n = Number(p);
				if (n < 0 || n > 255) return null;
			}
		}
		return trimmed;
	}

	if (!IPV4.test(trimmed)) return null;
	return trimmed;
}

function ipv4ToInt(ip: string): number | null {
	if (!IPV4.test(ip)) return null;
	const parts = ip.split(".").map(Number);
	return (
		(((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0)
	);
}

function matchWildcard(ip: string, pattern: string): boolean {
	const ipParts = ip.split(".");
	const patParts = pattern.split(".");
	if (ipParts.length !== 4 || patParts.length !== 4) return false;
	for (let i = 0; i < 4; i++) {
		if (patParts[i] === "*") continue;
		if (patParts[i] !== ipParts[i]) return false;
	}
	return true;
}

function matchCidr(ip: string, cidr: string): boolean {
	const [net, bitsStr] = cidr.split("/", 2);
	const bits = Number(bitsStr);
	const ipInt = ipv4ToInt(ip);
	const netInt = ipv4ToInt(net!);
	if (ipInt === null || netInt === null) return false;
	if (bits === 0) return true;
	const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
	return (ipInt & mask) === (netInt & mask);
}

export function isIpBanned(ip: string | null | undefined, rules: string[]): boolean {
	if (!ip || rules.length === 0) return false;
	const normalized = ip.trim();
	if (!IPV4.test(normalized)) return false;

	for (const rule of rules) {
		if (rule.includes("/")) {
			if (matchCidr(normalized, rule)) return true;
		} else if (rule.includes("*")) {
			if (matchWildcard(normalized, rule)) return true;
		} else if (rule === normalized) {
			return true;
		}
	}
	return false;
}

export function mergeBannedIpsSettings(
	settings: unknown,
	ips: string[],
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const security =
		base.security && typeof base.security === "object"
			? { ...(base.security as Record<string, unknown>) }
			: {};
	const normalized = ips
		.map((ip) => normalizeBanRule(ip))
		.filter((ip): ip is string => Boolean(ip));
	security.banned_ips = [...new Set(normalized)];
	base.security = security;
	return base;
}

export function addIpToBanList(settings: unknown, ip: string): string[] {
	const rule = normalizeBanRule(ip);
	if (!rule) return parseBannedIps(settings);
	const current = parseBannedIps(settings);
	if (current.includes(rule)) return current;
	return [...current, rule];
}

export function visitorIpFromMetadata(metadata: unknown): string | null {
	if (!metadata || typeof metadata !== "object") return null;
	const visitor = (metadata as { visitor?: unknown }).visitor;
	if (!visitor || typeof visitor !== "object") return null;
	const ip = (visitor as { ip?: unknown }).ip;
	return typeof ip === "string" && IPV4.test(ip.trim()) ? ip.trim() : null;
}

export async function addWorkspaceBannedIp(
	workspaceId: string,
	ip: string,
): Promise<string[]> {
	const ws = await db.query.workspaces.findFirst({
		where: eq(workspaces.id, workspaceId),
	});
	if (!ws) throw notFound("Workspace not found.");

	const rule = normalizeBanRule(ip);
	if (!rule) {
		throw validationError("Invalid IP address.", "ip");
	}

	const next = addIpToBanList(ws.settings, rule);
	const [updated] = await db
		.update(workspaces)
		.set({
			settings: mergeBannedIpsSettings(ws.settings, next),
			updatedAt: new Date(),
		})
		.where(eq(workspaces.id, workspaceId))
		.returning();

	return parseBannedIps(updated?.settings);
}
