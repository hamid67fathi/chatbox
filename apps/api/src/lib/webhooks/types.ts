export const WEBHOOK_EVENTS = [
	"conversation.created",
	"message.created",
	"conversation.resolved",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookDispatchJob {
	deliveryId: string;
	endpointId: string;
	workspaceId: string;
	url: string;
	secret: string;
	event: WebhookEventType;
	payload: Record<string, unknown>;
}
