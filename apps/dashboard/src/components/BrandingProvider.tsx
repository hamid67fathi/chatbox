"use client";

import { fetchBranding, publicAssetUrl, type BrandingResponse } from "@/lib/api";
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

const DEFAULT_TITLE = "ChatBox";

type BrandingContextValue = {
	loading: boolean;
	enterprise: boolean;
	whiteLabelActive: boolean;
	title: string;
	logoUrl: string | null;
	primaryColor: string | null;
	hideChatboxBrand: boolean;
	refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
	loading: true,
	enterprise: false,
	whiteLabelActive: false,
	title: DEFAULT_TITLE,
	logoUrl: null,
	primaryColor: null,
	hideChatboxBrand: false,
	refresh: async () => {},
});

export function useBranding() {
	return useContext(BrandingContext);
}

export function BrandingProvider({
	workspaceId,
	children,
}: {
	workspaceId?: string;
	children: ReactNode;
}) {
	const [data, setData] = useState<BrandingResponse | null>(null);
	const [loading, setLoading] = useState(Boolean(workspaceId));

	const load = async () => {
		if (!workspaceId) {
			setData(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		const res = await fetchBranding(workspaceId);
		setData(res);
		setLoading(false);
	};

	useEffect(() => {
		void load();
	}, [workspaceId]);

	const value = useMemo((): BrandingContextValue => {
		const dash = data?.dashboard;
		return {
			loading,
			enterprise: data?.enterprise ?? false,
			whiteLabelActive: data?.white_label_active ?? false,
			title: dash?.title ?? DEFAULT_TITLE,
			logoUrl: dash?.logo_url ? publicAssetUrl(dash.logo_url) : null,
			primaryColor: dash?.primary_color ?? null,
			hideChatboxBrand: dash?.hide_chatbox_brand ?? false,
			refresh: load,
		};
	}, [data, loading, workspaceId]);

	useEffect(() => {
		const root = document.documentElement;
		if (value.primaryColor) {
			root.style.setProperty("--primary", value.primaryColor);
		} else {
			root.style.removeProperty("--primary");
		}
	}, [value.primaryColor]);

	return (
		<BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
	);
}
