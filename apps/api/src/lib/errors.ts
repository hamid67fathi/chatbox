import type { FastifyReply, FastifyRequest } from "fastify";

interface ApiErrorOptions {
	code: string;
	message: string;
	statusCode: number;
	details?: Record<string, unknown>;
}

export class ApiError extends Error {
	code: string;
	statusCode: number;
	details?: Record<string, unknown>;

	constructor(opts: ApiErrorOptions) {
		super(opts.message);
		this.code = opts.code;
		this.statusCode = opts.statusCode;
		this.details = opts.details;
	}

	toJSON(requestId?: string) {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.details ? { details: this.details } : {}),
				...(requestId ? { request_id: requestId } : {}),
			},
		};
	}
}

export function notFound(message = "Resource not found") {
	return new ApiError({ code: "not_found", message, statusCode: 404 });
}

export function validationError(message: string, field?: string) {
	return new ApiError({
		code: "validation_error",
		message,
		statusCode: 400,
		details: field ? { field } : undefined,
	});
}

export function conflict(message: string) {
	return new ApiError({ code: "conflict", message, statusCode: 409 });
}

export const VISITOR_BLOCKED_MESSAGE =
	"شما مسدود شدید و امکان ارسال پیام ندارید";

export function contactBanned(message = VISITOR_BLOCKED_MESSAGE) {
	return new ApiError({
		code: "contact_banned",
		message,
		statusCode: 403,
	});
}

export function ipBanned(message = VISITOR_BLOCKED_MESSAGE) {
	return new ApiError({
		code: "ip_banned",
		message,
		statusCode: 403,
	});
}

export function aiBudgetExhausted(details: Record<string, unknown>) {
	return new ApiError({
		code: "ai_budget_exhausted",
		message:
			"اعتبار AI این workspace برای ماه جاری تمام شده است. لطفاً پلن را ارتقا دهید یا اعتبار اضافه خریداری کنید.",
		statusCode: 402,
		details,
	});
}

export function planLimitExceeded(details: Record<string, unknown>) {
	const custom =
		typeof details.message === "string" ? details.message : undefined;
	return new ApiError({
		code: "plan_limit_exceeded",
		message:
			custom ??
			"سقف پلن فعلی workspace پر شده است. لطفاً پلن را ارتقا دهید.",
		statusCode: 402,
		details,
	});
}

export function errorHandler(
	error: Error,
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (error instanceof ApiError) {
		return reply.status(error.statusCode).send(error.toJSON(request.id));
	}
	request.log.error(error);
	const expose =
		process.env.NODE_ENV !== "production" && error instanceof Error;
	return reply.status(500).send({
		error: {
			code: "internal_error",
			message: expose
				? error.message
				: "An unexpected error occurred.",
			request_id: request.id,
			...(expose && error.stack
				? { details: { stack: error.stack.split("\n").slice(0, 5) } }
				: {}),
		},
	});
}
