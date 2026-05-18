export type SlaMetricState = "pending" | "ok" | "warning" | "breached" | "disabled";

export interface SlaPolicyConfig {
	enabled: boolean;
	first_response_minutes: number;
	resolution_minutes: number;
	warn_at_percent: number;
}

export interface SlaStatusPublic {
	enabled: boolean;
	first_response: SlaMetricState;
	resolution: SlaMetricState;
	first_response_due_at: string | null;
	resolution_due_at: string | null;
	first_response_remaining_sec: number | null;
	resolution_remaining_sec: number | null;
}

export interface ConversationSlaInput {
	createdAt: Date;
	firstResponseAt: Date | null;
	firstResponseSec: number | null;
	resolvedAt: Date | null;
	closedAt: Date | null;
	status: string;
}
