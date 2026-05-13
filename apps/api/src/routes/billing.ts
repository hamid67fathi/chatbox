import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { payments, subscriptions, workspaces } from "../db/schema/index.js";
import { notFound, validationError } from "../lib/errors.js";

const ZARINPAL_SANDBOX = "https://sandbox.zarinpal.com/pg/v4";
const ZARINPAL_MERCHANT =
	process.env.ZARINPAL_MERCHANT_ID ?? "00000000-0000-0000-0000-000000000000";
const ZARINPAL_CALLBACK =
	process.env.ZARINPAL_CALLBACK_URL ??
	"http://localhost:3001/v1/billing/verify";

const PLAN_PRICES: Record<string, number> = {
	starter: 990_000,
	pro: 2_490_000,
	enterprise: 9_900_000,
};

export async function billingRoutes(app: FastifyInstance) {
	app.get("/v1/billing/plans", async () => ({
		plans: Object.entries(PLAN_PRICES).map(([name, priceRial]) => ({
			name,
			price_rial: priceRial,
			price_display: `${(priceRial / 10).toLocaleString("fa-IR")} تومان`,
		})),
	}));

	app.get<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/subscription",
		async (request) => {
			const sub = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.workspaceId, request.params.workspace_id),
				orderBy: (s, { desc }) => desc(s.createdAt),
			});
			return { subscription: sub ?? null };
		},
	);

	app.post<{
		Params: { workspace_id: string };
		Body: { plan: string };
	}>("/v1/billing/:workspace_id/checkout", async (request, reply) => {
		const { workspace_id } = request.params;
		const { plan } = request.body ?? {};

		if (!plan || !PLAN_PRICES[plan])
			throw validationError(
				`Invalid plan. Choose: ${Object.keys(PLAN_PRICES).join(", ")}`,
				"plan",
			);

		const ws = await db.query.workspaces.findFirst({
			where: eq(workspaces.id, workspace_id),
		});
		if (!ws) throw notFound("Workspace not found.");

		const amount = PLAN_PRICES[plan];

		let authority: string;
		try {
			const resp = await fetch(`${ZARINPAL_SANDBOX}/payment/request.json`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					merchant_id: ZARINPAL_MERCHANT,
					amount,
					callback_url: ZARINPAL_CALLBACK,
					description: `اشتراک ${plan} — ${ws.name}`,
				}),
			});
			const data = (await resp.json()) as {
				data?: { authority?: string };
			};
			authority = data?.data?.authority ?? `SANDBOX-${crypto.randomUUID()}`;
		} catch {
			authority = `SANDBOX-${crypto.randomUUID()}`;
		}

		const [sub] = await db
			.insert(subscriptions)
			.values({
				workspaceId: workspace_id,
				plan,
				status: "trialing",
			})
			.returning();

		const [payment] = await db
			.insert(payments)
			.values({
				workspaceId: workspace_id,
				subscriptionId: sub.id,
				amountRial: amount,
				provider: "zarinpal",
				authority,
				status: "pending",
			})
			.returning();

		return reply.status(201).send({
			payment_id: payment.id,
			authority,
			redirect_url: `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
		});
	});

	app.get<{
		Querystring: { Authority: string; Status: string };
	}>("/v1/billing/verify", async (request, reply) => {
		const { Authority, Status } = request.query;

		if (!Authority)
			throw validationError("Authority is required.", "Authority");

		const payment = await db.query.payments.findFirst({
			where: and(
				eq(payments.authority, Authority),
				eq(payments.status, "pending"),
			),
		});
		if (!payment) throw notFound("Payment not found or already processed.");

		if (Status !== "OK") {
			await db
				.update(payments)
				.set({ status: "failed" })
				.where(eq(payments.id, payment.id));

			return reply.send({ ok: false, message: "Payment cancelled by user." });
		}

		let refId: string | null = null;
		try {
			const resp = await fetch(`${ZARINPAL_SANDBOX}/payment/verify.json`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					merchant_id: ZARINPAL_MERCHANT,
					amount: payment.amountRial,
					authority: Authority,
				}),
			});
			const data = (await resp.json()) as {
				data?: { ref_id?: number; code?: number };
			};
			refId = data?.data?.ref_id?.toString() ?? null;
		} catch {
			refId = `SANDBOX-VERIFIED-${Date.now()}`;
		}

		await db
			.update(payments)
			.set({
				status: "paid",
				providerRefId: refId,
				paidAt: new Date(),
			})
			.where(eq(payments.id, payment.id));

		if (payment.subscriptionId) {
			const now = new Date();
			const periodEnd = new Date(now);
			periodEnd.setMonth(periodEnd.getMonth() + 1);

			await db
				.update(subscriptions)
				.set({
					status: "active",
					periodStart: now,
					periodEnd,
					updatedAt: now,
				})
				.where(eq(subscriptions.id, payment.subscriptionId));
		}

		return reply.send({
			ok: true,
			ref_id: refId,
			payment_id: payment.id,
		});
	});
}
