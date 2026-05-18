"use client";

import { Button } from "@/components/ui/button";
import { isStandaloneDisplay, pwaSupported, registerPwaServiceWorker } from "@/lib/pwa";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PwaContextValue = {
	online: boolean;
	installable: boolean;
	installed: boolean;
	promptInstall: () => Promise<void>;
};

const PwaContext = createContext<PwaContextValue>({
	online: true,
	installable: false,
	installed: false,
	promptInstall: async () => {},
});

export function usePwa() {
	return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: ReactNode }) {
	const [online, setOnline] = useState(true);
	const [installable, setInstallable] = useState(false);
	const [installed, setInstalled] = useState(false);
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		setOnline(navigator.onLine);
		setInstalled(isStandaloneDisplay());
		const onOnline = () => setOnline(true);
		const onOffline = () => setOnline(false);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, []);

	useEffect(() => {
		if (!pwaSupported()) return;
		void registerPwaServiceWorker();
	}, []);

	useEffect(() => {
		const onBip = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
			setInstallable(true);
		};
		window.addEventListener("beforeinstallprompt", onBip);
		return () => window.removeEventListener("beforeinstallprompt", onBip);
	}, []);

	const promptInstall = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		await deferredPrompt.userChoice;
		setDeferredPrompt(null);
		setInstallable(false);
	}, [deferredPrompt]);

	return (
		<PwaContext.Provider
			value={{ online, installable, installed, promptInstall }}
		>
			{!online && (
				<div
					className="fixed inset-x-0 top-0 z-[100] bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white"
					role="status"
				>
					آفلاین — آخرین لیست مکالمات از حافظه نمایش داده می‌شود
				</div>
			)}
			{children}
		</PwaContext.Provider>
	);
}

export function PwaInstallButton() {
	const { installable, installed, promptInstall } = usePwa();
	if (installed || !installable) return null;
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="text-xs"
			onClick={() => void promptInstall()}
		>
			نصب اپ
		</Button>
	);
}


