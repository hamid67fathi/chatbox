"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceMember } from "@/lib/api";
import {
	fetchWorkspaceMembers,
	inviteWorkspaceMember,
	removeWorkspaceMember,
	updateMemberRole,
} from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	userId: string;
	workspaceRole: string;
}

const ROLES = [
	{ value: "admin", label: "مدیر" },
	{ value: "agent", label: "پشتیبان" },
	{ value: "viewer", label: "مشاهده‌گر" },
];

function roleLabel(role: string) {
	return ROLES.find((r) => r.value === role)?.label ?? role;
}

export function TeamPanel({ workspaceId, userId, workspaceRole }: Props) {
	const canManage = workspaceRole === "owner" || workspaceRole === "admin";
	const [members, setMembers] = useState<WorkspaceMember[]>([]);
	const [email, setEmail] = useState("");
	const [fullName, setFullName] = useState("");
	const [inviteRole, setInviteRole] = useState("agent");
	const [tempPassword, setTempPassword] = useState("");
	const [invitePassword, setInvitePassword] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const reload = useCallback(() => {
		fetchWorkspaceMembers(workspaceId).then(setMembers);
	}, [workspaceId]);

	useEffect(() => {
		reload();
	}, [reload]);

	async function handleInvite(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setSuccess("");
		setTempPassword("");
		const result = await inviteWorkspaceMember(workspaceId, {
			email,
			role: inviteRole,
			full_name: fullName || undefined,
			password: invitePassword || undefined,
		});
		if (!result.ok) {
			setError(result.error ?? "دعوت ناموفق بود.");
			return;
		}
		setEmail("");
		setFullName("");
		setInvitePassword("");
		if (result.temporaryPassword) {
			setTempPassword(result.temporaryPassword);
			setSuccess(
				"عضو اضافه شد. رمز موقت را به کاربر بدهید (ایمیل هنوز فعال نیست):",
			);
		} else {
			setSuccess("عضو به تیم اضافه شد.");
		}
		reload();
	}

	async function changeRole(member: WorkspaceMember, role: string) {
		const ok = await updateMemberRole(workspaceId, member.userId, role);
		if (!ok) setError("تغییر نقش ناموفق بود.");
		else reload();
	}

	async function removeMember(member: WorkspaceMember) {
		if (!confirm(`حذف ${member.email ?? member.userId} از تیم؟`)) return;
		const ok = await removeWorkspaceMember(workspaceId, member.userId);
		if (!ok) setError("حذف ناموفق بود.");
		else reload();
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">تیم</h1>
				<p className="text-sm text-muted-foreground">
					مدیریت اعضا و نقش‌ها (owner/admin/agent/viewer)
				</p>
			</div>
			<div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:flex-row">
				{canManage && (
					<form
						onSubmit={handleInvite}
						className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:max-w-sm"
					>
						<h2 className="text-sm font-semibold">دعوت عضو جدید</h2>
						<label className="flex flex-col gap-1 text-xs font-medium">
							ایمیل
							<Input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								dir="ltr"
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs font-medium">
							نام (اختیاری)
							<Input
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs font-medium">
							نقش
							<select
								value={inviteRole}
								onChange={(e) => setInviteRole(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm"
							>
								{ROLES.map((r) => (
									<option key={r.value} value={r.value}>
										{r.label}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1 text-xs font-medium">
							رمز اولیه (اختیاری — وگرنه خودکار)
							<Input
								type="text"
								value={invitePassword}
								onChange={(e) => setInvitePassword(e.target.value)}
								dir="ltr"
							/>
						</label>
						{error && <p className="text-xs text-destructive">{error}</p>}
						{success && <p className="text-xs text-primary">{success}</p>}
						{tempPassword && (
							<p className="rounded bg-muted p-2 font-mono text-sm" dir="ltr">
								{tempPassword}
							</p>
						)}
						<Button type="submit">دعوت</Button>
					</form>
				)}
				<div className="min-w-0 flex-1">
					<ul className="space-y-2">
						{members.map((m) => (
							<li
								key={m.userId}
								className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
							>
								<div>
									<p className="font-medium">
										{m.fullName || m.email || m.userId.slice(0, 8)}
										{m.userId === userId && (
											<span className="ms-1 text-xs text-muted-foreground">
												(شما)
											</span>
										)}
									</p>
									<p className="text-sm text-muted-foreground" dir="ltr">
										{m.email}
									</p>
								</div>
								<div className="flex items-center gap-2">
									{canManage && m.role !== "owner" ? (
										<select
											value={m.role}
											onChange={(e) => changeRole(m, e.target.value)}
											className="h-8 rounded-md border border-input bg-background px-2 text-xs"
										>
											{ROLES.map((r) => (
												<option key={r.value} value={r.value}>
													{r.label}
												</option>
											))}
										</select>
									) : (
										<span className="text-sm">{roleLabel(m.role)}</span>
									)}
									{canManage && m.role !== "owner" && m.userId !== userId && (
										<Button
											type="button"
											size="sm"
											variant="destructive"
											onClick={() => removeMember(m)}
										>
											حذف
										</Button>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
