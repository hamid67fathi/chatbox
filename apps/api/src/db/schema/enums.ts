import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
	"owner",
	"admin",
	"agent",
	"viewer",
]);

export const userStatusEnum = pgEnum("user_status", [
	"active",
	"invited",
	"suspended",
]);

export const workspacePlanEnum = pgEnum("workspace_plan", [
	"free",
	"starter",
	"pro",
	"enterprise",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
	"open",
	"pending",
	"resolved",
	"closed",
	"spam",
]);

export const conversationChannelEnum = pgEnum("conversation_channel", [
	"widget",
	"telegram",
	"email",
	"whatsapp",
	"api",
]);

export const messageTypeEnum = pgEnum("message_type", [
	"text",
	"image",
	"file",
	"audio",
	"system",
	"ai_reply",
]);

export const messageSenderTypeEnum = pgEnum("message_sender_type", [
	"contact",
	"agent",
	"ai",
	"system",
]);

export const messageStatusEnum = pgEnum("message_status", [
	"queued",
	"sent",
	"delivered",
	"read",
	"failed",
]);

export const kbDocStatusEnum = pgEnum("kb_doc_status", [
	"uploaded",
	"processing",
	"indexed",
	"failed",
]);

export const aiInteractionTypeEnum = pgEnum("ai_interaction_type", [
	"auto_reply",
	"suggestion",
	"classification",
	"summary",
]);
