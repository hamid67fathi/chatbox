import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { clearAuth, getAuth, getWorkspaceId, setAuth } from "../lib/auth";
import type { AuthData } from "../lib/types";

type AuthContextValue = {
	auth: AuthData | null;
	workspaceId: string | null;
	loading: boolean;
	signIn: (data: AuthData) => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	auth: null,
	workspaceId: null,
	loading: true,
	signIn: async () => {},
	signOut: async () => {},
});

export function useAuth() {
	return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [auth, setAuthState] = useState<AuthData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void (async () => {
			const stored = await getAuth();
			setAuthState(stored);
			setLoading(false);
		})();
	}, []);

	const signIn = useCallback(async (data: AuthData) => {
		await setAuth(data);
		setAuthState(data);
	}, []);

	const signOut = useCallback(async () => {
		await clearAuth();
		setAuthState(null);
	}, []);

	const value = useMemo(
		(): AuthContextValue => ({
			auth,
			workspaceId: getWorkspaceId(auth),
			loading,
			signIn,
			signOut,
		}),
		[auth, loading, signIn, signOut],
	);

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}
