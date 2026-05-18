import { refreshAgentPerformanceView } from "./index.js";

let lastRefreshAt: Date | null = null;
let refreshInFlight: Promise<void> | null = null;

export function getAgentPerformanceLastRefresh(): Date | null {
	return lastRefreshAt;
}

export async function runAgentPerformanceRefresh(): Promise<void> {
	if (refreshInFlight) {
		await refreshInFlight;
		return;
	}
	refreshInFlight = (async () => {
		try {
			await refreshAgentPerformanceView();
			lastRefreshAt = new Date();
		} finally {
			refreshInFlight = null;
		}
	})();
	await refreshInFlight;
}
