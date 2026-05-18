export function pwaSupported(): boolean {
	return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!pwaSupported()) return null;
	try {
		const reg = await navigator.serviceWorker.register("/sw.js");
		return reg;
	} catch {
		return null;
	}
}

export function isStandaloneDisplay(): boolean {
	if (typeof window === "undefined") return false;
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		// iOS Safari
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}
