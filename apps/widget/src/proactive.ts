export interface ProactiveRulePublic {
	id: string;
	trigger_type: string;
	conditions: Record<string, unknown>;
	message: string;
	throttle_days: number;
}

const STORAGE_PREFIX = "cbx_proactive_";

export async function fetchProactiveRules(
	apiUrl: string,
	workspaceSlug: string,
): Promise<ProactiveRulePublic[]> {
	const url = new URL(`${apiUrl.replace(/\/$/, "")}/v1/widget/proactive-rules`);
	url.searchParams.set("workspace_slug", workspaceSlug);
	const res = await fetch(url.toString());
	if (!res.ok) return [];
	const body = (await res.json()) as { data?: ProactiveRulePublic[] };
	return body.data ?? [];
}

export function shouldShowProactive(
	rule: ProactiveRulePublic,
	workspaceSlug: string,
): boolean {
	const key = `${STORAGE_PREFIX}${workspaceSlug}_${rule.id}`;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return true;
		const last = Number(raw);
		const days = rule.throttle_days || 7;
		return Date.now() - last > days * 86_400_000;
	} catch {
		return true;
	}
}

export function markProactiveShown(rule: ProactiveRulePublic, workspaceSlug: string): void {
	try {
		localStorage.setItem(
			`${STORAGE_PREFIX}${workspaceSlug}_${rule.id}`,
			String(Date.now()),
		);
	} catch {
		/* ignore */
	}
}

export function bindProactiveTriggers(
	rules: ProactiveRulePublic[],
	workspaceSlug: string,
	onShow: (message: string) => void,
): () => void {
	const timers: ReturnType<typeof setTimeout>[] = [];

	for (const rule of rules) {
		if (!shouldShowProactive(rule, workspaceSlug)) continue;

		if (rule.trigger_type === "time_on_page") {
			const seconds = Number(rule.conditions?.seconds ?? 30);
			const t = setTimeout(() => {
				if (!shouldShowProactive(rule, workspaceSlug)) return;
				markProactiveShown(rule, workspaceSlug);
				onShow(rule.message);
			}, Math.max(5, seconds) * 1000);
			timers.push(t);
		}

		if (rule.trigger_type === "exit_intent") {
			const handler = (e: MouseEvent) => {
				if (e.clientY > 40) return;
				if (!shouldShowProactive(rule, workspaceSlug)) return;
				markProactiveShown(rule, workspaceSlug);
				onShow(rule.message);
				document.removeEventListener("mouseout", handler);
			};
			document.addEventListener("mouseout", handler);
		}
	}

	return () => {
		for (const t of timers) clearTimeout(t);
	};
}
