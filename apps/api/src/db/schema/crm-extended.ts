import {
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { contactSegments } from "./contact-segments.js";
import { contacts } from "./contacts.js";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const contactLifecycleHistory = pgTable("contact_lifecycle_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	contactId: uuid("contact_id")
		.notNull()
		.references(() => contacts.id, { onDelete: "cascade" }),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	fromStage: text("from_stage"),
	toStage: text("to_stage").notNull(),
	changedBy: uuid("changed_by").references(() => users.id),
	reason: text("reason"),
	changedAt: timestamp("changed_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const scoringRules = pgTable("scoring_rules", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	signalType: text("signal_type").notNull(),
	weight: integer("weight").notNull().default(10),
	config: jsonb("config").notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const contactScores = pgTable("contact_scores", {
	contactId: uuid("contact_id")
		.primaryKey()
		.references(() => contacts.id, { onDelete: "cascade" }),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	score: integer("score").notNull().default(0),
	breakdown: jsonb("breakdown").notNull().default({}),
	computedAt: timestamp("computed_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const contactHealth = pgTable("contact_health", {
	contactId: uuid("contact_id")
		.primaryKey()
		.references(() => contacts.id, { onDelete: "cascade" }),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	score: integer("score").notNull().default(50),
	riskLevel: text("risk_level").notNull().default("low"),
	signals: jsonb("signals").notNull().default({}),
	computedAt: timestamp("computed_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const proactiveRules = pgTable("proactive_rules", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	triggerType: text("trigger_type").notNull(),
	conditions: jsonb("conditions").notNull().default({}),
	message: text("message").notNull(),
	throttleDays: integer("throttle_days").notNull().default(7),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const campaigns = pgTable("campaigns", {
	id: uuid("id").primaryKey().defaultRandom(),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references(() => workspaces.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	messageTemplate: text("message_template").notNull(),
	segmentId: uuid("segment_id").references(() => contactSegments.id, {
		onDelete: "set null",
	}),
	status: text("status").notNull().default("draft"),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const campaignRecipients = pgTable(
	"campaign_recipients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		campaignId: uuid("campaign_id")
			.notNull()
			.references(() => campaigns.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("pending"),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		openedAt: timestamp("opened_at", { withTimezone: true }),
		repliedAt: timestamp("replied_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("idx_campaign_recipient").on(t.campaignId, t.contactId)],
);

export const companies = pgTable(
	"companies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		domain: text("domain"),
		industry: text("industry"),
		size: text("size"),
		website: text("website"),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [uniqueIndex("idx_companies_ws_domain").on(t.workspaceId, t.domain)],
);

export const contactCompanies = pgTable(
	"contact_companies",
	{
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		role: text("role"),
	},
	(t) => [primaryKey({ columns: [t.contactId, t.companyId] })],
);
