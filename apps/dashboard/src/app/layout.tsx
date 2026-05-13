import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Chat-Box | داشبورد",
	description: "داشبورد مدیریت مکالمات",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fa" dir="rtl">
			<body>{children}</body>
		</html>
	);
}
