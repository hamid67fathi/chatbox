import { relations } from "drizzle-orm";
import { aiInteractions } from "./ai-interactions.js";
import { apiTokens } from "./api-tokens.js";
import { cannedResponses } from "./canned-responses.js";
import { contacts } from "./contacts.js";
import {
	conversationNotes,
	conversationTags,
	conversations,
} from "./conversations.js";
import { kbChunks } from "./kb-chunks.js";
import { kbDocuments } from "./kb-documents.js";
import { knowledgeBases } from "./knowledge-bases.js";
import { messages } from "./messages.js";
import { sessions } from "./sessions.js";
import { payments, subscriptions } from "./subscriptions.js";
import { users } from "./users.js";
import { flowSessions, flows } from "./flows.js";
import { routingRules } from "./routing-rules.js";
import { contactSegments } from "./contact-segments.js";
import { pushSubscriptions } from "./push-subscriptions.js";
import { installedPlugins, pluginCatalog } from "./plugins.js";
import { visitorIdentities } from "./visitor-identities.js";
import { webhookDeliveries, webhookEndpoints } from "./webhook-endpoints.js";
import { auditLogs } from "./audit-logs.js";
import { csatResponses } from "./csat-responses.js";
import { slaPolicies } from "./sla-policies.js";
import { workspaceMembers } from "./workspace-members.js";
import { workspaces } from "./workspaces.js";

export const workspacesRelations = relations(workspaces, ({ many }) => ({
	members: many(workspaceMembers),
	contacts: many(contacts),
	conversations: many(conversations),
	cannedResponses: many(cannedResponses),
	knowledgeBases: many(knowledgeBases),
	aiInteractions: many(aiInteractions),
	subscriptions: many(subscriptions),
	payments: many(payments),
	apiTokens: many(apiTokens),
	flows: many(flows),
	flowSessions: many(flowSessions),
	routingRules: many(routingRules),
	contactSegments: many(contactSegments),
	pushSubscriptions: many(pushSubscriptions),
	webhookEndpoints: many(webhookEndpoints),
	installedPlugins: many(installedPlugins),
	visitorIdentities: many(visitorIdentities),
	slaPolicies: many(slaPolicies),
	csatResponses: many(csatResponses),
	auditLogs: many(auditLogs),
}));

export const csatResponsesRelations = relations(csatResponses, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [csatResponses.workspaceId],
		references: [workspaces.id],
	}),
	conversation: one(conversations, {
		fields: [csatResponses.conversationId],
		references: [conversations.id],
	}),
	contact: one(contacts, {
		fields: [csatResponses.contactId],
		references: [contacts.id],
	}),
	assignedAgent: one(users, {
		fields: [csatResponses.assignedAgentId],
		references: [users.id],
	}),
}));

export const slaPoliciesRelations = relations(slaPolicies, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [slaPolicies.workspaceId],
		references: [workspaces.id],
	}),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [apiTokens.workspaceId],
		references: [workspaces.id],
	}),
	creator: one(users, {
		fields: [apiTokens.createdBy],
		references: [users.id],
	}),
}));

export const usersRelations = relations(users, ({ many }) => ({
	memberships: many(workspaceMembers),
	sessions: many(sessions),
	auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [auditLogs.workspaceId],
		references: [workspaces.id],
	}),
	actor: one(users, {
		fields: [auditLogs.actorUserId],
		references: [users.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const workspaceMembersRelations = relations(
	workspaceMembers,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceMembers.workspaceId],
			references: [workspaces.id],
		}),
		user: one(users, {
			fields: [workspaceMembers.userId],
			references: [users.id],
		}),
	}),
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [contacts.workspaceId],
		references: [workspaces.id],
	}),
	conversations: many(conversations),
	visitorIdentities: many(visitorIdentities),
}));

export const conversationsRelations = relations(
	conversations,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [conversations.workspaceId],
			references: [workspaces.id],
		}),
		contact: one(contacts, {
			fields: [conversations.contactId],
			references: [contacts.id],
		}),
		assignedAgent: one(users, {
			fields: [conversations.assignedAgentId],
			references: [users.id],
		}),
		messages: many(messages),
		tags: many(conversationTags),
		notes: many(conversationNotes),
		flowSessions: many(flowSessions),
	}),
);

export const flowsRelations = relations(flows, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [flows.workspaceId],
		references: [workspaces.id],
	}),
	sessions: many(flowSessions),
}));

export const routingRulesRelations = relations(routingRules, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [routingRules.workspaceId],
		references: [workspaces.id],
	}),
}));

export const contactSegmentsRelations = relations(contactSegments, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [contactSegments.workspaceId],
		references: [workspaces.id],
	}),
}));

