"use client";

import type { CannedResponse } from "@/lib/api";
import { applyCannedVariables, defaultCannedVariables, filterCannedByQuery } from "@/lib/canned";
import { cn } from "@/lib/utils";

interface Props {
	items: CannedResponse[];
	query: string;
	contactName?: string | null;
	onSelect: (text: string, item: CannedResponse) => void;
}

export function CannedResponsePicker({ items, query, contactName, onSelect }: Props) {
	const matches = filterCannedByQuery(items, query);
	if (matches.length === 0) return null;

	const vars = defaultCannedVariables(contactName);

	return (
		<ul className="absolute bottom-full start-0 end-0 z-10 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
			{matches.slice(0, 8).map((item) => (
				<li key={item.id}>
					<button
						type="button"
						className={cn(
							"flex w-full flex-col gap-0.5 px-3 py-2 text-start text-sm hover:bg-accent",
						)}
						onClick={() =>
							onSelect(applyCannedVariables(item.body, vars), item)
						}
					>
						<span className="font-mono text-xs text-primary">{item.shortcut}</span>
						<span className="font-medium">{item.title}</span>
						<span className="line-clamp-1 text-xs text-muted-foreground">
							{applyCannedVariables(item.body, vars)}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}
