import { UI_BUILD } from "@/lib/build-info";

/** نشانگر build — برای تشخیص کش مرورگر؛ هر deploy باید عدد جدید نشان دهد. */
export function BuildBadge() {
	return (
		<div
			className="pointer-events-none fixed bottom-2 start-2 z-[9999] rounded-md border border-border bg-card/95 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm"
			title="شماره build داشبورد — اگر بعد از git pull عدد عوض نشد، کش مرورگر است"
		>
			UI build {UI_BUILD}
		</div>
	);
}
