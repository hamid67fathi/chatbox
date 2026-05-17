import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "چت‌باکس | پشتیبانی هوشمند",
	description: "چت زنده و AI برای کسب‌وکارهای ایرانی",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fa" dir="rtl">
			<body>
				<SiteHeader />
				<main>{children}</main>
				<SiteFooter />
			</body>
		</html>
	);
}
