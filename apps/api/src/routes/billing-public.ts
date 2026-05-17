import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { payments, subscriptions } from "../db/schema/index.js";
import { isBillablePlan } from "../lib/billing-plans.js";
import { activatePaidSubscription } from "../lib/billing-service.js";
import { notFound, validationError } from "../lib/errors.js";
import { getZarinpalConfig } from "../lib/zarinpal.js";
import { zarinpalVerifyPayment } from "../lib/zarinpal.js";

const DASHBOARD_URL =
	process.env.DASHBOARD_BILLING_URL ??
	process.env.DASHBOARD_URL ??
	"http://localhost:3000";

function billingRedirect(status: "success" | "cancelled" | "error", ref?: string) {
	const q = new URLSearchParams({ payment: status });
	if (ref) q.set("ref", ref);
	return `${DASHBOARD_URL}/billing?${q.toString()}`;
}

async function completePayment(
	authority: string,
	statusOk: boolean,
): Promise<{ refId: string } | null> {
	const payment = await db.query.payments.findFirst({
		where: and(
			eq(payments.authority, authority),
			eq(payments.status, "pending"),
		),
	});
	if (!payment) return null;

	if (!statusOk) {
		await db
			.update(payments)
			.set({ status: "failed" })
			.where(eq(payments.id, payment.id));
		return null;
	}

	let refId: string;
	try {
		const verified = await zarinpalVerifyPayment(
			payment.amountRial,
			authority,
		);
		refId = verified.refId;
	} catch {
		await db
			.update(payments)
			.set({ status: "failed" })
			.where(eq(payments.id, payment.id));
		return null;
	}

	const now = new Date();
	await db
		.update(payments)
		.set({
			status: "paid",
			providerRefId: refId,
			paidAt: now,
		})
		.where(eq(payments.id, payment.id));

	if (payment.subscriptionId) {
		const sub = await db.query.subscriptions.findFirst({
			where: eq(subscriptions.id, payment.subscriptionId),
		});
		if (sub?.plan && isBillablePlan(sub.plan)) {
			await activatePaidSubscription(
				payment.workspaceId,
				sub.plan,
				payment.subscriptionId,
			);
		}
	}

	return { refId };
}

/** Public billing callbacks (no JWT) — Zarinpal redirect + webhook. */
export async function billingPublicRoutes(app: FastifyInstance) {
	app.get<{
		Querystring: { Authority: string; Status: string };
	}>("/v1/billing/verify", async (request, reply) => {
		const { Authority, Status } = request.query;

		if (!Authority) throw validationError("Authority is required.", "Authority");

		const pending = await db.query.payments.findFirst({
			where: and(
				eq(payments.authority, Authority),
				eq(payments.status, "pending"),
			),
		});
		if (!pending) {
			return reply.redirect(billingRedirect("error"));
		}

		if (Status !== "OK") {
			await completePayment(Authority, false);
			return reply.redirect(billingRedirect("cancelled"));
		}

		const result = await completePayment(Authority, true);
		if (!result) {
			return reply.redirect(billingRedirect("error"));
		}

		return reply.redirect(billingRedirect("success", result.refId));
	});

	app.post<{
		Body: {
			authority?: string;
			Authority?: string;
			status?: string;
			Status?: string;
		};
	}>("/v1/billing/webhook/zarinpal", async (request, reply) => {
		const body = request.body ?? {};
		const authority = body.authority ?? body.Authority;
		const status = body.status ?? body.Status;

		if (!authority) {
			return reply.status(400).send({ ok: false, error: "authority required" });
		}

		const ok = status === "OK" || status === "ok";
		const result = await completePayment(authority, ok);

		if (!result) {
			const existing = await db.query.payments.findFirst({
				where: eq(payments.authority, authority),
			});
			if (!existing) throw notFound("Payment not found.");
			return reply.send({ ok: true, already_processed: true });
		}

		return reply.send({ ok: true, ref_id: result.refId });
	});

	app.get("/v1/billing/config", async () => {
		const cfg = getZarinpalConfig();
		return {
			sandbox: cfg.sandbox,
			callback_url: cfg.callbackUrl,
		};
	});
}
