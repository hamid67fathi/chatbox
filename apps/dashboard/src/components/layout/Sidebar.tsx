"use client";

import { useBranding } from "@/components/BrandingProvider";
import { cn } from "@/lib/utils";
import {
	BookOpen,
	CreditCard,
	FileBarChart,
	GitBranch,
	LayoutDashboard,
	Route,
	Webhook,
	Puzzle,
	Globe,
	Inbox,
	Settings,
	Users,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{ href: "/", label: "صندوق ورودی", icon: Inbox },
	{ href: "/visitors", label: "بازدیدکنندگان آنلاین", icon: Globe },
	{ href: "/canned", label: "پاسخ‌های آماده", icon: Zap },
	{ href: "/flows", label: "جریان‌های گفتگو", icon: GitBranch },
	{ href: "/routing", label: "مسیریابی", icon: Route },
	{ href: "/integrations", label: "افزونه‌ها", icon: Puzzle },
	{ href: "/webhooks", label: "Webhook", icon: Webhook },
	{ href: "/companies", label: "شرکت‌ها", icon: Users },
	{ href: "/campaigns", label: "کمپین‌ها", icon: Zap },
	{ href: "/contacts", label: "مخاطبین", icon: Users },
	{ href: "/contacts/segments", label: "بخش مخاطبان", icon: Users },
	{ href: "/reports", label: "گزارش‌ها", icon: FileBarChart },
	{ href: "/reports/overview", label: "نمای کلی", icon: LayoutDashboard },
	{ href: "/reports/agents", label: "عملکرد اپراتور", icon: Users },
	{ href: "/billing", label: "اشتراک", icon: CreditCard },
	{ href: "/settings", label: "تنظیمات", icon: Settings },
	{ href: "/team", label: "تیم", icon: Users },
	{ href: "/knowledge", label: "پایگاه دانش", icon: BookOpen },
];

export function Sidebar() {
	const pathname = usePathname();
	const { title, logoUrl, whiteLabelActive, hideChatboxBrand } = useBranding();
	const showChatboxSubtitle = !whiteLabelActive || !hideChatboxBrand;

	return (
		<aside className="flex h-full w-56 shrink-0 flex-col border-e border-border bg-sidebar text-sidebar-foreground">
			<div className="flex h-14 items-center gap-2 border-b border-border px-4">
				{logoUrl ? (
					<img
						src={logoUrl}
						alt=""
						className="h-8 w-8 shrink-0 rounded-lg object-contain"
					/>
				) : (
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
						CB
					</div>
				)}
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold leading-tight">{title}</p>
					{showChatboxSubtitle && (
						<p className="text-xs text-muted-foreground">داشبورد اپراتور</p>
					)}
				</div>
			</div>
			<nav className="flex flex-1 flex-col gap-1 p-3">
				{navItems.map(({ href, label, icon: Icon }) => {
					const active =
						href === "/reports"
							? pathname === "/reports"
							: href.startsWith("/reports/")
								? pathname === href
								: pathname === href ||
									(href !== "/" && pathname.startsWith(`${href}/`));
					return (
						<Link
							key={href}
							href={href}
							className={cn(
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
								active
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
							)}
						>
							<Icon className="h-4 w-4" />
							{label}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
