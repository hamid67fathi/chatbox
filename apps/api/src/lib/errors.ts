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

export function aiBudgetExhausted(details: Record<string, unknown>) {
	return new ApiError({
		code: "ai_budget_exhausted",
		message:
			"اعتبار AI این workspace برای ماه جاری تمام شده است. لطفاً پلن را ارتقا دهید یا اعتبار اضافه خریداری کنید.",
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
	return reply.status(500).send({
		error: {
			code: "internal_error",
			message: "An unexpected error occurred.",
			request_id: request.id,
		},
	});
}
