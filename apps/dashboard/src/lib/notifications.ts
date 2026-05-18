import {
	fetchNotificationPreferences as fetchNotificationPreferencesFromApi,
	savePushSubscription,
	removePushSubscription,
} from "@/lib/api";
import { registerPwaServiceWorker } from "@/lib/pwa";

export { fetchNotificationPreferencesFromApi as fetchNotificationPreferences };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function urlBase64ToApplicationServerKey(base64String: string): ArrayBuffer {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const buffer = new ArrayBuffer(raw.length);
	const out = new Uint8Array(buffer);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return buffer;
}

export function pushSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

export async function fetchVapidPublicKey(): Promise<string | null> {
	const res = await fetch(`${API_URL}/v1/push/vapid-public-key`, {
		credentials: "include",
	});
	if (!res.ok) return null;
	const json = (await res.json()) as {
		data?: { public_key?: string | null; configured?: boolean };
	};
	if (!json.data?.configured || !json.data.public_key) return null;
	return json.data.public_key;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	return registerPwaServiceWorker();
}

export async function subscribeToPush(
	workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
	if (!pushSupported()) {
		return { ok: false, error: "مرورگر از Push پشتیبانی نمی‌کند." };
	}

	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		return { ok: false, error: "اجازه اعلان داده نشد." };
	}

	const publicKey = await fetchVapidPublicKey();
	if (!publicKey) {
		return {
			ok: false,
			error: "سرور Push پیکربندی نشده (VAPID keys).",
		};
	}

	const reg = await registerServiceWorker();
	if (!reg) return { ok: false, error: "ثبت Service Worker ناموفق بود." };

	const sub = await reg.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToApplicationServerKey(publicKey),
	});

	const json = sub.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
		return { ok: false, error: "اشتراک Push نامعتبر است." };
	}

	const saved = await savePushSubscription(workspaceId, {
		endpoint: json.endpoint,
		keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
	});
	if (!saved) {
		return { ok: false, error: "ذخیره اشتراک در سرور ناموفق بود." };
	}
	return { ok: true };
}

export async function unsubscribeFromPush(
	workspaceId: string,
): Promise<boolean> {
	if (!pushSupported()) return false;
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.getSubscription();
	if (!sub) return true;
	const endpoint = sub.endpoint;
	await sub.unsubscribe();
	await removePushSubscription(workspaceId, endpoint);
	return true;
}

export async function getLocalPushSubscription(): Promise<PushSubscription | null> {
	if (!pushSupported()) return null;
	try {
		const reg = await navigator.serviceWorker.ready;
		return reg.pushManager.getSubscription();
	} catch {
		return null;
	}
}
