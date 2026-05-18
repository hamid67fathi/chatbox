import { buildInboxCacheKey } from "@chatbox/shared/offline-inbox";
import { describe, expect, it } from "vitest";

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
	});
});
