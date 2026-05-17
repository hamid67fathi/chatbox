import { BuildBadge } from "@/components/BuildBadge";
import { ThemeProvider } from "@/components/ThemeProvider";
import { dmMono, dmSans, vazirmatn } from "@/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Chat-Box | داشبورد",
	description: "داشبورد مدیریت مکالمات",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="fa"
			dir="rtl"
			suppressHydrationWarning
			className={`${vazirmatn.variable} ${dmSans.variable} ${dmMono.variable}`}
		>
			<body className="min-h-screen font-sans">
				<ThemeProvider>
					{children}
					<BuildBadge />
				</ThemeProvider>
			</body>
		</html>
	);
}
