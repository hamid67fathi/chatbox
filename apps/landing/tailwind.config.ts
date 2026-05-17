import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					DEFAULT: "#2563eb",
					dark: "#1d4ed8",
					light: "#3b82f6",
				},
			},
			fontFamily: {
				sans: [
					"var(--font-vazir)",
					"var(--font-dm-sans)",
					"Segoe UI",
					"Tahoma",
					"system-ui",
					"sans-serif",
				],
				display: ["var(--font-display)", "var(--font-vazir)", "serif"],
			},
		},
	},
	plugins: [],
};

export default config;
