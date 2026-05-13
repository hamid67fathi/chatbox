import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const app = buildApp();
let request: ReturnType<typeof supertest>;

let workspaceId: string;
let contactId: string;
let conversationId: string;

beforeAll(async () => {
	await app.ready();
	request = supertest(app.server);
});

afterAll(async () => {
	await app.close();
});

describe("Happy path — full REST flow", () => {
	it("GET /health returns ok", async () => {
		const res = await request.get("/health").expect(200);
		expect(res.body.ok).toBe(true);
		expect(res.body.db).toBe(true);
	});

	it("POST /v1/workspaces creates a workspace", async () => {
		const res = await request
			.post("/v1/workspaces")
			.send({ name: "Test WS", slug: `test-${Date.now()}` })
			.expect(201);

		expect(res.body.id).toBeDefined();
		expect(res.body.name).toBe("Test WS");
		workspaceId = res.body.id;
	});

	it("GET /v1/workspaces lists workspaces", async () => {
		const res = await request
			.get("/v1/workspaces")
			.set("X-Workspace-Id", workspaceId)
			.expect(200);

		expect(res.body.data.length).toBeGreaterThan(0);
	});

	it("POST /v1/contacts creates a contact", async () => {
		const res = await request
			.post("/v1/contacts")
			.set("X-Workspace-Id", workspaceId)
			.send({
				full_name: "Test Contact",
				email: `test-${Date.now()}@test.local`,
			})
			.expect(201);

		expect(res.body.id).toBeDefined();
		contactId = res.body.id;
	});

	it("GET /v1/contacts lists contacts", async () => {
		const res = await request
			.get("/v1/contacts")
			.set("X-Workspace-Id", workspaceId)
			.expect(200);

		expect(res.body.data.length).toBeGreaterThan(0);
	});

	it("POST /v1/conversations creates a conversation", async () => {
		const res = await request
			.post("/v1/conversations")
			.set("X-Workspace-Id", workspaceId)
			.send({ contact_id: contactId, channel: "widget" })
			.expect(201);

		expect(res.body.id).toBeDefined();
		conversationId = res.body.id;
	});

	it("GET /v1/conversations lists conversations", async () => {
		const res = await request
			.get("/v1/conversations")
			.set("X-Workspace-Id", workspaceId)
			.expect(200);

		expect(res.body.data.length).toBeGreaterThan(0);
	});

	it("POST /v1/conversations/:id/messages sends a message", async () => {
		const res = await request
			.post(`/v1/conversations/${conversationId}/messages`)
			.set("X-Workspace-Id", workspaceId)
			.send({ body: "Hello from test!", sender_type: "agent" })
			.expect(201);

		expect(res.body.id).toBeDefined();
		expect(res.body.body).toBe("Hello from test!");
	});

	it("GET /v1/conversations/:id/messages returns messages", async () => {
		const res = await request
			.get(`/v1/conversations/${conversationId}/messages`)
			.set("X-Workspace-Id", workspaceId)
			.expect(200);

		expect(res.body.data.length).toBeGreaterThan(0);
		expect(res.body.data[0].body).toBe("Hello from test!");
	});

	it("POST /widget/v1/sessions creates a widget session", async () => {
		const ws = await request
			.get("/v1/workspaces")
			.set("X-Workspace-Id", workspaceId)
			.expect(200);

		const slug = ws.body.data.find(
			(w: { id: string }) => w.id === workspaceId,
		)?.slug;

		const res = await request
			.post("/widget/v1/sessions")
			.send({ workspace_slug: slug })
			.expect(201);

		expect(res.body.workspace_id).toBe(workspaceId);
		expect(res.body.conversation_id).toBeDefined();
		expect(res.body.contact_id).toBeDefined();
	});
});
