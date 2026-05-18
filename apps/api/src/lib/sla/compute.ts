import type {
	ConversationSlaInput,
	SlaMetricState,
	SlaPolicyConfig,
	SlaStatusPublic,
} from "./types.js";

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60_000);
}

function metricState(
	now: Date,
	dueAt: Date,
	completedAt: Date | null,
	warnAt: Date,
	enabled: boolean,
): SlaMetricState {
	if (!enabled) return "disabled";
	if (completedAt) {
		return completedAt.getTime() <= dueAt.getTime() ? "ok" : "breached";
	}
	if (now.getTime() > dueAt.getTime()) return "breached";
	if (now.getTime() >= warnAt.getTime()) return "warning";
	return "pending";
}

function remainingSec(now: Date, dueAt: Date, completed: boolean): number | null {
	if (completed) return null;
	return Math.max(0, Math.floor((dueAt.getTime() - now.getTime()) / 1000));
}

export function defaultSlaPolicyForPlan(plan: string): SlaPolicyConfig {
	switch (plan) {
		case "enterprise":
			return {
				enabled: true,
				first_response_minutes: 2,
				resolution_minutes: 240,
				warn_at_percent: 80,
			};
		case "pro":
			return {
				enabled: true,
				first_response_minutes: 5,
				resolution_minutes: 480,
				warn_at_percent: 80,
			};
		case "starter":
			return {
				enabled: true,
				first_response_minutes: 10,
				resolution_minutes: 720,
				warn_at_percent: 80,
			};
		default:
			return {
				enabled: true,
				first_response_minutes: 15,
				resolution_minutes: 1440,
				warn_at_percent: 80,
			};
	}
}

export function computeSlaStatus(
	conv: ConversationSlaInput,
	policy: SlaPolicyConfig,
	now: Date = new Date(),
): SlaStatusPublic {
	if (!policy.enabled) {
		return {
			enabled: false,
			first_response: "disabled",
			resolution: "disabled",
			first_response_due_at: null,
			resolution_due_at: null,
			first_response_remaining_sec: null,
			resolution_remaining_sec: null,
		};
	}

	const created = conv.createdAt;
	const frDue = addMinutes(created, policy.first_response_minutes);
	const resDue = addMinutes(created, policy.resolution_minutes);
	const warnRatio = Math.min(100, Math.max(50, policy.warn_at_percent)) / 100;

	const frWarn = new Date(
		created.getTime() +
			(frDue.getTime() - created.getTime()) * warnRatio,
	);
	const resWarn = new Date(
		created.getTime() +
			(resDue.getTime() - created.getTime()) * warnRatio,
	);

	const firstResponseAt =
		conv.firstResponseAt ??
		(conv.firstResponseSec != null
			? new Date(created.getTime() + conv.firstResponseSec * 1000)
			: null);

	const isTerminal =
		conv.status === "resolved" || conv.status === "closed";
	const resolvedAt =
		conv.resolvedAt ?? (isTerminal ? conv.closedAt : null);

	const frState = metricState(now, frDue, firstResponseAt, frWarn, true);
	const resState = metricState(now, resDue, resolvedAt, resWarn, true);

	return {
		enabled: true,
		first_response: frState,
		resolution: isTerminal ? resState : resState,
		first_response_due_at: frDue.toISOString(),
		resolution_due_at: resDue.toISOString(),
		first_response_remaining_sec: remainingSec(
			now,
			frDue,
			firstResponseAt != null,
		),
		resolution_remaining_sec: remainingSec(now, resDue, resolvedAt != null),
	};
}

export function formatSlaRemaining(sec: number | null): string {
	if (sec == null) return "";
	if (sec <= 0) return "منقضی";
	const m = Math.floor(sec / 60);
	if (m < 60) return `${m}د`;
	const h = Math.floor(m / 60);
	return `${h}س`;
}
