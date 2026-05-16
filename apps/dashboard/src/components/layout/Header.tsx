"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { clearAuth } from "@/lib/auth-store";
import { disconnectSocket } from "@/lib/socket";
import { LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
	userEmail?: string;
	workspaceName?: string;
}

export function Header({ userEmail, workspaceName }: Props) {
	const router = useRouter();
	const { theme, toggleTheme } = useTheme();

	function handleLogout() {
		disconnectSocket();
		clearAuth();
		router.replace("/login");
	}

	return (
		<header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-foreground">
					{workspaceName ?? "ورک‌اسپیس"}
				</p>
				{userEmail && (
					<p className="truncate text-xs text-muted-foreground" dir="ltr">
						{userEmail}
					</p>
				)}
			</div>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={toggleTheme}
					aria-label={theme === "dark" ? "حالت روشن" : "حالت تاریک"}
				>
					{theme === "dark" ? (
						<Sun className="h-4 w-4" />
					) : (
						<Moon className="h-4 w-4" />
					)}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={handleLogout}
					aria-label="خروج"
				>
					<LogOut className="h-4 w-4" />
				</Button>
			</div>
		</header>
	);
}
