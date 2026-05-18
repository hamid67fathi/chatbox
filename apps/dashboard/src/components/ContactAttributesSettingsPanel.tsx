"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createContactAttributeDef,
	deleteContactAttributeDef,
	fetchContactAttributeDefs,
	type ContactAttributeDef,
} from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	canEdit: boolean;
}

export function ContactAttributesSettingsPanel({ workspaceId, canEdit }: Props) {
	const [rows, setRows] = useState<ContactAttributeDef[]>([]);
	const [key, setKey] = useState("");
	const [label, setLabel] = useState("");
	const [msg, setMsg] = useState("");

	const load = useCallback(async () => {
		setRows(await fetchContactAttributeDefs(workspaceId));
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	async function onAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!canEdit || !key.trim() || !label.trim()) return;
		await createContactAttributeDef(workspaceId, {
			key: key.trim(),
			label: label.trim(),
			type: "text",
		});
		setKey("");
		setLabel("");
		setMsg("فیلد اضافه شد.");
		await load();
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				فیلدهای سفارشی مخاطب — قابل set از <code dir="ltr">cbx(&apos;identify&apos;, …)</code>
			</p>
			<ul className="divide-y rounded-md border border-border text-sm">
				{rows.length === 0 && (
					<li className="p-3 text-muted-foreground">هنوز فیلدی تعریف نشده.</li>
				)}
				{rows.map((r) => (
					<li key={r.id} className="flex items-center justify-between gap-2 p-3">
						<span>
							<span className="font-medium">{r.label}</span>
							<code className="ms-2 text-xs text-muted-foreground" dir="ltr">
								{r.key}
							</code>
						</span>
						{canEdit && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={async () => {
									await deleteContactAttributeDef(workspaceId, r.id);
									await load();
								}}
							>
								حذف
							</Button>
						)}
					</li>
				))}
			</ul>
			{canEdit && (
				<form onSubmit={(e) => void onAdd(e)} className="flex flex-wrap gap-2">
					<Input
						placeholder="کلید (plan)"
						value={key}
						onChange={(e) => setKey(e.target.value)}
						dir="ltr"
						className="max-w-[140px]"
					/>
					<Input
						placeholder="برچسب"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className="max-w-[180px]"
					/>
					<Button type="submit" size="sm">
						افزودن
					</Button>
				</form>
			)}
			{msg && <p className="text-xs text-green-600">{msg}</p>}
		</div>
	);
}
