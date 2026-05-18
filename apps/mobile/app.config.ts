import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
	name: "ChatBox Agent",
	slug: "chatbox-agent",
	version: "1.0.0",
	orientation: "portrait",
	icon: "./assets/icon.png",
	userInterfaceStyle: "light",
	newArchEnabled: true,
	scheme: "chatbox",
	plugins: ["expo-router", "expo-secure-store"],
	splash: {
		image: "./assets/splash-icon.png",
		resizeMode: "contain",
		backgroundColor: "#7c3aed",
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: "com.chatbox.agent",
	},
	android: {
		adaptiveIcon: {
			foregroundImage: "./assets/adaptive-icon.png",
			backgroundColor: "#7c3aed",
		},
		package: "com.chatbox.agent",
		edgeToEdgeEnabled: true,
	},
	web: {
		favicon: "./assets/favicon.png",
	},
	extra: {
		apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
		router: {},
	},
};

export default config;
