export function formatDurationSec(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	if (s < 60) return `${s.toLocaleString("fa-IR")} ثانیه`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	if (m < 60) {
		return rem > 0
			? `${m.toLocaleString("fa-IR")} دقیقه و ${rem.toLocaleString("fa-IR")} ثانیه`
			: `${m.toLocaleString("fa-IR")} دقیقه`;
	}
	const h = Math.floor(m / 60);
	const rm = m % 60;
	return rm > 0
		? `${h.toLocaleString("fa-IR")} ساعت و ${rm.toLocaleString("fa-IR")} دقیقه`
		: `${h.toLocaleString("fa-IR")} ساعت`;
}
