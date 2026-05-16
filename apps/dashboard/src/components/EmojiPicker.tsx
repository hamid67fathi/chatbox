"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const EMOJIS = [
	"😀",
	"😊",
	"🙂",
	"😉",
	"😍",
	"🤔",
	"👍",
	"🙏",
	"❤️",
	"😂",
	"🎉",
	"✅",
	"⭐",
	"🔥",
	"💬",
	"📎",
	"📷",
	"🕐",
	"👋",
	"💡",
];

interface Props {
	onPick: (emoji: string) => void;
	disabled?: boolean;
}

export function EmojiPicker({ onPick, disabled }: Props) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open]);

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				disabled={disabled}
				className="flex h-9 w-9 items-center justify-center rounded-md border border-input text-lg hover:bg-accent disabled:opacity-50"
				onClick={() => setOpen((v) => !v)}
				title="ایموجی"
			>
				😊
			</button>
			{open && (
				<div
					className={cn(
						"absolute bottom-full end-0 z-20 mb-1 grid w-[220px] grid-cols-5 gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg",
					)}
				>
					{EMOJIS.map((e) => (
						<button
							key={e}
							type="button"
							className="rounded p-1 text-lg hover:bg-accent"
							onClick={() => {
								onPick(e);
								setOpen(false);
							}}
						>
							{e}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
