"use client";

import { publicAssetUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

function initials(fullName: string | null | undefined, email: string | null | undefined) {
	const name = fullName?.trim();
	if (name) {
		const parts = name.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	}
	return (email?.[0] ?? "?").toUpperCase();
}

interface Props {
	avatarUrl?: string | null;
	fullName?: string | null;
	email?: string | null;
	size?: "sm" | "md";
	className?: string;
}

export function AgentAvatar({
	avatarUrl,
	fullName,
	email,
	size = "md",
	className,
}: Props) {
	const src = publicAssetUrl(avatarUrl);
	const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

	if (src) {
		return (
			<img
				src={src}
				alt=""
				className={cn("shrink-0 rounded-full object-cover", dim, className)}
			/>
		);
	}

	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
				dim,
				className,
			)}
			aria-hidden
		>
			{initials(fullName, email)}
		</span>
	);
}
