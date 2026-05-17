import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { payments, subscriptions, workspaces } from "../db/schema/index.js";
import {
	assertBillablePlan,
	cancelWorkspaceSubscription,
	getLastPaidPayment,
	startProTrial,
} from "../lib/billing-service.js";
import { BILLING_PLANS, plansForApi } from "../lib/billing-plans.js";
import { buildInvoicePdf } from "../lib/invoice-pdf.js";
import { notFound, validationError } from "../lib/errors.js";
import { requireWorkspace } from "../lib/rbac.js";
import { zarinpalRequestPayment } from "../lib/zarinpal.js";

export async function billingRoutes(app: FastifyInstance) {
	app.get("/v1/billing/plans", async () => ({
		plans: plansForApi(),
	}));

	app.get<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/subscription",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const sub = await db.query.subscriptions.findFirst({
				where: eq(subscriptions.workspaceId, request.params.workspace_id),
				orderBy: [desc(subscriptions.createdAt)],
			});
			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, request.params.workspace_id),
				columns: {
					plan: true,
					trialEndsAt: true,
				},
			});
			return {
				subscription: sub ?? null,
				workspace_plan: ws?.plan ?? "free",
				trial_ends_at: ws?.trialEndsAt?.toISOString() ?? null,
			};
		},
	);

	app.get<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/payments",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const rows = await db.query.payments.findMany({
				where: eq(payments.workspaceId, request.params.workspace_id),
				orderBy: [desc(payments.createdAt)],
				limit: 20,
			});
			return {
				data: rows.map((p) => ({
					id: p.id,
					amount_rial: p.amountRial,
					status: p.status,
					provider_ref_id: p.providerRefId,
					paid_at: p.paidAt?.toISOString() ?? null,
					created_at: p.createdAt.toISOString(),
					invoice_url:
						p.status === "paid"
							? `/v1/billing/payments/${p.id}/invoice`
							: null,
				})),
			};
		},
	);

	app.get<{ Params: { payment_id: string } }>(
		"/v1/billing/payments/:payment_id/invoice",
		async (request, reply) => {
			const payment = await db.query.payments.findFirst({
				where: eq(payments.id, request.params.payment_id),
			});
			if (!payment || payment.status !== "paid") {
				throw notFound("Paid payment not found.");
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, payment.workspaceId),
			});
			const sub = payment.subscriptionId
				? await db.query.subscriptions.findFirst({
						where: eq(subscriptions.id, payment.subscriptionId),
					})
				: null;

			const pdf = await buildInvoicePdf({
				invoiceNumber: payment.id.slice(0, 8).toUpperCase(),
				workspaceName: ws?.name ?? payment.workspaceId,
				plan: sub?.plan ?? ws?.plan ?? "—",
				amountRial: payment.amountRial,
				refId: payment.providerRefId ?? "—",
				paidAt: payment.paidAt ?? payment.createdAt,
			});

			return reply
				.header("Content-Type", "application/pdf")
				.header(
					"Content-Disposition",
					`attachment; filename="chatbox-invoice-${payment.id.slice(0, 8)}.pdf"`,
				)
				.send(Buffer.from(pdf));
		},
	);

	app.post<{
		Params: { workspace_id: string };
		Body: { plan: string };
	}>(
		"/v1/billing/:workspace_id/checkout",
		{ preHandler: [requireWorkspace("admin")] },
		async (request, reply) => {
			const { workspace_id } = request.params;
			const plan = assertBillablePlan(request.body?.plan ?? "");

			const def = BILLING_PLANS[plan];
			if (def.contactSales) {
				throw validationError(
					"Enterprise plan requires contacting sales.",
					"plan",
				);
			}

			const ws = await db.query.workspaces.findFirst({
				where: eq(workspaces.id, workspace_id),
			});
			if (!ws) throw notFound("Workspace not found.");

			const { authority, payUrl } = await zarinpalRequestPayment(
				def.priceRial,
				`اشتراک ${plan} — ${ws.name}`,
			);

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
					amountRial: def.priceRial,
					provider: "zarinpal",
					authority,
					status: "pending",
				})
				.returning();

			return reply.status(201).send({
				payment_id: payment.id,
				authority,
				redirect_url: payUrl,
			});
		},
	);

	app.post<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/trial",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			return startProTrial(request.params.workspace_id);
		},
	);

	app.post<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/cancel",
		{ preHandler: [requireWorkspace("admin")] },
		async (request) => {
			return cancelWorkspaceSubscription(request.params.workspace_id);
		},
	);

	app.get<{ Params: { workspace_id: string } }>(
		"/v1/billing/:workspace_id/last-invoice",
		{ preHandler: [requireWorkspace("viewer")] },
		async (request) => {
			const payment = await getLastPaidPayment(request.params.workspace_id);
			if (!payment) return { invoice_url: null };
			return {
				invoice_url: `/v1/billing/payments/${payment.id}/invoice`,
				payment_id: payment.id,
				paid_at: payment.paidAt?.toISOString() ?? null,
			};
		},
	);
}
