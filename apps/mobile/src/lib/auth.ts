import * as SecureStore from "expo-secure-store";
import type { AuthData } from "./types";

const STORAGE_KEY = "chatbox_auth";

export async function getAuth(): Promise<AuthData | null> {
	try {
		const raw = await SecureStore.getItemAsync(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as AuthData) : null;
	} catch {
		return null;
	}
}

export async function setAuth(data: AuthData): Promise<void> {
	await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAuth(): Promise<void> {
	await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export async function getAccessToken(): Promise<string | null> {
	const auth = await getAuth();
	return auth?.access_token ?? null;
}

export function getWorkspaceId(auth: AuthData | null): string | null {
	return auth?.user?.workspaces?.[0]?.id ?? null;
}
