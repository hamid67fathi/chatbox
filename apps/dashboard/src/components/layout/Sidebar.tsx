"use client";

import { cn } from "@/lib/utils";
import { BookOpen, CreditCard, Inbox, Settings, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
	{ href: "/", label: "صندوق ورودی", icon: Inbox },
	{ href: "/canned", label: "پاسخ‌های آماده", icon: Zap },
	{ href: "/billing", label: "اشتراک", icon: CreditCard },
	{ href: "/settings", label: "تنظیمات", icon: Settings },
	{ href: "/team", label: "تیم", icon: Users },
	{ href: "/knowledge", label: "پایگاه دانش", icon: BookOpen },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="flex h-full w-56 shrink-0 flex-col border-e border-border bg-sidebar text-sidebar-foreground">
			<div className="flex h-14 items-center gap-2 border-b border-border px-4">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
					CB
				</div>
				<div>
					<p className="text-sm font-semibold leading-tight">ChatBox</p>
					<p className="text-xs text-muted-foreground">داشبورد اپراتور</p>
				</div>
			</div>
			<nav className="flex flex-1 flex-col gap-1 p-3">
				{navItems.map(({ href, label, icon: Icon }) => {
					const active = pathname === href;
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
