import { afterEach, describe, expect, it } from "vitest";
import {
	assertEmailDomainAllowed,
	getGoogleAllowedDomains,
	isGoogleOAuthConfigured,
} from "../lib/google-oauth.js";
import { ApiError } from "../lib/errors.js";

describe("google oauth", () => {
	const prev = { ...process.env };

	afterEach(() => {
		process.env = { ...prev };
	});

	it("detects configuration", () => {
		delete process.env.GOOGLE_OAUTH_CLIENT_ID;
		delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
		expect(isGoogleOAuthConfigured()).toBe(false);
		process.env.GOOGLE_OAUTH_CLIENT_ID = "id";
		process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
		expect(isGoogleOAuthConfigured()).toBe(true);
	});

	it("parses allowed domains", () => {
		process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS = "acme.com, Example.org ";
		expect(getGoogleAllowedDomains()).toEqual(["acme.com", "example.org"]);
	});

	it("rejects disallowed email domain", () => {
		process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS = "acme.com";
		expect(() => assertEmailDomainAllowed("user@gmail.com")).toThrow(ApiError);
		assertEmailDomainAllowed("user@acme.com");
	});
});
