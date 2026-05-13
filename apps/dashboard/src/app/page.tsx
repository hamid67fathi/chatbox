import { Inbox } from "@/components/Inbox";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID ?? "";

export default function HomePage() {
	return <Inbox workspaceId={WORKSPACE_ID} />;
}
