import { describe, expect, it } from "vitest";
import {
	normalizeSoundId,
	shouldPlayNotificationSound,
} from "../notification-sound.js";

describe("notification sound", () => {
	it("normalizes sound id", () => {
		expect(normalizeSoundId("chime")).toBe("chime");
		expect(normalizeSoundId("invalid")).toBe("default");
	});

	it("respects visibility prefs", () => {
		expect(
			shouldPlayNotificationSound({
				soundEnabled: true,
				tabVisible: true,
				playWhenTabHidden: false,
			}),
		).toBe(true);
		expect(
			shouldPlayNotificationSound({
				soundEnabled: false,
				tabVisible: true,
				playWhenTabHidden: true,
			}),
		).toBe(false);
		expect(
			shouldPlayNotificationSound({
				soundEnabled: true,
				tabVisible: false,
				playWhenTabHidden: false,
			}),
		).toBe(false);
		expect(
			shouldPlayNotificationSound({
				soundEnabled: true,
				tabVisible: false,
				playWhenTabHidden: true,
			}),
		).toBe(true);
	});
});
