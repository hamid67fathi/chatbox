"use client";

import {
	fetchOnlineVisitors,
	type OnlineVisitorRow,
} from "@/lib/api";
import { countryFlagEmoji } from "@/lib/country-flag";
import { formatDurationSec } from "@/lib/format-duration";
import { getSocket } from "@/lib/socket";
import { Globe, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Props {
	workspaceId: string;
	userId: string;
}

function visitorLabel(row: OnlineVisitorRow): string {
	if (row.full_name?.trim()) return row.full_name.trim();
	if (row.ip) return row.ip;
	return "بازدیدکننده ناشناس";
}

function pageLabel(row: OnlineVisitorRow): string {
	if (row.current_page_title?.trim()) return row.current_page_title.trim();
	if (row.current_page_url) {
		try {
			const u = new URL(row.current_page_url);
			return u.pathname === "/" ? u.hostname : `${u.hostname}${u.pathname}`;
		} catch {
			return row.current_page_url;
		}
	}
	return "—";
}

export function OnlineVisitorsPanel({ workspaceId, userId }: Props) {
	const [rows, setRows] = useState<OnlineVisitorRow[]>([]);
	const [loading, setLoading] = useState(true);

	const reload = useCallback(async () => {
		const data = await fetchOnlineVisitors(workspaceId);
		setRows(data);
		setLoading(false);
	}, [workspaceId]);

	useEffect(() => {
		setLoading(true);
		void reload();
	}, [reload]);

	useEffect(() => {
		const socket = getSocket(workspaceId, userId);
		const onVisitors = (payload: { data?: OnlineVisitorRow[] }) => {
			if (Array.isArray(payload?.data)) {
				setRows(payload.data);
				setLoading(false);
			}
		};
		socket.on("presence:visitors", onVisitors);
		const interval = setInterval(() => void reload(), 15_000);
		return () => {
			socket.off("presence:visitors", onVisitors);
			clearInterval(interval);
		};
	}, [workspaceId, userId, reload]);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="flex items-center gap-2 text-lg font-semibold">
					<Globe className="h-5 w-5 text-primary" />
					بازدیدکنندگان آنلاین
					{!loading && (
						<span className="text-base font-normal text-muted-foreground">
							({rows.length.toLocaleString("fa-IR")})
						</span>
					)}
				</h1>
				<p className="text-sm text-muted-foreground">
					لیست زنده بازدیدکنندگانی که ویجت یا چت را باز دارند
				</p>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-6">
				{loading && rows.length === 0 ? (
					<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin" />
						در حال بارگذاری…
					</div>
				) : (
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full min-w-[900px] text-sm">
							<thead className="bg-muted/50 text-muted-foreground">
								<tr>
									<th className="w-12 px-3 py-2 text-start font-medium">#</th>
									<th className="px-3 py-2 text-start font-medium">
										نام / آی‌پی
									</th>
									<th className="px-3 py-2 text-start font-medium">دستگاه</th>
									<th className="px-3 py-2 text-start font-medium">
										تعداد بازدید
									</th>
									<th className="px-3 py-2 text-start font-medium">مدت حضور</th>
									<th className="px-3 py-2 text-start font-medium">در صفحه</th>
									<th className="px-3 py-2 text-start font-medium">مکالمه</th>
								</tr>
							</thead>
							<tbody>
								{rows.length === 0 ? (
									<tr>
										<td
											colSpan={7}
											className="px-3 py-10 text-center text-muted-foreground"
										>
											در حال حاضر بازدیدکننده آنلاینی نیست.
										</td>
									</tr>
								) : (
									rows.map((row, index) => {
										const flag = countryFlagEmoji(row.country_code);
										return (
											<tr
												key={row.contact_id}
												className="border-t border-border"
											>
												<td className="px-3 py-2 text-muted-foreground">
													{(index + 1).toLocaleString("fa-IR")}
												</td>
												<td className="px-3 py-2">
													<p className="font-medium">{visitorLabel(row)}</p>
													{(row.ip || row.country) && (
														<p
															className="text-xs text-muted-foreground"
															dir="ltr"
														>
															{flag && (
																<span className="me-1" title={row.country ?? ""}>
																	{flag}
																</span>
															)}
															{row.ip ?? ""}
															{row.country && (
																<span className="ms-1 text-foreground/80">
																	{row.country}
																</span>
															)}
														</p>
													)}
												</td>
												<td className="px-3 py-2">
													{row.device ?? "—"}
												</td>
												<td className="px-3 py-2" dir="ltr">
													{row.visit_count.toLocaleString("fa-IR")}
												</td>
												<td className="px-3 py-2">
													{formatDurationSec(row.duration_sec)}
												</td>
												<td className="max-w-[220px] px-3 py-2">
													<p className="truncate" title={row.current_page_url ?? ""}>
														{pageLabel(row)}
													</p>
													{row.current_page_url && (
														<a
															href={row.current_page_url}
															target="_blank"
															rel="noopener noreferrer"
															className="block truncate text-xs text-primary hover:underline"
															dir="ltr"
														>
															{row.current_page_url}
														</a>
													)}
												</td>
												<td className="px-3 py-2">
													{row.conversation_id ? (
														<Link
															href={`/?c=${row.conversation_id}`}
															className="inline-flex items-center gap-1 text-primary hover:underline"
														>
															<MessageCircle className="h-4 w-4" />
															باز کردن
														</Link>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
