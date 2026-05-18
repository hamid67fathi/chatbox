/* ChatBox dashboard PWA — push + offline caching */
const SHELL_CACHE = "chatbox-shell-v1";
const ASSET_CACHE = "chatbox-assets-v1";

const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
					.map((k) => caches.delete(k)),
			),
		),
	);
	self.clients.claim();
});

function isSameOrigin(url) {
	try {
		return new URL(url).origin === self.location.origin;
	} catch {
		return false;
	}
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) {
		await cache.put(request, response.clone());
	}
	return response;
}

async function networkFirstNavigate(request, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) {
			await cache.put(request, response.clone());
		}
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		const root = await cache.match("/");
		if (root) return root;
		return new Response("آفلاین — اتصال برقرار نیست.", {
			status: 503,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	if (!isSameOrigin(request.url)) return;

	const url = new URL(request.url);

	if (
		url.pathname.startsWith("/_next/static/") ||
		url.pathname.startsWith("/fonts/") ||
		url.pathname.startsWith("/icons/")
	) {
		event.respondWith(cacheFirst(request, ASSET_CACHE));
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(networkFirstNavigate(request, SHELL_CACHE));
	}
});

self.addEventListener("push", (event) => {
	let data = { title: "ChatBox", body: "", url: "/" };
	try {
		data = event.data ? event.data.json() : data;
	} catch {
		/* ignore */
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "ChatBox", {
			body: data.body || "",
			tag: data.tag || "chatbox",
			data: { url: data.url || "/" },
			dir: "rtl",
			lang: "fa",
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || "/";
	event.waitUntil(
		clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((list) => {
				for (const client of list) {
					if (client.url.includes(url) && "focus" in client) {
						return client.focus();
					}
				}
				if (clients.openWindow) return clients.openWindow(url);
			}),
	);
});
