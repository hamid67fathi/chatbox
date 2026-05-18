"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/AppShell";
import { createCompany, fetchCompanies, type CompanyRow } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

function CompaniesContent({
	workspaceId,
	canEdit,
}: {
	workspaceId: string;
	canEdit: boolean;
}) {
	const [rows, setRows] = useState<CompanyRow[]>([]);
	const [name, setName] = useState("");
	const [domain, setDomain] = useState("");

	const load = useCallback(async () => {
		setRows(await fetchCompanies(workspaceId));
	}, [workspaceId]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<div className="flex-1 space-y-4 overflow-y-auto p-6">
			{canEdit && (
				<form
					className="flex flex-wrap gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void createCompany(workspaceId, {
							name,
							domain: domain || undefined,
						}).then(() => {
							setName("");
							setDomain("");
							void load();
						});
					}}
				>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="نام شرکت"
						required
					/>
					<Input
						value={domain}
						onChange={(e) => setDomain(e.target.value)}
						placeholder="domain.com"
						dir="ltr"
					/>
					<Button type="submit" size="sm">
						افزودن
					</Button>
				</form>
			)}
			<ul className="divide-y rounded-md border text-sm">
				{rows.map((c) => (
					<li key={c.id} className="flex justify-between p-3">
						<span className="font-medium">{c.name}</span>
						<span className="text-muted-foreground" dir="ltr">
							{c.domain ?? "—"}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export default function CompaniesPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName, workspaceRole }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="border-b border-border px-6 py-4">
							<h1 className="text-lg font-semibold">شرکت‌ها (B2B)</h1>
						</div>
						<CompaniesContent
							workspaceId={workspaceId}
							canEdit={workspaceRole === "owner" || workspaceRole === "admin"}
						/>
					</div>
				</AppShell>
			)}
		</AuthGuard>
	);
}
