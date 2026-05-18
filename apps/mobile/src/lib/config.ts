import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

export const API_URL = extra?.apiUrl ?? "http://localhost:3001";
