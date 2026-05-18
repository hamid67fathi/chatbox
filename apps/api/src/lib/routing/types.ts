export type RoutingActionType =
	| "assign_agent"
	| "round_robin"
	| "enable_ai"
	| "set_priority";

export interface RoutingConditions {
	channels?: string[];
	keywords?: string[];
	keyword_mode?: "any" | "all";
	segment_id?: string;
}

export interface RoutingAction {
	type: RoutingActionType;
	agent_id?: string;
	agent_ids?: string[];
	priority?: number;
}

export interface RoutingRuleRow {
	id: string;
	workspaceId: string;
	name: string;
	enabled: boolean;
	priority: number;
	conditions: RoutingConditions;
	action: RoutingAction;
}

export interface RoutingContext {
	workspaceId: string;
	conversationId: string;
	channel: string;
	messageText?: string;
	trigger: "conversation_created" | "contact_message";
}
