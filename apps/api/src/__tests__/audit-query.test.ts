import { describe, expect, it } from "vitest";
import { auditLogsToCsv, clampAuditDateRange } from "../lib/audit-query.js";

describe("audit query", () => {
	it("clamps date range to one year", () => {
		const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
		const { from } = clampAuditDateRange(old, undefined);
		const minAllowed = Date.now() - 366 * 24 * 60 * 60 * 1000;
		expect(from.getTime()).toBeGreaterThanOrEqual(minAllowed - 86400000);
	});

	it("serializes csv with header", () => {
		const csv = auditLogsToCsv([
			{
				id: "id-1",
				workspaceId: "ws",
				actorUserId: "u",
				actorEmail: "a@b.com",
				actorName: "Agent",
				action: "auth.login",
				targetType: "user",
				targetId: "u",
				diff: null,
				ipAddress: "127.0.0.1",
				userAgent: null,
				createdAt: new Date("2026-01-01T12:00:00Z"),
			},
		]);
		expect(csv.startsWith("\uFEFFid,")).toBe(true);
		expect(csv).toContain("auth.login");
		expect(csv).toContain("a@b.com");
	});
});
