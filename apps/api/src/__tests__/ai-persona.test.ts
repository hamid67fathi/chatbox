import { describe, expect, it } from "vitest";
import {
	aiPersonaForAiService,
	parseAiPersona,
} from "../lib/ai-persona.js";

describe("parseAiPersona", () => {
	it("parses tone and name", () => {
		const p = parseAiPersona({
			enabled: true,
			name: " Sara ",
			tone: "technical",
			custom_instructions: " Be brief ",
		});
		expect(p.name).toBe("Sara");
		expect(p.tone).toBe("technical");
		expect(p.custom_instructions).toBe("Be brief");
	});

	it("returns null payload when disabled", () => {
		expect(
			aiPersonaForAiService({
				enabled: false,
				name: "X",
				tone: "formal",
				custom_instructions: "",
			}),
		).toBeNull();
	});
});
