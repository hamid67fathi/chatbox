import { describe, expect, it } from "vitest";
import { buildInboxCacheKey } from "../offline-inbox.js";

describe("buildInboxCacheKey", () => {
	it("includes workspace and filters", () => {
		const key = buildInboxCacheKey("ws-1", {
			archived: "false",
			status: "open",
			channel: "widget",
			limit: 30,
		});
		expect(key).toContain("ws-1");
		expect(key).toContain("open");
		expect(key).toContain("widget");
	});
});
