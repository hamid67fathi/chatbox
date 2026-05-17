import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoiceInput {
	invoiceNumber: string;
	workspaceName: string;
	plan: string;
	amountRial: number;
	refId: string;
	paidAt: Date;
}

export async function buildInvoicePdf(input: InvoiceInput): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595, 842]);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);

	const lines: Array<{ text: string; size: number; bold?: boolean }> = [
		{ text: "Chat-Box Invoice / Faktur", size: 18, bold: true },
		{ text: `No: ${input.invoiceNumber}`, size: 11 },
		{ text: `Date: ${input.paidAt.toISOString().slice(0, 10)}`, size: 11 },
		{ text: "", size: 8 },
		{ text: `Workspace: ${input.workspaceName}`, size: 12 },
		{ text: `Plan: ${input.plan}`, size: 12 },
		{
			text: `Amount: ${input.amountRial.toLocaleString("en-US")} Rial (${(input.amountRial / 10).toLocaleString("en-US")} Toman)`,
			size: 12,
		},
		{ text: `Zarinpal Ref: ${input.refId}`, size: 11 },
		{ text: "", size: 8 },
		{ text: "Thank you for your payment.", size: 11 },
	];

	let y = 780;
	for (const line of lines) {
		if (!line.text) {
			y -= 12;
			continue;
		}
		page.drawText(line.text, {
			x: 50,
			y,
			size: line.size,
			font: line.bold ? bold : font,
			color: rgb(0.1, 0.1, 0.15),
		});
		y -= line.size + 10;
	}

	return doc.save();
}
