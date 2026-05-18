import { BuildBadge } from "@/components/BuildBadge";
import { PwaProvider } from "@/components/PwaProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { dmMono, dmSans, vazirmatn } from "@/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Chat-Box | داشبورد",
	description: "داشبورد مدیریت مکالمات",
	manifest: "/manifest.webmanifest",
	appleWebApp: {
		capable: true,
		title: "ChatBox",
		statusBarStyle: "default",
	},
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#7c3aed" },
		{ media: "(prefers-color-scheme: dark)", color: "#0f172a" },
	],
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="fa"
			dir="rtl"
			suppressHydrationWarning
			className={`${vazirmatn.variable} ${dmSans.variable} ${dmMono.variable}`}
		>
			<body
				className={`min-h-screen font-sans ${vazirmatn.className} ${dmSans.className}`}
			>
				<ThemeProvider>
					<PwaProvider>
						{children}
						<BuildBadge />
					</PwaProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
