"use client";

import { BrandingSettingsPanel } from "@/components/BrandingSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	API_URL,
	connectEmailIntegration,
	connectTelegramBot,
	connectWhatsappIntegration,
	createApiToken,
	disconnectEmailIntegration,
	disconnectTelegramBot,
	disconnectWhatsappIntegration,
	testEmailIntegration,
	fetchApiTokens,
	fetchBannedIps,
	fetchDashboardIpWhitelist,
	fetchRequire2fa,
	fetchIntegrations,
	fetchSlaPolicy,
	fetchAiPersona,
	fetchWidgetConfig,
	previewAiPersona,
	updateAiPersona,
	fetchWorkspaceDetail,
	revokeApiToken,
	updateBannedIps,
	updateDashboardIpWhitelist,
	updateRequire2fa,
	removeUserAvatar,
	updateProfile,
	updateSlaPolicy,
	updateWidgetConfig,
	updateWorkspace,
	uploadUserAvatar,
	publicAssetUrl,
	type ApiTokenRow,
	type EmailIntegrationPublic,
	type TelegramIntegrationPublic,
	type WhatsappIntegrationPublic,
	type WidgetConfigPublic,
} from "@/lib/api";
import { TwoFactorProfileSection } from "@/components/TwoFactorProfileSection";
import { refreshAuthUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/AgentAvatar";
import { NotificationSettings } from "@/components/NotificationSettings";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	workspaceId: string;
	workspaceRole: string;
	userEmail: string;
}

const LOCALES = [
	{ value: "fa-IR", label: "فارسی (ایران)" },
	{ value: "en-US", label: "English (US)" },
];

const TIMEZONES = [
	{ value: "Asia/Tehran", label: "تهران" },
	{ value: "UTC", label: "UTC" },
];

const BH_WEEKDAYS = [
	{ key: "sat", label: "شنبه" },
	{ key: "sun", label: "یکشنبه" },
	{ key: "mon", label: "دوشنبه" },
	{ key: "tue", label: "سه‌شنبه" },
	{ key: "wed", label: "چهارشنبه" },
	{ key: "thu", label: "پنجشنبه" },
	{ key: "fri", label: "جمعه" },
] as const;

type BhDayKey = (typeof BH_WEEKDAYS)[number]["key"];

function defaultBhSchedule(): Record<
	BhDayKey,
	{ enabled: boolean; start: string; end: string }
> {
	return {
		sat: { enabled: true, start: "09:00", end: "18:00" },
		sun: { enabled: true, start: "09:00", end: "18:00" },
		mon: { enabled: true, start: "09:00", end: "18:00" },
		tue: { enabled: true, start: "09:00", end: "18:00" },
		wed: { enabled: true, start: "09:00", end: "18:00" },
		thu: { enabled: true, start: "09:00", end: "18:00" },
		fri: { enabled: false, start: "09:00", end: "18:00" },
	};
}

