import { describe, expect, it } from "vitest";
import {
	brandingToPublic,
	isWhiteLabelActive,
	parseWorkspaceBranding,
	resolveWidgetBrandingDisplay,
} from "../lib/workspace-branding.js";

describe("workspace branding", () => {
	it("parses branding from settings", () => {
		const b = parseWorkspaceBranding({
			branding: {
				enabled: true,
				primary_color: "#ff00aa",
				hide_powered_by: true,
				dashboard_title: "Acme",
			},
		});
		expect(b.enabled).toBe(true);
		expect(b.primaryColor).toBe("#ff00aa");
		expect(b.hidePoweredBy).toBe(true);
		expect(brandingToPublic(b).dashboard_title).toBe("Acme");
	});

	it("requires enterprise for active white-label", () => {
		const b = parseWorkspaceBranding({ branding: { enabled: true } });
		expect(isWhiteLabelActive("pro", b, false)).toBe(false);
		expect(isWhiteLabelActive("enterprise", b, true)).toBe(true);
	});

	it("hides widget powered-by when configured", () => {
		const b = parseWorkspaceBranding({
			branding: { enabled: true, hide_powered_by: true },
		});
		const out = resolveWidgetBrandingDisplay(b, true, true);
		expect(out.show_branding).toBe(false);
	});
});
