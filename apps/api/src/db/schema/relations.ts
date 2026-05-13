import { relations } from "drizzle-orm";
import { aiInteractions } from "./ai-interactions.js";
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
import { users } from "./users.js";
import { workspaceMembers } from "./workspace-members.js";
import { workspaces } from "./workspaces.js";

export const workspacesRelations = relations(workspaces, ({ many }) => ({
	members: many(workspaceMembers),
	contacts: many(contacts),
	conversations: many(conversations),
	cannedResponses: many(cannedResponses),
	knowledgeBases: many(knowledgeBases),
	aiInteractions: many(aiInteractions),
}));

export const usersRelations = relations(users, ({ many }) => ({
	memberships: many(workspaceMembers),
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
	}),
);

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
