import { describe, expect, it } from "vitest";
import { contactsToCsv } from "../lib/contact-bulk.js";

describe("contactsToCsv", () => {
	it("escapes commas and quotes", () => {
		const csv = contactsToCsv([
			{
				id: "c1",
				fullName: 'Ali "VIP"',
				email: "a@b.com",
				phone: null,
				tags: ["vip", "sales"],
				firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
				lastSeenAt: new Date("2026-01-02T00:00:00.000Z"),
				metadata: {},
			},
		]);
		expect(csv.split("\n")).toHaveLength(2);
		expect(csv).toContain('"Ali ""VIP"""');
		expect(csv).toContain("vip|sales");
	});
});
