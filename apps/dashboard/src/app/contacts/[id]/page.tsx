"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { ContactTimelinePanel } from "@/components/ContactTimelinePanel";
import { AppShell } from "@/components/layout/AppShell";
import type { Contact } from "@/lib/api";
import { fetchContact } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function ContactDetail({ workspaceId }: { workspaceId: string }) {
	const params = useParams();
	const contactId = typeof params.id === "string" ? params.id : "";
	const [contact, setContact] = useState<Contact | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!contactId) return;
		setLoading(true);
		void fetchContact(workspaceId, contactId).then((c) => {
			setContact(c);
			setLoading(false);
		});
	}, [workspaceId, contactId]);

	if (loading) {
		return (
			<p className="p-6 text-sm text-muted-foreground">در حال بارگذاری مخاطب…</p>
		);
	}

	if (!contact) {
		return (
			<div className="p-6">
				<p className="text-destructive">مخاطب یافت نشد.</p>
				<Link href="/contacts" className="mt-2 inline-block text-sm text-primary">
					بازگشت به لیست
				</Link>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border px-6 py-2">
				<Link href="/contacts" className="text-sm text-primary hover:underline">
					← مخاطبین
				</Link>
			</div>
			<ContactTimelinePanel workspaceId={workspaceId} contact={contact} />
		</div>
	);
}

export default function ContactDetailPage() {
	return (
		<AuthGuard>
			{({ workspaceId, userEmail, workspaceName }) => (
				<AppShell
					workspaceId={workspaceId}
					userEmail={userEmail}
					workspaceName={workspaceName}
				>
					<ContactDetail workspaceId={workspaceId} />
				</AppShell>
			)}
		</AuthGuard>
	);
}
