import { describe, expect, it } from "vitest";
import {
	emailConfigFromInput,
	mergeEmailIntegration,
	parseEmailIntegration,
} from "../lib/email-settings.js";

describe("email-settings", () => {
	it("parses email integration", () => {
		const config = parseEmailIntegration({
			integrations: {
				email: {
					enabled: true,
					from_address: "support@example.com",
					imap: {
						host: "imap.example.com",
						port: 993,
						secure: true,
						user: "u",
						password: "p",
					},
					smtp: {
						host: "smtp.example.com",
						port: 587,
						secure: false,
						user: "u",
						password: "p",
					},
					imap_last_uid: 10,
					connected_at: "2026-05-16T00:00:00.000Z",
				},
			},
		});
		expect(config?.from_address).toBe("support@example.com");
		expect(config?.imap_last_uid).toBe(10);
	});

	it("merges and clears email integration", () => {
		const input = emailConfigFromInput({
			imap_host: "i",
			imap_port: 993,
			imap_secure: true,
			imap_user: "u",
			imap_password: "p",
			smtp_host: "s",
			smtp_port: 587,
			smtp_secure: false,
			smtp_user: "u",
			smtp_password: "p",
			from_address: "a@b.com",
		});
		const withEmail = mergeEmailIntegration({}, input);
		expect(parseEmailIntegration(withEmail)?.imap.host).toBe("i");
		const cleared = mergeEmailIntegration(withEmail, null);
		expect(parseEmailIntegration(cleared)).toBeNull();
	});
});