export function SettingsPanel({ workspaceId, workspaceRole, userEmail }: Props) {
	const [tab, setTab] = useState<
		| "profile"
		| "workspace"
		| "widget"
		| "telegram"
		| "email"
		| "whatsapp"
		| "hours"
		| "sla"
		| "csat"
		| "ai"
		| "api"
		| "security"
		| "notifications"
	>("profile");
	const canEditWorkspace = workspaceRole === "owner" || workspaceRole === "admin";

	const [fullName, setFullName] = useState("");
	const [locale, setLocale] = useState("fa-IR");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [profileMsg, setProfileMsg] = useState("");
	const [profileError, setProfileError] = useState("");
	const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const [wsName, setWsName] = useState("");
	const [wsLocale, setWsLocale] = useState("fa-IR");
	const [wsTimezone, setWsTimezone] = useState("Asia/Tehran");
	const [wsSlug, setWsSlug] = useState("");
	const [wsMsg, setWsMsg] = useState("");
	const [wsError, setWsError] = useState("");

	const [widgetColor, setWidgetColor] = useState("#2563eb");
	const [widgetPosition, setWidgetPosition] = useState<"left" | "right">("right");
	const [widgetTitle, setWidgetTitle] = useState("پشتیبانی");
	const [widgetWelcome, setWidgetWelcome] = useState("");
	const [widgetAvatar, setWidgetAvatar] = useState("");
	const [prechatEnabled, setPrechatEnabled] = useState(false);
	const [prechatName, setPrechatName] = useState(true);
	const [prechatNameRequired, setPrechatNameRequired] = useState(true);
	const [prechatEmail, setPrechatEmail] = useState(true);
	const [prechatEmailRequired, setPrechatEmailRequired] = useState(false);
	const [prechatPhone, setPrechatPhone] = useState(false);
	const [prechatPhoneRequired, setPrechatPhoneRequired] = useState(false);
	const [triggerDelayMs, setTriggerDelayMs] = useState(0);
	const [triggerScrollPct, setTriggerScrollPct] = useState("");
	const [widgetMsg, setWidgetMsg] = useState("");
	const [widgetError, setWidgetError] = useState("");
	const [embedCopied, setEmbedCopied] = useState(false);

	const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
	const [apiTokenName, setApiTokenName] = useState("");
	const [apiTokenExpiryDays, setApiTokenExpiryDays] = useState("");
	const [newTokenRaw, setNewTokenRaw] = useState<string | null>(null);
	const [apiMsg, setApiMsg] = useState("");
	const [apiError, setApiError] = useState("");

	const [bannedIpsText, setBannedIpsText] = useState("");
	const [dashboardIpWhitelistText, setDashboardIpWhitelistText] = useState("");
	const [require2faEnabled, setRequire2faEnabled] = useState(false);
	const [securityMsg, setSecurityMsg] = useState("");
	const [securityError, setSecurityError] = useState("");

	const [telegramBotToken, setTelegramBotToken] = useState("");
	const [telegramIntegration, setTelegramIntegration] =
		useState<TelegramIntegrationPublic | null>(null);
	const [telegramMsg, setTelegramMsg] = useState("");
	const [telegramError, setTelegramError] = useState("");
	const [telegramLoading, setTelegramLoading] = useState(false);

	const [emailIntegration, setEmailIntegration] =
		useState<EmailIntegrationPublic | null>(null);
	const [emailImapHost, setEmailImapHost] = useState("");
	const [emailImapPort, setEmailImapPort] = useState("993");
	const [emailImapSecure, setEmailImapSecure] = useState(true);
	const [emailImapUser, setEmailImapUser] = useState("");
	const [emailImapPassword, setEmailImapPassword] = useState("");
	const [emailSmtpHost, setEmailSmtpHost] = useState("");
	const [emailSmtpPort, setEmailSmtpPort] = useState("587");
	const [emailSmtpSecure, setEmailSmtpSecure] = useState(false);
	const [emailSmtpUser, setEmailSmtpUser] = useState("");
	const [emailSmtpPassword, setEmailSmtpPassword] = useState("");
	const [emailFromAddress, setEmailFromAddress] = useState("");
	const [emailFromName, setEmailFromName] = useState("");
	const [emailMsg, setEmailMsg] = useState("");
	const [emailError, setEmailError] = useState("");
	const [emailLoading, setEmailLoading] = useState(false);

	const [whatsappIntegration, setWhatsappIntegration] =
		useState<WhatsappIntegrationPublic | null>(null);
	const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
	const [waAccessToken, setWaAccessToken] = useState("");
	const [waVerifyToken, setWaVerifyToken] = useState("");
	const [whatsappMsg, setWhatsappMsg] = useState("");
	const [whatsappError, setWhatsappError] = useState("");
	const [whatsappLoading, setWhatsappLoading] = useState(false);

	const [bhEnabled, setBhEnabled] = useState(false);
	const [bhTimezone, setBhTimezone] = useState("Asia/Tehran");
	const [bhAwayMessage, setBhAwayMessage] = useState("");
	const [bhShowStatus, setBhShowStatus] = useState(true);
	const [bhHolidays, setBhHolidays] = useState("");
	const [bhSchedule, setBhSchedule] = useState(defaultBhSchedule);
	const [hoursMsg, setHoursMsg] = useState("");
	const [hoursError, setHoursError] = useState("");

	const [slaEnabled, setSlaEnabled] = useState(true);
	const [slaFirstMin, setSlaFirstMin] = useState(15);
	const [slaResMin, setSlaResMin] = useState(1440);
	const [slaWarnPct, setSlaWarnPct] = useState(80);
	const [slaMsg, setSlaMsg] = useState("");
	const [slaError, setSlaError] = useState("");

	const [csatEnabled, setCsatEnabled] = useState(true);
	const [csatPrompt, setCsatPrompt] = useState(
		"از ۱ تا ۵ چقدر از پشتیبانی راضی بودید؟",
	);
	const [csatAskComment, setCsatAskComment] = useState(true);
	const [csatMsg, setCsatMsg] = useState("");
	const [csatError, setCsatError] = useState("");

	const [autoTagEnabled, setAutoTagEnabled] = useState(true);
	const [autoTagApply, setAutoTagApply] = useState(true);
	const [aiDefaultLang, setAiDefaultLang] = useState<"fa" | "en" | "ar">("fa");
	const [aiTranslateKb, setAiTranslateKb] = useState(false);
	const [personaEnabled, setPersonaEnabled] = useState(true);
	const [personaName, setPersonaName] = useState("");
	const [personaTone, setPersonaTone] = useState<
		"formal" | "friendly" | "technical"
	>("friendly");
	const [personaInstructions, setPersonaInstructions] = useState("");
	const [personaPreview, setPersonaPreview] = useState("");
	const [personaPreviewLoading, setPersonaPreviewLoading] = useState(false);
	const [aiMsg, setAiMsg] = useState("");
	const [aiError, setAiError] = useState("");

	const loadProfile = useCallback(async () => {
		const auth = await refreshAuthUser();
		if (auth?.user) {
			setFullName(auth.user.full_name ?? "");
			setLocale(auth.user.locale ?? "fa-IR");
			setProfileAvatarUrl(auth.user.avatar_url ?? null);
		}
	}, []);

	const loadWorkspace = useCallback(async () => {
		const ws = await fetchWorkspaceDetail(workspaceId);
		if (ws) {
			setWsName(ws.name);
			setWsLocale(ws.locale);
			setWsTimezone(ws.timezone);
			setWsSlug(ws.slug);
		}
	}, [workspaceId]);

	const loadWidget = useCallback(async () => {
		const cfg = await fetchWidgetConfig(workspaceId);
		if (cfg) {
			setWidgetColor(cfg.primary_color);
			setWidgetPosition(cfg.position);
			setWidgetTitle(cfg.title);
			setWidgetWelcome(cfg.welcome_message);
			setWidgetAvatar(cfg.avatar_url ?? "");
			if (cfg.prechat) {
				setPrechatEnabled(cfg.prechat.enabled);
				setPrechatName(cfg.prechat.fields.name.enabled);
				setPrechatNameRequired(cfg.prechat.fields.name.required);
				setPrechatEmail(cfg.prechat.fields.email.enabled);
				setPrechatEmailRequired(cfg.prechat.fields.email.required);
				setPrechatPhone(cfg.prechat.fields.phone.enabled);
				setPrechatPhoneRequired(cfg.prechat.fields.phone.required);
			}
			if (cfg.triggers) {
				setTriggerDelayMs(cfg.triggers.auto_open_delay_ms ?? 0);
				const pct = cfg.triggers.auto_open_on_scroll_percent;
				setTriggerScrollPct(pct != null ? String(pct) : "");
			}
		}
	}, [workspaceId]);

	const loadApiTokens = useCallback(async () => {
		if (!canEditWorkspace) return;
		const rows = await fetchApiTokens(workspaceId);
		setApiTokens(rows);
	}, [workspaceId, canEditWorkspace]);

	const loadSecurity = useCallback(async () => {
		if (!canEditWorkspace) return;
		const [banned, whitelist, require2fa] = await Promise.all([
			fetchBannedIps(workspaceId),
			fetchDashboardIpWhitelist(workspaceId),
			fetchRequire2fa(workspaceId),
		]);
		setBannedIpsText(banned.join("\n"));
		setDashboardIpWhitelistText(whitelist.join("\n"));
		setRequire2faEnabled(require2fa);
	}, [workspaceId, canEditWorkspace]);

	useEffect(() => {
		loadProfile();
		loadWorkspace();
		loadWidget();
	}, [loadProfile, loadWorkspace, loadWidget]);

	useEffect(() => {
		if (tab === "api") void loadApiTokens();
	}, [tab, loadApiTokens]);

	useEffect(() => {
		if (tab === "security") void loadSecurity();
	}, [tab, loadSecurity]);

	const loadTelegram = useCallback(async () => {
		const list = await fetchIntegrations(workspaceId);
		const tg =
			list.find((i): i is TelegramIntegrationPublic => i.type === "telegram") ??
			null;
		setTelegramIntegration(tg);
	}, [workspaceId]);

	const loadEmail = useCallback(async () => {
		const list = await fetchIntegrations(workspaceId);
		const em =
			list.find((i): i is EmailIntegrationPublic => i.type === "email") ?? null;
		setEmailIntegration(em);
	}, [workspaceId]);

	useEffect(() => {
		if (tab === "telegram") void loadTelegram();
	}, [tab, loadTelegram]);

	useEffect(() => {
		if (tab === "email") void loadEmail();
	}, [tab, loadEmail]);

	const loadWhatsapp = useCallback(async () => {
		const list = await fetchIntegrations(workspaceId);
		const wa =
			list.find((i): i is WhatsappIntegrationPublic => i.type === "whatsapp") ??
			null;
		setWhatsappIntegration(wa);
		if (wa?.verify_token) setWaVerifyToken(wa.verify_token);
	}, [workspaceId]);

	useEffect(() => {
		if (tab === "whatsapp") void loadWhatsapp();
	}, [tab, loadWhatsapp]);

	const loadSla = useCallback(async () => {
		const policy = await fetchSlaPolicy(workspaceId);
		if (policy) {
			setSlaEnabled(policy.enabled);
			setSlaFirstMin(policy.first_response_minutes);
			setSlaResMin(policy.resolution_minutes);
			setSlaWarnPct(policy.warn_at_percent);
		}
	}, [workspaceId]);

	useEffect(() => {
		if (tab === "sla") void loadSla();
	}, [tab, loadSla]);

	const loadCsat = useCallback(async () => {
		const cfg = await fetchWidgetConfig(workspaceId);
		if (cfg?.csat) {
			setCsatEnabled(cfg.csat.enabled);
			setCsatPrompt(cfg.csat.prompt_message);
			setCsatAskComment(cfg.csat.ask_comment);
		}
	}, [workspaceId]);

	useEffect(() => {
		if (tab === "csat") void loadCsat();
	}, [tab, loadCsat]);

	const loadAi = useCallback(async () => {
		const [cfg, persona] = await Promise.all([
			fetchWidgetConfig(workspaceId),
			fetchAiPersona(workspaceId),
		]);
		if (cfg?.auto_tagging) {
			setAutoTagEnabled(cfg.auto_tagging.enabled);
			setAutoTagApply(cfg.auto_tagging.auto_apply);
		}
		if (cfg?.ai_languages) {
			setAiDefaultLang(cfg.ai_languages.default_language);
			setAiTranslateKb(cfg.ai_languages.translate_kb);
		}
		if (persona) {
			setPersonaEnabled(persona.enabled);
			setPersonaName(persona.name ?? "");
			setPersonaTone(persona.tone);
			setPersonaInstructions(persona.custom_instructions ?? "");
		}
	}, [workspaceId]);

	useEffect(() => {
		if (tab === "ai") void loadAi();
	}, [tab, loadAi]);

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		setProfileMsg("");
		setProfileError("");
		const result = await updateProfile({
			full_name: fullName,
			locale,
			...(newPassword
				? { current_password: currentPassword, new_password: newPassword }
				: {}),
		});
		if (!result.ok) {
			setProfileError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setProfileMsg("پروفایل ذخیره شد.");
		setCurrentPassword("");
		setNewPassword("");
		await loadProfile();
	}

	async function saveWorkspace(e: React.FormEvent) {
		e.preventDefault();
		setWsMsg("");
		setWsError("");
		const ok = await updateWorkspace(workspaceId, {
			name: wsName,
			locale: wsLocale,
			timezone: wsTimezone,
		});
		if (!ok) {
			setWsError("ذخیره ورک‌اسپیس ناموفق بود.");
			return;
		}
		setWsMsg("تنظیمات ورک‌اسپیس ذخیره شد.");
	}

	async function handleCreateApiToken(e: React.FormEvent) {
		e.preventDefault();
		setApiMsg("");
		setApiError("");
		setNewTokenRaw(null);
		const label = apiTokenName.trim();
		if (!label) {
			setApiError("نام توکن الزامی است.");
			return;
		}
		const days = apiTokenExpiryDays.trim();
		const result = await createApiToken(workspaceId, {
			name: label,
			...(days ? { expires_in_days: Math.max(1, Number(days) || 0) } : {}),
		});
		if (!result.ok || !result.token) {
			setApiError(result.error ?? "ساخت توکن ناموفق بود.");
			return;
		}
		setNewTokenRaw(result.token);
		setApiTokenName("");
		setApiTokenExpiryDays("");
		setApiMsg("توکن ساخته شد. فقط یک‌بار نمایش داده می‌شود — آن را کپی کنید.");
		await loadApiTokens();
	}

	async function handleRevokeApiToken(tokenId: string) {
		setApiMsg("");
		setApiError("");
		const ok = await revokeApiToken(workspaceId, tokenId);
		if (!ok) {
			setApiError("لغو توکن ناموفق بود.");
			return;
		}
		setApiMsg("توکن لغو شد.");
		await loadApiTokens();
	}

	async function saveSecurity(e: React.FormEvent) {
		e.preventDefault();
		setSecurityMsg("");
		setSecurityError("");
		const ips = bannedIpsText
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		const ok = await updateBannedIps(workspaceId, ips);
		if (!ok) {
			setSecurityError("ذخیره لیست IP ناموفق بود. فرمت را بررسی کنید.");
			return;
		}
		setSecurityMsg("لیست IPهای مسدود ذخیره شد.");
		await loadSecurity();
	}

	async function saveDashboardIpWhitelist(e: React.FormEvent) {
		e.preventDefault();
		setSecurityMsg("");
		setSecurityError("");
		const ips = dashboardIpWhitelistText
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		const ok = await updateDashboardIpWhitelist(workspaceId, ips);
		if (!ok) {
			setSecurityError(
				"ذخیره لیست مجاز داشبورد ناموفق بود. فرمت را بررسی کنید.",
			);
			return;
		}
		setSecurityMsg(
			ips.length > 0
				? "محدودیت IP داشبورد فعال شد."
				: "محدودیت IP داشبورد غیرفعال شد (لیست خالی).",
		);
		await loadSecurity();
	}

	async function saveWidget(e: React.FormEvent) {
		e.preventDefault();
		setWidgetMsg("");
		setWidgetError("");
		const patch: Partial<WidgetConfigPublic> = {
			primary_color: widgetColor,
			position: widgetPosition,
			title: widgetTitle,
			welcome_message: widgetWelcome,
			avatar_url: widgetAvatar.trim() || null,
			prechat: {
				enabled: prechatEnabled,
				fields: {
					name: { enabled: prechatName, required: prechatNameRequired },
					email: { enabled: prechatEmail, required: prechatEmailRequired },
					phone: { enabled: prechatPhone, required: prechatPhoneRequired },
				},
			},
			triggers: {
				auto_open_delay_ms: Math.max(0, triggerDelayMs),
				auto_open_on_scroll_percent:
					triggerScrollPct.trim() === ""
						? null
						: Math.min(100, Math.max(0, Number(triggerScrollPct) || 0)),
			},
		};
		const result = await updateWidgetConfig(workspaceId, patch);
		if (!result.ok) {
			setWidgetError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setWidgetMsg("تنظیمات ابزارک ذخیره شد.");
		await loadWidget();
	}

	async function saveBusinessHours(e: React.FormEvent) {
		e.preventDefault();
		setHoursMsg("");
		setHoursError("");
		const holidays = bhHolidays
			.split(/[\n,]+/)
			.map((h) => h.trim())
			.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
		const result = await updateWidgetConfig(workspaceId, {
			business_hours: {
				enabled: bhEnabled,
				timezone: bhTimezone,
				away_message: bhAwayMessage,
				show_status: bhShowStatus,
				holidays,
				schedule: bhSchedule,
			},
		});
		if (!result.ok) {
			setHoursError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setHoursMsg("ساعات کاری ذخیره شد.");
		await loadWidget();
	}

	async function saveSla(e: React.FormEvent) {
		e.preventDefault();
		setSlaMsg("");
		setSlaError("");
		const result = await updateSlaPolicy(workspaceId, {
			enabled: slaEnabled,
			first_response_minutes: slaFirstMin,
			resolution_minutes: slaResMin,
			warn_at_percent: slaWarnPct,
		});
		if (!result.ok) {
			setSlaError(result.error ?? "خطا");
			return;
		}
		setSlaMsg("تنظیمات SLA ذخیره شد.");
	}

	async function saveAi(e: React.FormEvent) {
		e.preventDefault();
		setAiMsg("");
		setAiError("");
		const [cfgResult, personaResult] = await Promise.all([
			updateWidgetConfig(workspaceId, {
				auto_tagging: {
					enabled: autoTagEnabled,
					auto_apply: autoTagApply,
				},
				ai_languages: {
					default_language: aiDefaultLang,
					translate_kb: aiTranslateKb,
				},
			}),
			updateAiPersona(workspaceId, {
				enabled: personaEnabled,
				name: personaName.trim() || null,
				tone: personaTone,
				custom_instructions: personaInstructions.trim(),
			}),
		]);
		if (!cfgResult.ok || !personaResult.ok) {
			setAiError(
				cfgResult.error ?? personaResult.error ?? "ذخیره ناموفق بود.",
			);
			return;
		}
		setAiMsg("تنظیمات AI ذخیره شد.");
		await loadAi();
	}

	async function saveCsat(e: React.FormEvent) {
		e.preventDefault();
		setCsatMsg("");
		setCsatError("");
		const result = await updateWidgetConfig(workspaceId, {
			csat: {
				enabled: csatEnabled,
				prompt_message: csatPrompt.trim(),
				ask_comment: csatAskComment,
			},
		});
		if (!result.ok) {
			setCsatError(result.error ?? "ذخیره ناموفق بود.");
			return;
		}
		setCsatMsg("تنظیمات CSAT ذخیره شد.");
		await loadCsat();
	}

	const embedSnippet = wsSlug
		? `<script src="${API_URL}/widget-demo/dist/index.global.js"\n  data-api-url="${API_URL}"\n  data-workspace-slug="${wsSlug}"></script>`
		: "";

	async function copyEmbedSnippet() {
		if (!embedSnippet) return;
		try {
			await navigator.clipboard.writeText(embedSnippet);
			setEmbedCopied(true);
			window.setTimeout(() => setEmbedCopied(false), 2000);
		} catch {
			setWidgetError("کپی در مرورگر ممکن نشد — متن را دستی انتخاب کنید.");
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-6 py-4">
				<h1 className="text-lg font-semibold">تنظیمات</h1>
			</div>
			<div className="flex gap-2 border-b border-border px-6 pt-3">
				{(
					[
						"profile",
						"workspace",
						"widget",
						"telegram",
						"email",
						"whatsapp",
						"hours",
						"sla",
						"csat",
						"ai",
						"api",
						"security",
						"branding",
						"notifications",
					] as const
				).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={cn(
							"rounded-t-md px-4 py-2 text-sm font-medium",
							tab === t
								? "border border-b-0 border-border bg-card"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{t === "profile"
							? "پروفایل"
							: t === "workspace"
								? "ورک‌اسپیس"
								: t === "widget"
									? "ابزارک"
									: t === "telegram"
										? "تلگرام"
										: t === "email"
											? "ایمیل"
											: t === "whatsapp"
												? "واتساپ"
												: t === "hours"
													? "ساعات کاری"
													: t === "sla"
														? "SLA"
														: t === "csat"
															? "CSAT"
															: t === "ai"
																? "هوش مصنوعی"
																: t === "api"
																	? "API"
																	: t === "branding"
																		? "برند"
																		: t === "notifications"
																			? "اعلان‌ها"
																			: "امنیت"}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto p-6">
				{tab === "profile" && (
					<form
						onSubmit={saveProfile}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						<div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
							<AgentAvatar
								avatarUrl={profileAvatarUrl}
								fullName={fullName}
								email={userEmail}
								size="md"
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<p className="text-sm font-medium">آواتار اپراتور</p>
								<p className="text-xs text-muted-foreground">
									در چت و لیست تیم نمایش داده می‌شود. JPEG، PNG، GIF یا WebP
									(حداکثر ۲ مگابایت).
								</p>
								<div className="flex flex-wrap gap-2">
									<input
										ref={avatarInputRef}
										type="file"
										accept="image/jpeg,image/png,image/gif,image/webp"
										className="hidden"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (!file) return;
											setProfileError("");
											setAvatarUploading(true);
											void uploadUserAvatar(file).then(async (result) => {
												setAvatarUploading(false);
												e.target.value = "";
												if (!result.ok) {
													setProfileError(
														result.error ?? "آپلود آواتار ناموفق بود.",
													);
													return;
												}
												setProfileAvatarUrl(result.avatar_url ?? null);
												await refreshAuthUser();
												setProfileMsg("آواتار به‌روز شد.");
											});
										}}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={avatarUploading}
										onClick={() => avatarInputRef.current?.click()}
									>
										{avatarUploading ? "در حال آپلود…" : "انتخاب تصویر"}
									</Button>
									{profileAvatarUrl && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={avatarUploading}
											onClick={() => {
												setProfileError("");
												setAvatarUploading(true);
												void removeUserAvatar().then(async (result) => {
													setAvatarUploading(false);
													if (!result.ok) {
														setProfileError(
															result.error ?? "حذف آواتار ناموفق بود.",
														);
														return;
													}
													setProfileAvatarUrl(null);
													await refreshAuthUser();
													setProfileMsg("آواتار حذف شد.");
												});
											}}
										>
											حذف آواتار
										</Button>
									)}
								</div>
								{profileAvatarUrl && (
									<p className="truncate text-xs text-muted-foreground" dir="ltr">
										{publicAssetUrl(profileAvatarUrl)}
									</p>
								)}
							</div>
						</div>
						<label className="flex flex-col gap-1 text-sm font-medium">
							ایمیل
							<Input value={userEmail} disabled dir="ltr" />
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							نام کامل
							<Input
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							زبان رابط
							<select
								value={locale}
								onChange={(e) => setLocale(e.target.value)}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm"
							>
								{LOCALES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<hr className="border-border" />
						<p className="text-sm font-medium">تغییر رمز عبور</p>
						<label className="flex flex-col gap-1 text-sm">
							رمز فعلی
							<Input
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								dir="ltr"
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm">
							رمز جدید
							<Input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								minLength={8}
								dir="ltr"
							/>
						</label>
						{profileError && (
							<p className="text-sm text-destructive">{profileError}</p>
						)}
						{profileMsg && (
							<p className="text-sm text-primary">{profileMsg}</p>
						)}
						<Button type="submit">ذخیره پروفایل</Button>
					</form>
				)}
				{tab === "profile" && <TwoFactorProfileSection />}
				{tab === "notifications" && (
					<NotificationSettings workspaceId={workspaceId} />
				)}
				{tab === "widget" && (
					<form
						onSubmit={saveWidget}
						className="mx-auto flex max-w-lg flex-col gap-4"
					>
						<p className="text-sm text-muted-foreground">
							<strong className="text-foreground">ابزارک ChatBox</strong> — ویجت چت
							روی سایت شما (اسکریپت embed یا پلاگین وردپرس).
						</p>
						{!canEditWorkspace && (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند ظاهر ابزارک را ویرایش کند.
							</p>
						)}
						<label className="flex flex-col gap-1 text-sm font-medium">
							رنگ اصلی
							<div className="flex items-center gap-3">
								<input
									type="color"
									value={widgetColor}
									onChange={(e) => setWidgetColor(e.target.value)}
									disabled={!canEditWorkspace}
									className="h-10 w-14 cursor-pointer rounded border border-input disabled:opacity-50"
								/>
								<Input
									value={widgetColor}
									onChange={(e) => setWidgetColor(e.target.value)}
									disabled={!canEditWorkspace}
									dir="ltr"
									className="max-w-[8rem] font-mono text-sm"
								/>
							</div>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							موقعیت دکمه
							<select
								value={widgetPosition}
								onChange={(e) =>
									setWidgetPosition(e.target.value as "left" | "right")
								}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								<option value="right">پایین راست</option>
								<option value="left">پایین چپ</option>
							</select>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							عنوان هدر
							<Input
								value={widgetTitle}
								onChange={(e) => setWidgetTitle(e.target.value)}
								disabled={!canEditWorkspace}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							پیام خوش‌آمد
							<textarea
								value={widgetWelcome}
								onChange={(e) => setWidgetWelcome(e.target.value)}
								disabled={!canEditWorkspace}
								rows={3}
								className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
							/>
						</label>
						<hr className="border-border" />
						<p className="text-sm font-medium">باز شدن خودکار ویجت</p>
						<label className="flex flex-col gap-1 text-sm font-medium">
							تأخیر باز شدن (میلی‌ثانیه، ۰ = غیرفعال)
							<Input
								type="number"
								min={0}
								max={120000}
								value={triggerDelayMs}
								onChange={(e) =>
									setTriggerDelayMs(Math.max(0, Number(e.target.value) || 0))
								}
								disabled={!canEditWorkspace}
								dir="ltr"
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							باز شدن پس از اسکرول (درصد صفحه، خالی = غیرفعال)
							<Input
								type="number"
								min={0}
								max={100}
								value={triggerScrollPct}
								onChange={(e) => setTriggerScrollPct(e.target.value)}
								disabled={!canEditWorkspace}
								dir="ltr"
								placeholder="مثلاً 50"
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							آدرس آواتار (URL)
							<Input
								value={widgetAvatar}
								onChange={(e) => setWidgetAvatar(e.target.value)}
								disabled={!canEditWorkspace}
								dir="ltr"
								placeholder="https://..."
							/>
						</label>
						<hr className="border-border" />
						<p className="text-sm font-medium">فرم قبل از چت (Pre-chat)</p>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={prechatEnabled}
								onChange={(e) => setPrechatEnabled(e.target.checked)}
								disabled={!canEditWorkspace}
							/>
							فعال‌سازی فرم قبل از شروع گفتگو
						</label>
						{prechatEnabled && (
							<div className="space-y-2 rounded-md border border-border p-3 text-sm">
								{(
									[
										{
											label: "نام",
											enabled: prechatName,
											setEnabled: setPrechatName,
											required: prechatNameRequired,
											setRequired: setPrechatNameRequired,
										},
										{
											label: "ایمیل",
											enabled: prechatEmail,
											setEnabled: setPrechatEmail,
											required: prechatEmailRequired,
											setRequired: setPrechatEmailRequired,
										},
										{
											label: "تلفن",
											enabled: prechatPhone,
											setEnabled: setPrechatPhone,
											required: prechatPhoneRequired,
											setRequired: setPrechatPhoneRequired,
										},
									] as const
								).map((f) => (
									<div
										key={f.label}
										className="flex flex-wrap items-center gap-4"
									>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={f.enabled}
												onChange={(e) => f.setEnabled(e.target.checked)}
												disabled={!canEditWorkspace}
											/>
											{f.label}
										</label>
										{f.enabled && (
											<label className="flex items-center gap-2 text-muted-foreground">
												<input
													type="checkbox"
													checked={f.required}
													onChange={(e) => f.setRequired(e.target.checked)}
													disabled={!canEditWorkspace}
												/>
												الزامی
											</label>
										)}
									</div>
								))}
							</div>
						)}
						{widgetError && (
							<p className="text-sm text-destructive">{widgetError}</p>
						)}
						{widgetMsg && <p className="text-sm text-primary">{widgetMsg}</p>}
						<Button type="submit" disabled={!canEditWorkspace}>
							ذخیره ابزارک
						</Button>
						{wsSlug && (
							<div className="mt-4 space-y-4">
								<div className="rounded-lg border border-border bg-muted/50 p-4">
									<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-medium">نصب دستی (HTML)</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void copyEmbedSnippet()}
										>
											{embedCopied ? "کپی شد" : "کپی کد"}
										</Button>
									</div>
									<pre
										className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground"
										dir="ltr"
									>
										{embedSnippet}
									</pre>
									<p className="mt-2 text-xs text-muted-foreground">
										اسکریپت را قبل از{" "}
										<code className="rounded bg-muted px-1" dir="ltr">
											&lt;/body&gt;
										</code>{" "}
										قرار دهید.
									</p>
								</div>
								<div className="rounded-lg border border-border bg-muted/50 p-4">
									<p className="mb-2 text-sm font-medium">وردپرس (پلاگین ابزارک)</p>
									<ol className="list-decimal space-y-1 pr-4 text-xs text-muted-foreground">
										<li>
											پوشه{" "}
											<code className="rounded bg-muted px-1" dir="ltr">
												integrations/wordpress/chatbox-abzar
											</code>{" "}
											را در{" "}
											<code className="rounded bg-muted px-1" dir="ltr">
												wp-content/plugins/
											</code>{" "}
											کپی کنید، یا از ریشه مخزن:{" "}
											<code className="rounded bg-muted px-1" dir="ltr">
												pnpm zip:wordpress
											</code>
										</li>
										<li>افزونه «ابزارک ChatBox» را فعال کنید.</li>
										<li>
											تنظیمات → ابزارک ChatBox — API:{" "}
											<code className="rounded bg-muted px-1" dir="ltr">
												{API_URL}
											</code>
											، Slug:{" "}
											<code className="rounded bg-muted px-1" dir="ltr">
												{wsSlug}
											</code>
										</li>
									</ol>
								</div>
								<p className="text-xs text-muted-foreground">
									دمو:{" "}
									<code className="rounded bg-muted px-1" dir="ltr">
										/widget-demo/demo.html
									</code>
								</p>
							</div>
						)}
					</form>
				)}
				{tab === "api" && (
					<div className="mx-auto flex max-w-lg flex-col gap-6">
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند توکن API بسازد یا لغو کند.
							</p>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									توکن‌ها برای فراخوانی REST API از سرور یا webhook استفاده می‌شوند.
									در هدر درخواست:{" "}
									<code className="rounded bg-muted px-1 text-xs" dir="ltr">
										Authorization: Bearer cbx_…
									</code>{" "}
									و{" "}
									<code className="rounded bg-muted px-1 text-xs" dir="ltr">
										X-Workspace-Id
									</code>
								</p>
								<form
									onSubmit={handleCreateApiToken}
									className="flex flex-col gap-3 rounded-lg border border-border p-4"
								>
									<p className="text-sm font-medium">توکن جدید</p>
									<label className="flex flex-col gap-1 text-sm font-medium">
										نام (برای شناسایی)
										<Input
											value={apiTokenName}
											onChange={(e) => setApiTokenName(e.target.value)}
											placeholder="مثلاً production-webhook"
											dir="ltr"
										/>
									</label>
									<label className="flex flex-col gap-1 text-sm font-medium">
										انقضا (روز، اختیاری)
										<Input
											type="number"
											min={1}
											value={apiTokenExpiryDays}
											onChange={(e) => setApiTokenExpiryDays(e.target.value)}
											placeholder="خالی = بدون انقضا"
											dir="ltr"
										/>
									</label>
									<Button type="submit">ساخت توکن</Button>
								</form>
								{newTokenRaw && (
									<div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
										<p className="mb-2 text-sm font-medium text-primary">
											توکن جدید (فقط یک‌بار)
										</p>
										<pre
											className="overflow-x-auto break-all rounded bg-muted p-2 text-xs"
											dir="ltr"
										>
											{newTokenRaw}
										</pre>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="mt-2"
											onClick={() => {
												void navigator.clipboard.writeText(newTokenRaw);
												setApiMsg("در کلیپ‌بورد کپی شد.");
											}}
										>
											کپی
										</Button>
									</div>
								)}
								{apiError && (
									<p className="text-sm text-destructive">{apiError}</p>
								)}
								{apiMsg && <p className="text-sm text-primary">{apiMsg}</p>}
								<div>
									<p className="mb-2 text-sm font-medium">توکن‌های فعال</p>
									{apiTokens.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											توکن فعالی وجود ندارد.
										</p>
									) : (
										<ul className="divide-y divide-border rounded-lg border border-border">
											{apiTokens.map((t) => (
												<li
													key={t.id}
													className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
												>
													<div>
														<p className="font-medium">{t.name}</p>
														<p
															className="font-mono text-xs text-muted-foreground"
															dir="ltr"
														>
															{t.token_prefix}…
														</p>
														<p className="text-xs text-muted-foreground">
															{t.creator_email ?? "—"} ·{" "}
															{new Date(t.created_at).toLocaleDateString("fa-IR")}
															{t.last_used_at &&
																` · آخرین استفاده ${new Date(t.last_used_at).toLocaleDateString("fa-IR")}`}
															{t.expires_at &&
																` · انقضا ${new Date(t.expires_at).toLocaleDateString("fa-IR")}`}
														</p>
													</div>
													<Button
														type="button"
														variant="destructive"
														size="sm"
														onClick={() => void handleRevokeApiToken(t.id)}
													>
														لغو
													</Button>
												</li>
											))}
										</ul>
									)}
								</div>
							</>
						)}
					</div>
				)}
				{tab === "workspace" && (
					<form
						onSubmit={saveWorkspace}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						{!canEditWorkspace && (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند تنظیمات ورک‌اسپیس را ویرایش کند.
							</p>
						)}
						<label className="flex flex-col gap-1 text-sm font-medium">
							نام ورک‌اسپیس
							<Input
								value={wsName}
								onChange={(e) => setWsName(e.target.value)}
								disabled={!canEditWorkspace}
							/>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							Slug (فقط خواندنی)
							<Input value={wsSlug} disabled dir="ltr" />
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							زبان پیش‌فرض
							<select
								value={wsLocale}
								onChange={(e) => setWsLocale(e.target.value)}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								{LOCALES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label className="flex flex-col gap-1 text-sm font-medium">
							منطقه زمانی
							<select
								value={wsTimezone}
								onChange={(e) => setWsTimezone(e.target.value)}
								disabled={!canEditWorkspace}
								className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
							>
								{TIMEZONES.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						{wsError && <p className="text-sm text-destructive">{wsError}</p>}
						{wsMsg && <p className="text-sm text-primary">{wsMsg}</p>}
						<Button type="submit" disabled={!canEditWorkspace}>
							ذخیره ورک‌اسپیس
						</Button>
					</form>
				)}
				{tab === "telegram" && (
					<div className="mx-auto flex max-w-lg flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							ربات تلگرام را به ورک‌اسپیس وصل کنید. پیام‌های کاربران در صندوق ورودی
							نمایش داده می‌شود و پاسخ اپراتور به تلگرام ارسال می‌شود.
						</p>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند ربات تلگرام را متصل کند.
							</p>
						) : telegramIntegration ? (
							<div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
								<p className="text-sm font-medium">
									متصل: @{telegramIntegration.bot_username}
								</p>
								<p className="text-xs text-muted-foreground" dir="ltr">
									توکن: {telegramIntegration.token_masked}
								</p>
								<p className="break-all text-xs text-muted-foreground" dir="ltr">
									Webhook: {telegramIntegration.webhook_url}
								</p>
								<Button
									type="button"
									variant="destructive"
									disabled={telegramLoading}
									onClick={async () => {
										setTelegramLoading(true);
										setTelegramMsg("");
										setTelegramError("");
										const ok = await disconnectTelegramBot(workspaceId);
										setTelegramLoading(false);
										if (!ok) {
											setTelegramError("قطع اتصال ناموفق بود.");
											return;
										}
										setTelegramIntegration(null);
										setTelegramBotToken("");
										setTelegramMsg("اتصال تلگرام قطع شد.");
									}}
								>
									قطع اتصال
								</Button>
							</div>
						) : (
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									setTelegramMsg("");
									setTelegramError("");
									if (!telegramBotToken.trim()) {
										setTelegramError("Bot Token را وارد کنید.");
										return;
									}
									setTelegramLoading(true);
									const result = await connectTelegramBot(
										workspaceId,
										telegramBotToken.trim(),
									);
									setTelegramLoading(false);
									if (!result.ok) {
										setTelegramError(result.error ?? "اتصال ناموفق بود.");
										return;
									}
									setTelegramBotToken("");
									if (result.data) setTelegramIntegration(result.data);
									setTelegramMsg("ربات تلگرام با موفقیت متصل شد.");
									void loadTelegram();
								}}
								className="flex flex-col gap-3"
							>
								<label className="flex flex-col gap-1 text-sm font-medium">
									Bot Token
									<Input
										value={telegramBotToken}
										onChange={(e) => setTelegramBotToken(e.target.value)}
										placeholder="123456789:ABCdefGHI..."
										dir="ltr"
										autoComplete="off"
									/>
								</label>
								<p className="text-xs text-muted-foreground">
									از @BotFather در تلگرام توکن بگیرید. آدرس webhook به‌صورت خودکار
									روی API ثبت می‌شود (نیاز به URL عمومی با{" "}
									<code className="text-xs">API_PUBLIC_URL</code>).
								</p>
								<Button type="submit" disabled={telegramLoading}>
									{telegramLoading ? "در حال اتصال…" : "اتصال ربات"}
								</Button>
							</form>
						)}
						{telegramError && (
							<p className="text-sm text-destructive">{telegramError}</p>
						)}
						{telegramMsg && <p className="text-sm text-primary">{telegramMsg}</p>}
					</div>
				)}
				{tab === "email" && (
					<div className="mx-auto flex max-w-2xl flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							ایمیل ورودی (IMAP) و خروجی (SMTP) را وصل کنید. سرویس{" "}
							<code className="text-xs">email-worker</code> باید روی سرور در حال
							اجرا باشد.
						</p>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند کانال ایمیل را متصل کند.
							</p>
						) : emailIntegration ? (
							<div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
								<p className="text-sm font-medium">
									متصل: {emailIntegration.from_address}
								</p>
								<p className="text-xs text-muted-foreground" dir="ltr">
									IMAP {emailIntegration.imap_host} · SMTP{" "}
									{emailIntegration.smtp_host}
								</p>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										disabled={emailLoading}
										onClick={async () => {
											setEmailLoading(true);
											setEmailError("");
											const ok = await testEmailIntegration(workspaceId);
											setEmailLoading(false);
											setEmailMsg(
												ok ? "اتصال IMAP/SMTP سالم است." : "تست اتصال ناموفق بود.",
											);
										}}
									>
										تست اتصال
									</Button>
									<Button
										type="button"
										variant="destructive"
										disabled={emailLoading}
										onClick={async () => {
											setEmailLoading(true);
											const ok = await disconnectEmailIntegration(workspaceId);
											setEmailLoading(false);
											if (!ok) {
												setEmailError("قطع اتصال ناموفق بود.");
												return;
											}
											setEmailIntegration(null);
											setEmailMsg("کانال ایمیل قطع شد.");
										}}
									>
										قطع اتصال
									</Button>
								</div>
							</div>
						) : (
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									setEmailMsg("");
									setEmailError("");
									setEmailLoading(true);
									const result = await connectEmailIntegration(workspaceId, {
										imap_host: emailImapHost,
										imap_port: Number(emailImapPort) || 993,
										imap_secure: emailImapSecure,
										imap_user: emailImapUser,
										imap_password: emailImapPassword,
										smtp_host: emailSmtpHost,
										smtp_port: Number(emailSmtpPort) || 587,
										smtp_secure: emailSmtpSecure,
										smtp_user: emailSmtpUser,
										smtp_password: emailSmtpPassword,
										from_address: emailFromAddress,
										from_name: emailFromName || null,
									});
									setEmailLoading(false);
									if (!result.ok) {
										setEmailError(result.error ?? "اتصال ناموفق بود.");
										return;
									}
									if (result.data) setEmailIntegration(result.data);
									setEmailImapPassword("");
									setEmailSmtpPassword("");
									setEmailMsg("کانال ایمیل متصل شد.");
									void loadEmail();
								}}
								className="grid gap-3 sm:grid-cols-2"
							>
								<p className="sm:col-span-2 text-sm font-medium">IMAP (دریافت)</p>
								<label className="flex flex-col gap-1 text-sm">
									Host
									<Input
										value={emailImapHost}
										onChange={(e) => setEmailImapHost(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm">
									Port
									<Input
										value={emailImapPort}
										onChange={(e) => setEmailImapPort(e.target.value)}
										dir="ltr"
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									User
									<Input
										value={emailImapUser}
										onChange={(e) => setEmailImapUser(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									Password
									<Input
										type="password"
										value={emailImapPassword}
										onChange={(e) => setEmailImapPassword(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex items-center gap-2 text-sm sm:col-span-2">
									<input
										type="checkbox"
										checked={emailImapSecure}
										onChange={(e) => setEmailImapSecure(e.target.checked)}
									/>
									IMAP SSL/TLS
								</label>
								<p className="sm:col-span-2 text-sm font-medium">SMTP (ارسال)</p>
								<label className="flex flex-col gap-1 text-sm">
									Host
									<Input
										value={emailSmtpHost}
										onChange={(e) => setEmailSmtpHost(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm">
									Port
									<Input
										value={emailSmtpPort}
										onChange={(e) => setEmailSmtpPort(e.target.value)}
										dir="ltr"
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									User
									<Input
										value={emailSmtpUser}
										onChange={(e) => setEmailSmtpUser(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									Password
									<Input
										type="password"
										value={emailSmtpPassword}
										onChange={(e) => setEmailSmtpPassword(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex items-center gap-2 text-sm sm:col-span-2">
									<input
										type="checkbox"
										checked={emailSmtpSecure}
										onChange={(e) => setEmailSmtpSecure(e.target.checked)}
									/>
									SMTP SSL/TLS
								</label>
								<p className="sm:col-span-2 text-sm font-medium">فرستنده</p>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									From address
									<Input
										value={emailFromAddress}
										onChange={(e) => setEmailFromAddress(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm sm:col-span-2">
									From name (اختیاری)
									<Input
										value={emailFromName}
										onChange={(e) => setEmailFromName(e.target.value)}
									/>
								</label>
								<div className="sm:col-span-2">
									<Button type="submit" disabled={emailLoading}>
										{emailLoading ? "در حال اتصال…" : "اتصال ایمیل"}
									</Button>
								</div>
							</form>
						)}
						{emailError && (
							<p className="text-sm text-destructive">{emailError}</p>
						)}
						{emailMsg && <p className="text-sm text-primary">{emailMsg}</p>}
					</div>
				)}
				{tab === "whatsapp" && (
					<div className="mx-auto flex max-w-lg flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							اتصال به WhatsApp Cloud API (Meta). پس از اتصال، Webhook URL و
							Verify Token را در Meta Developer Console ثبت کنید.
						</p>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند واتساپ را متصل کند.
							</p>
						) : whatsappIntegration ? (
							<div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
								<p className="text-sm font-medium">
									متصل:{" "}
									{whatsappIntegration.display_phone_number ??
										whatsappIntegration.phone_number_id}
								</p>
								<p className="text-xs text-muted-foreground" dir="ltr">
									Phone number ID: {whatsappIntegration.phone_number_id}
								</p>
								<p className="break-all text-xs text-muted-foreground" dir="ltr">
									Webhook: {whatsappIntegration.webhook_url}
								</p>
								<p className="text-xs text-muted-foreground" dir="ltr">
									Verify token: {whatsappIntegration.verify_token}
								</p>
								<Button
									type="button"
									variant="destructive"
									disabled={whatsappLoading}
									onClick={async () => {
										setWhatsappLoading(true);
										const ok = await disconnectWhatsappIntegration(workspaceId);
										setWhatsappLoading(false);
										if (!ok) {
											setWhatsappError("قطع اتصال ناموفق بود.");
											return;
										}
										setWhatsappIntegration(null);
										setWhatsappMsg("اتصال واتساپ قطع شد.");
									}}
								>
									قطع اتصال
								</Button>
							</div>
						) : (
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									setWhatsappMsg("");
									setWhatsappError("");
									if (!waPhoneNumberId.trim() || !waAccessToken.trim()) {
										setWhatsappError("Phone Number ID و Access Token الزامی است.");
										return;
									}
									setWhatsappLoading(true);
									const result = await connectWhatsappIntegration(workspaceId, {
										phone_number_id: waPhoneNumberId.trim(),
										access_token: waAccessToken.trim(),
										verify_token: waVerifyToken.trim() || undefined,
									});
									setWhatsappLoading(false);
									if (!result.ok) {
										setWhatsappError(result.error ?? "اتصال ناموفق بود.");
										return;
									}
									if (result.data) {
										setWhatsappIntegration(result.data);
										setWaVerifyToken(result.data.verify_token);
									}
									setWaAccessToken("");
									setWhatsappMsg(
										"واتساپ متصل شد. Webhook را در Meta با URL و Verify Token بالا ثبت کنید.",
									);
									void loadWhatsapp();
								}}
								className="flex flex-col gap-3"
							>
								<label className="flex flex-col gap-1 text-sm font-medium">
									Phone Number ID
									<Input
										value={waPhoneNumberId}
										onChange={(e) => setWaPhoneNumberId(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm font-medium">
									Permanent Access Token
									<Input
										type="password"
										value={waAccessToken}
										onChange={(e) => setWaAccessToken(e.target.value)}
										dir="ltr"
										required
									/>
								</label>
								<label className="flex flex-col gap-1 text-sm font-medium">
									Verify Token (اختیاری — خودکار ساخته می‌شود)
									<Input
										value={waVerifyToken}
										onChange={(e) => setWaVerifyToken(e.target.value)}
										dir="ltr"
										placeholder="خالی بگذارید برای تولید خودکار"
									/>
								</label>
								<Button type="submit" disabled={whatsappLoading}>
									{whatsappLoading ? "در حال اتصال…" : "اتصال واتساپ"}
								</Button>
							</form>
						)}
						{whatsappError && (
							<p className="text-sm text-destructive">{whatsappError}</p>
						)}
						{whatsappMsg && (
							<p className="text-sm text-primary">{whatsappMsg}</p>
						)}
					</div>
				)}
				{tab === "hours" && (
					<form
						onSubmit={saveBusinessHours}
						className="mx-auto flex max-w-2xl flex-col gap-4"
					>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند ساعات کاری را ویرایش کند.
							</p>
						) : (
							<>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={bhEnabled}
										onChange={(e) => setBhEnabled(e.target.checked)}
									/>
									فعال‌سازی ساعات کاری
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">منطقه زمانی</span>
									<select
										className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
										value={bhTimezone}
										onChange={(e) => setBhTimezone(e.target.value)}
									>
										{TIMEZONES.map((tz) => (
											<option key={tz.value} value={tz.value}>
												{tz.label}
											</option>
										))}
									</select>
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										پیام خارج از ساعت کاری
									</span>
									<textarea
										className="mt-1 w-full rounded-md border border-input bg-background p-2"
										rows={3}
										value={bhAwayMessage}
										onChange={(e) => setBhAwayMessage(e.target.value)}
									/>
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={bhShowStatus}
										onChange={(e) => setBhShowStatus(e.target.checked)}
									/>
									نمایش وضعیت «آنلاین / خارج از ساعت کاری» در ویجت
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										تعطیلات (هر خط یک تاریخ YYYY-MM-DD)
									</span>
									<textarea
										className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
										rows={3}
										dir="ltr"
										value={bhHolidays}
										onChange={(e) => setBhHolidays(e.target.value)}
										placeholder="2026-03-20"
									/>
								</label>
								<div className="space-y-2">
									<p className="text-sm font-medium">برنامه هفتگی</p>
									{BH_WEEKDAYS.map((d) => (
										<div
											key={d.key}
											className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm"
										>
											<label className="flex w-24 items-center gap-2">
												<input
													type="checkbox"
													checked={bhSchedule[d.key].enabled}
													onChange={(e) =>
														setBhSchedule((s) => ({
															...s,
															[d.key]: {
																...s[d.key],
																enabled: e.target.checked,
															},
														}))
													}
												/>
												{d.label}
											</label>
											<input
												type="time"
												className="rounded border border-input px-2 py-1"
												value={bhSchedule[d.key].start}
												disabled={!bhSchedule[d.key].enabled}
												onChange={(e) =>
													setBhSchedule((s) => ({
														...s,
														[d.key]: { ...s[d.key], start: e.target.value },
													}))
												}
											/>
											<span>تا</span>
											<input
												type="time"
												className="rounded border border-input px-2 py-1"
												value={bhSchedule[d.key].end}
												disabled={!bhSchedule[d.key].enabled}
												onChange={(e) =>
													setBhSchedule((s) => ({
														...s,
														[d.key]: { ...s[d.key], end: e.target.value },
													}))
												}
											/>
										</div>
									))}
								</div>
								<Button type="submit">ذخیره ساعات کاری</Button>
							</>
						)}
						{hoursError && (
							<p className="text-sm text-destructive">{hoursError}</p>
						)}
						{hoursMsg && <p className="text-sm text-primary">{hoursMsg}</p>}
					</form>
				)}
				{tab === "sla" && (
					<form
						onSubmit={saveSla}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند SLA را ویرایش کند.
							</p>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									زمان اولین پاسخ و زمان حل مکالمه. پیش‌فرض‌ها بر اساس پلن
									ورک‌اسپیس اعمال می‌شود تا زمانی که ذخیره کنید.
								</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={slaEnabled}
										onChange={(e) => setSlaEnabled(e.target.checked)}
									/>
									فعال‌سازی SLA
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										اولین پاسخ (دقیقه)
									</span>
									<Input
										type="number"
										min={1}
										max={1440}
										className="mt-1"
										value={slaFirstMin}
										onChange={(e) =>
											setSlaFirstMin(Number(e.target.value) || 1)
										}
									/>
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">حل مکالمه (دقیقه)</span>
									<Input
										type="number"
										min={5}
										max={10080}
										className="mt-1"
										value={slaResMin}
										onChange={(e) =>
											setSlaResMin(Number(e.target.value) || 5)
										}
									/>
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										هشدار در ٪ زمان سپری‌شده
									</span>
									<Input
										type="number"
										min={50}
										max={99}
										className="mt-1"
										value={slaWarnPct}
										onChange={(e) =>
											setSlaWarnPct(Number(e.target.value) || 80)
										}
									/>
								</label>
								<Button type="submit">ذخیره SLA</Button>
							</>
						)}
						{slaError && (
							<p className="text-sm text-destructive">{slaError}</p>
						)}
						{slaMsg && <p className="text-sm text-primary">{slaMsg}</p>}
					</form>
				)}
				{tab === "csat" && (
					<form
						onSubmit={saveCsat}
						className="mx-auto flex max-w-md flex-col gap-4"
					>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند CSAT را ویرایش کند.
							</p>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									پس از بستن یا حل مکالمه، از بازدیدکننده امتیاز ۱ تا ۵
									پرسیده می‌شود.
								</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={csatEnabled}
										onChange={(e) => setCsatEnabled(e.target.checked)}
									/>
									فعال‌سازی CSAT
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">متن پرسش</span>
									<textarea
										className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										rows={3}
										value={csatPrompt}
										onChange={(e) => setCsatPrompt(e.target.value)}
										maxLength={500}
									/>
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={csatAskComment}
										onChange={(e) => setCsatAskComment(e.target.checked)}
									/>
									درخواست نظر اختیاری
								</label>
								<Button type="submit">ذخیره CSAT</Button>
							</>
						)}
						{csatError && (
							<p className="text-sm text-destructive">{csatError}</p>
						)}
						{csatMsg && <p className="text-sm text-primary">{csatMsg}</p>}
					</form>
				)}
				{tab === "ai" && (
					<form
						onSubmit={saveAi}
						className="mx-auto flex max-w-lg flex-col gap-4"
					>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر می‌تواند تنظیمات AI را ویرایش کند.
							</p>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									پس از حل یا بستن مکالمه، AI موضوع را تحلیل و تگ پیشنهاد
									می‌دهد.
								</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={autoTagEnabled}
										onChange={(e) => setAutoTagEnabled(e.target.checked)}
									/>
									فعال‌سازی تگ‌گذاری خودکار
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={autoTagApply}
										onChange={(e) => setAutoTagApply(e.target.checked)}
									/>
									اعمال خودکار تگ‌ها (بدون تأیید اپراتور)
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										زبان پیش‌فرض پاسخ AI
									</span>
									<select
										className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
										value={aiDefaultLang}
										onChange={(e) =>
											setAiDefaultLang(e.target.value as "fa" | "en" | "ar")
										}
									>
										<option value="fa">فارسی</option>
										<option value="en">English</option>
										<option value="ar">العربية</option>
									</select>
								</label>
								<p className="text-xs text-muted-foreground">
									اگر زبان پیام مشتری تشخیص داده شود، پاسخ به همان زبان
									ارسال می‌شود.
								</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={aiTranslateKb}
										onChange={(e) => setAiTranslateKb(e.target.checked)}
									/>
									ترجمه خودکار محتوای پایگاه دانش (آزمایشی)
								</label>
								<hr className="border-border" />
								<p className="text-sm font-medium">شخصیت AI (Persona)</p>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={personaEnabled}
										onChange={(e) => setPersonaEnabled(e.target.checked)}
									/>
									فعال‌سازی شخصیت سفارشی
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">نام دستیار</span>
									<Input
										className="mt-1"
										value={personaName}
										onChange={(e) => setPersonaName(e.target.value)}
										placeholder="مثلاً سارا"
										maxLength={80}
									/>
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">لحن</span>
									<select
										className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
										value={personaTone}
										onChange={(e) =>
											setPersonaTone(
												e.target.value as
													| "formal"
													| "friendly"
													| "technical",
											)
										}
									>
										<option value="friendly">دوستانه</option>
										<option value="formal">رسمی</option>
										<option value="technical">فنی</option>
									</select>
								</label>
								<label className="block text-sm">
									<span className="text-muted-foreground">
										دستورالعمل اضافی
									</span>
									<textarea
										className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										rows={4}
										value={personaInstructions}
										onChange={(e) =>
											setPersonaInstructions(e.target.value)
										}
										maxLength={2000}
										placeholder="مثلاً: همیشه کوتاه پاسخ بده و به محصول X اشاره کن."
									/>
								</label>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={personaPreviewLoading}
										onClick={() => {
											void (async () => {
												setPersonaPreviewLoading(true);
												setPersonaPreview("");
												const result = await previewAiPersona(
													workspaceId,
													{
														persona: {
															enabled: personaEnabled,
															name: personaName.trim() || null,
															tone: personaTone,
															custom_instructions:
																personaInstructions.trim(),
														},
													},
												);
												setPersonaPreviewLoading(false);
												if (!result) {
													setAiError(
														"پیش‌نمایش ناموفق بود. ai-service را بررسی کنید.",
													);
													return;
												}
												setPersonaPreview(result.reply);
											})();
										}}
									>
										{personaPreviewLoading
											? "در حال پیش‌نمایش…"
											: "پیش‌نمایش پاسخ"}
									</Button>
								</div>
								{personaPreview && (
									<div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
										<p className="mb-1 text-xs text-muted-foreground">
											نمونه پاسخ:
										</p>
										<p className="whitespace-pre-wrap">{personaPreview}</p>
									</div>
								)}
								<Button type="submit">ذخیره</Button>
							</>
						)}
						{aiError && (
							<p className="text-sm text-destructive">{aiError}</p>
						)}
						{aiMsg && <p className="text-sm text-primary">{aiMsg}</p>}
					</form>
				)}
				{tab === "security" && (
					<form
						onSubmit={saveSecurity}
						className="mx-auto flex max-w-lg flex-col gap-4"
					>
						{!canEditWorkspace ? (
							<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
								فقط مدیر (admin/owner) می‌تواند IP مسدود کند.
							</p>
						) : (
							<>
								<p className="text-sm text-muted-foreground">
									هر خط یک IP، محدوده wildcard (مثل{" "}
									<span dir="ltr">192.168.1.*</span>) یا CIDR (مثل{" "}
									<span dir="ltr">10.0.0.0/8</span>). بازدیدکنندگان با این IP
									نمی‌توانند چت کنند.
								</p>
								<label className="flex flex-col gap-1 text-sm font-medium">
									IPهای مسدود
									<textarea
										value={bannedIpsText}
										onChange={(e) => setBannedIpsText(e.target.value)}
										rows={10}
										dir="ltr"
										className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
										placeholder={"1.2.3.4\n192.168.1.*\n10.0.0.0/8"}
									/>
								</label>
								{securityError && (
									<p className="text-sm text-destructive">{securityError}</p>
								)}
								{securityMsg && (
									<p className="text-sm text-primary">{securityMsg}</p>
								)}
								<Button type="submit">ذخیره لیست IP</Button>
							</>
						)}
					</form>
				)}
				{tab === "security" && canEditWorkspace && (
					<form
						onSubmit={saveDashboardIpWhitelist}
						className="mx-auto mt-8 flex max-w-lg flex-col gap-4 border-t border-border pt-6"
					>
						<p className="text-sm font-medium">محدودیت IP داشبورد اپراتور</p>
						<p className="text-sm text-muted-foreground">
							فقط برای API داشبورد (نه ویجت). اگر لیست خالی باشد، همه IPها
							مجازند. پس از فعال‌سازی، IP فعلی خود را در لیست بگذارید.
						</p>
						<label className="flex flex-col gap-1 text-sm font-medium">
							IPهای مجاز (هر خط یک مورد)
							<textarea
								value={dashboardIpWhitelistText}
								onChange={(e) => setDashboardIpWhitelistText(e.target.value)}
								rows={8}
								dir="ltr"
								className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
								placeholder={"203.0.113.10\n192.168.1.*\n10.0.0.0/8"}
							/>
						</label>
						<Button type="submit">ذخیره لیست مجاز داشبورد</Button>
					</form>
				)}
				{tab === "security" && workspaceRole === "owner" && (
					<form
						className="mx-auto mt-8 flex max-w-lg flex-col gap-4 border-t border-border pt-6"
						onSubmit={async (e) => {
							e.preventDefault();
							setSecurityMsg("");
							setSecurityError("");
							const ok = await updateRequire2fa(workspaceId, require2faEnabled);
							if (!ok) {
								setSecurityError("ذخیره الزام 2FA ناموفق بود.");
								return;
							}
							setSecurityMsg(
								require2faEnabled
									? "ورود با 2FA برای همه اعضای workspace الزامی شد."
									: "الزام 2FA غیرفعال شد.",
							);
						}}
					>
						<p className="text-sm font-medium">الزام 2FA برای اعضا</p>
						<p className="text-sm text-muted-foreground">
							اعضایی که 2FA فعال نکرده‌اند به API این workspace دسترسی ندارند.
						</p>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={require2faEnabled}
								onChange={(e) => setRequire2faEnabled(e.target.checked)}
							/>
							ورود دو مرحله‌ای اجباری
						</label>
						<Button type="submit">ذخیره سیاست 2FA</Button>
					</form>
				)}
				{tab === "branding" && (
					<BrandingSettingsPanel workspaceId={workspaceId} />
				)}
				{canEditWorkspace && tab === "security" && (
					<div className="mx-auto mt-6 max-w-lg rounded-lg border border-border bg-card p-4">
						<p className="text-sm font-medium">لاگ حسابرسی</p>
						<p className="mt-1 text-xs text-muted-foreground">
							ورود، تغییر تنظیمات و export — نگهداری تا ۱ سال.
						</p>
						<Link
							href="/settings/audit"
							className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
						>
							باز کردن لاگ حسابرسی →
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
