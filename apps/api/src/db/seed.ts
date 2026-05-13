import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://chatbox:chatbox@localhost:5432/chatbox";

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function seed() {
	console.log("Seeding database …");

	let [user] = await db
		.insert(schema.users)
		.values({
			email: "admin@chatbox.local",
			fullName: "Admin User",
			emailVerified: true,
			passwordHash: "-- placeholder, no real auth yet --",
		})
		.onConflictDoNothing({ target: schema.users.email })
		.returning();

	if (!user) {
		const existing = await db.query.users.findFirst({
			where: (u, { eq }) => eq(u.email, "admin@chatbox.local"),
		});
		if (!existing) throw new Error("Cannot find or create seed user");
		user = existing;
		console.log("Seed user already exists, reusing.");
	}

	let [workspace] = await db
		.insert(schema.workspaces)
		.values({
			slug: "demo",
			name: "Demo Workspace",
			ownerUserId: user.id,
			plan: "free",
		})
		.onConflictDoNothing()
		.returning();

	if (!workspace) {
		const existing = await db.query.workspaces.findFirst({
			where: (w, { eq }) => eq(w.slug, "demo"),
		});
		if (!existing) throw new Error("Cannot find or create demo workspace");
		workspace = existing;
		console.log("Seed workspace already exists, reusing.");
	}

	await db
		.insert(schema.workspaceMembers)
		.values({
			workspaceId: workspace.id,
			userId: user.id,
			role: "owner",
			status: "active",
			joinedAt: new Date(),
		})
		.onConflictDoNothing();

	let [contact] = await db
		.insert(schema.contacts)
		.values({
			workspaceId: workspace.id,
			fullName: "مشتری نمونه",
			email: "customer@example.com",
		})
		.onConflictDoNothing()
		.returning();

	if (!contact) {
		const existing = await db.query.contacts.findFirst({
			where: (c, { eq }) => eq(c.email, "customer@example.com"),
		});
		if (!existing) throw new Error("Cannot find or create seed contact");
		contact = existing;
	}

	const existingConv = await db.query.conversations.findFirst({
		where: (c, { eq, and }) =>
			and(eq(c.workspaceId, workspace.id), eq(c.contactId, contact.id)),
	});

	const conv = existingConv
		? existingConv
		: (
				await db
					.insert(schema.conversations)
					.values({
						workspaceId: workspace.id,
						contactId: contact.id,
						channel: "widget",
						status: "open",
					})
					.returning()
			)[0];

	if (!existingConv) {
		await db.insert(schema.messages).values([
			{
				workspaceId: workspace.id,
				conversationId: conv.id,
				senderType: "contact",
				senderContactId: contact.id,
				type: "text",
				body: "سلام، یک سؤال داشتم.",
			},
			{
				workspaceId: workspace.id,
				conversationId: conv.id,
				senderType: "agent",
				senderUserId: user.id,
				type: "text",
				body: "سلام! بفرمایید، در خدمتم.",
			},
		]);
	}

	await db
		.insert(schema.cannedResponses)
		.values([
			{
				workspaceId: workspace.id,
				shortcut: "/greet",
				title: "خوش‌آمدگویی",
				body: "سلام {{name}} عزیز، چطور می‌تونم کمکتون کنم؟",
				variables: ["name"],
			},
			{
				workspaceId: workspace.id,
				shortcut: "/bye",
				title: "خداحافظی",
				body: "ممنون از تماستون. روز خوبی داشته باشید!",
			},
			{
				workspaceId: workspace.id,
				shortcut: "/wait",
				title: "لطفاً صبر کنید",
				body: "لطفاً چند لحظه صبر کنید، در حال بررسی هستم.",
			},
		])
		.onConflictDoNothing();

	console.log(`Seed complete:
  - User:         ${user.id} (${user.email})
  - Workspace:    ${workspace.id} (${workspace.slug})
  - Contact:      ${contact.id}
  - Conversation: ${conv.id}
  - Messages:     2
  - Canned:       3`);

	await client.end();
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
