import { relations } from "drizzle-orm";
import { cannedResponses } from "./canned-responses.js";
import { contacts } from "./contacts.js";
import {
	conversationNotes,
	conversationTags,
	conversations,
} from "./conversations.js";
import { messages } from "./messages.js";
import { users } from "./users.js";
import { workspaceMembers } from "./workspace-members.js";
import { workspaces } from "./workspaces.js";

export const workspacesRelations = relations(workspaces, ({ many }) => ({
	members: many(workspaceMembers),
	contacts: many(contacts),
	conversations: many(conversations),
	cannedResponses: many(cannedResponses),
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