export const pushSubscriptionsRelations = relations(
	pushSubscriptions,
	({ one }) => ({
		user: one(users, {
			fields: [pushSubscriptions.userId],
			references: [users.id],
		}),
		workspace: one(workspaces, {
			fields: [pushSubscriptions.workspaceId],
			references: [workspaces.id],
		}),
	}),
);

export const visitorIdentitiesRelations = relations(
	visitorIdentities,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [visitorIdentities.workspaceId],
			references: [workspaces.id],
		}),
		contact: one(contacts, {
			fields: [visitorIdentities.contactId],
			references: [contacts.id],
		}),
	}),
);

export const pluginCatalogRelations = relations(pluginCatalog, ({ many }) => ({
	installed: many(installedPlugins),
}));

export const installedPluginsRelations = relations(
	installedPlugins,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [installedPlugins.workspaceId],
			references: [workspaces.id],
		}),
		catalog: one(pluginCatalog, {
			fields: [installedPlugins.pluginSlug],
			references: [pluginCatalog.slug],
		}),
		webhookEndpoint: one(webhookEndpoints, {
			fields: [installedPlugins.webhookEndpointId],
			references: [webhookEndpoints.id],
		}),
	}),
);

export const webhookEndpointsRelations = relations(
	webhookEndpoints,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [webhookEndpoints.workspaceId],
			references: [workspaces.id],
		}),
		deliveries: many(webhookDeliveries),
	}),
);

export const webhookDeliveriesRelations = relations(
	webhookDeliveries,
	({ one }) => ({
		endpoint: one(webhookEndpoints, {
			fields: [webhookDeliveries.endpointId],
			references: [webhookEndpoints.id],
		}),
		workspace: one(workspaces, {
			fields: [webhookDeliveries.workspaceId],
			references: [workspaces.id],
		}),
	}),
);

export const flowSessionsRelations = relations(flowSessions, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [flowSessions.workspaceId],
		references: [workspaces.id],
	}),
	flow: one(flows, {
		fields: [flowSessions.flowId],
		references: [flows.id],
	}),
	conversation: one(conversations, {
		fields: [flowSessions.conversationId],
		references: [conversations.id],
	}),
	contact: one(contacts, {
		fields: [flowSessions.contactId],
		references: [contacts.id],
	}),
}));

export const conversationTagsRelations = relations(
	conversationTags,
	({ one }) => ({
		conversation: one(conversations, {
			fields: [conversationTags.conversationId],
			references: [conversations.id],
		}),
	}),
);

export const conversationNotesRelations = relations(
	conversationNotes,
	({ one }) => ({
		conversation: one(conversations, {
			fields: [conversationNotes.conversationId],
			references: [conversations.id],
		}),
		author: one(users, {
			fields: [conversationNotes.authorId],
			references: [users.id],
		}),
	}),
);

export const messagesRelations = relations(messages, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [messages.workspaceId],
		references: [workspaces.id],
	}),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id],
	}),
	senderUser: one(users, {
		fields: [messages.senderUserId],
		references: [users.id],
	}),
	senderContact: one(contacts, {
		fields: [messages.senderContactId],
		references: [contacts.id],
	}),
}));

export const cannedResponsesRelations = relations(
	cannedResponses,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [cannedResponses.workspaceId],
			references: [workspaces.id],
		}),
	}),
);

export const knowledgeBasesRelations = relations(
	knowledgeBases,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [knowledgeBases.workspaceId],
			references: [workspaces.id],
		}),
		documents: many(kbDocuments),
	}),
);

export const kbDocumentsRelations = relations(kbDocuments, ({ one, many }) => ({
	workspace: one(workspaces, {
		fields: [kbDocuments.workspaceId],
		references: [workspaces.id],
	}),
	knowledgeBase: one(knowledgeBases, {
		fields: [kbDocuments.kbId],
		references: [knowledgeBases.id],
	}),
	chunks: many(kbChunks),
}));

export const kbChunksRelations = relations(kbChunks, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [kbChunks.workspaceId],
		references: [workspaces.id],
	}),
	document: one(kbDocuments, {
		fields: [kbChunks.documentId],
		references: [kbDocuments.id],
	}),
}));

export const aiInteractionsRelations = relations(aiInteractions, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [aiInteractions.workspaceId],
		references: [workspaces.id],
	}),
	conversation: one(conversations, {
		fields: [aiInteractions.conversationId],
		references: [conversations.id],
	}),
	message: one(messages, {
		fields: [aiInteractions.messageId],
		references: [messages.id],
	}),
}));

export const subscriptionsRelations = relations(
	subscriptions,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [subscriptions.workspaceId],
			references: [workspaces.id],
		}),
		payments: many(payments),
	}),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [payments.workspaceId],
		references: [workspaces.id],
	}),
	subscription: one(subscriptions, {
		fields: [payments.subscriptionId],
		references: [subscriptions.id],
	}),
}));
