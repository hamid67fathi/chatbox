import { attachmentUrl, type Message } from "@/lib/api";

export function MessageBody({ msg }: { msg: Message }) {
	const att = msg.attachments?.[0];

	return (
		<>
			{att?.type === "image" && (
				<a
					href={attachmentUrl(att.url)}
					target="_blank"
					rel="noopener noreferrer"
					className="mb-1 block"
				>
					<img
						src={attachmentUrl(att.url)}
						alt={att.name}
						className="max-h-48 max-w-full rounded-md object-contain"
					/>
				</a>
			)}
			{att?.type === "file" && (
				<a
					href={attachmentUrl(att.url)}
					target="_blank"
					rel="noopener noreferrer"
					className="mb-1 flex items-center gap-1 text-sm underline"
				>
					📎 {att.name}
				</a>
			)}
			{msg.body &&
				!(att && msg.body === att.name && msg.type !== "text") && (
					<div className="whitespace-pre-wrap break-words">{msg.body}</div>
				)}
		</>
	);
}
