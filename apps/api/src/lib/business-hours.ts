export type WeekdayKey =
	| "mon"
	| "tue"
	| "wed"
	| "thu"
	| "fri"
	| "sat"
	| "sun";

export interface DaySchedule {
	enabled: boolean;
	start: string;
	end: string;
}

export interface BusinessHoursConfig {
	enabled: boolean;
	timezone: string;
	schedule: Partial<Record<WeekdayKey, DaySchedule>>;
	holidays: string[];
	away_message: string;
	show_status_in_widget: boolean;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
	enabled: false,
	timezone: "Asia/Tehran",
	schedule: {
		sat: { enabled: true, start: "09:00", end: "18:00" },
		sun: { enabled: true, start: "09:00", end: "18:00" },
		mon: { enabled: true, start: "09:00", end: "18:00" },
		tue: { enabled: true, start: "09:00", end: "18:00" },
		wed: { enabled: true, start: "09:00", end: "18:00" },
		thu: { enabled: true, start: "09:00", end: "18:00" },
		fri: { enabled: false, start: "09:00", end: "18:00" },
	},
	holidays: [],
	away_message:
		"در حال حاضر خارج از ساعات کاری هستیم. پیام شما ثبت شد و در اولین فرصت پاسخ می‌دهیم.",
	show_status_in_widget: true,
};

const WEEKDAY_KEYS: WeekdayKey[] = [
	"mon",
	"tue",
	"wed",
	"thu",
	"fri",
	"sat",
	"sun",
];

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey> = {
	Mon: "mon",
	Tue: "tue",
	Wed: "wed",
	Thu: "thu",
	Fri: "fri",
	Sat: "sat",
	Sun: "sun",
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function businessHoursRoot(settings: unknown): Record<string, unknown> {
	if (!settings || typeof settings !== "object") return {};
	const root = settings as Record<string, unknown>;
	const bh = root.business_hours;
	if (!bh || typeof bh !== "object") return {};
	return bh as Record<string, unknown>;
}

function parseDay(raw: unknown): DaySchedule | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const start = typeof o.start === "string" && TIME_RE.test(o.start) ? o.start : "09:00";
	const end = typeof o.end === "string" && TIME_RE.test(o.end) ? o.end : "18:00";
	return {
		enabled: o.enabled === true,
		start,
		end,
	};
}

export function parseBusinessHours(
	settings: unknown,
	workspaceTimezone?: string,
): BusinessHoursConfig {
	const o = businessHoursRoot(settings);
	const schedule: Partial<Record<WeekdayKey, DaySchedule>> = {};
	const rawSchedule = o.schedule;
	if (rawSchedule && typeof rawSchedule === "object") {
		for (const key of WEEKDAY_KEYS) {
			const day = parseDay((rawSchedule as Record<string, unknown>)[key]);
			if (day) schedule[key] = day;
		}
	}

	const holidays = Array.isArray(o.holidays)
		? o.holidays.filter(
				(h): h is string =>
					typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h),
			)
		: [];

	return {
		enabled: o.enabled === true,
		timezone:
			typeof o.timezone === "string" && o.timezone.trim()
				? o.timezone.trim()
				: workspaceTimezone || DEFAULT_BUSINESS_HOURS.timezone,
		schedule:
			Object.keys(schedule).length > 0
				? schedule
				: { ...DEFAULT_BUSINESS_HOURS.schedule },
		holidays,
		away_message:
			typeof o.away_message === "string" && o.away_message.trim()
				? o.away_message.trim().slice(0, 1000)
				: DEFAULT_BUSINESS_HOURS.away_message,
		show_status_in_widget: o.show_status_in_widget !== false,
	};
}

export function mergeBusinessHoursSettings(
	settings: unknown,
	patch: Partial<BusinessHoursConfig>,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parseBusinessHours(base);
	const next: BusinessHoursConfig = {
		enabled: patch.enabled ?? current.enabled,
		timezone: patch.timezone ?? current.timezone,
		schedule: patch.schedule ?? current.schedule,
		holidays: patch.holidays ?? current.holidays,
		away_message: patch.away_message ?? current.away_message,
		show_status_in_widget:
			patch.show_status_in_widget ?? current.show_status_in_widget,
	};
	return { ...base, business_hours: next };
}

function parseMinutes(time: string): number {
	const m = TIME_RE.exec(time);
	if (!m) return 0;
	return Number(m[1]) * 60 + Number(m[2]);
}

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		weekday: "short",
		hour12: false,
	}).formatToParts(date);

	const get = (type: string) =>
		parts.find((p) => p.type === type)?.value ?? "";

	return {
		weekday: get("weekday"),
		hour: Number(get("hour")),
		minute: Number(get("minute")),
		year: get("year"),
		month: get("month"),
		day: get("day"),
	};
}

export function isWithinBusinessHours(
	config: BusinessHoursConfig,
	at: Date = new Date(),
): boolean {
	if (!config.enabled) return true;

	const tz = config.timezone || "UTC";
	const parts = zonedParts(at, tz);
	const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
	if (config.holidays.includes(dateKey)) return false;

	const weekday = WEEKDAY_FROM_SHORT[parts.weekday];
	if (!weekday) return false;

	const day = config.schedule[weekday];
	if (!day?.enabled) return false;

	const nowMin = parts.hour * 60 + parts.minute;
	const startMin = parseMinutes(day.start);
	const endMin = parseMinutes(day.end);

	if (startMin === endMin) return false;
	if (startMin < endMin) {
		return nowMin >= startMin && nowMin < endMin;
	}
	return nowMin >= startMin || nowMin < endMin;
}

export function businessHoursToPublic(
	config: BusinessHoursConfig,
	at: Date = new Date(),
) {
	const open = isWithinBusinessHours(config, at);
	return {
		enabled: config.enabled,
		is_open: open,
		show_status: config.show_status_in_widget,
		status_label: open ? "آنلاین" : "خارج از ساعت کاری",
		away_message: open ? null : config.away_message,
		timezone: config.timezone,
	};
}

export function parseBusinessHoursPatch(
	body: Record<string, unknown>,
): Partial<BusinessHoursConfig> {
	const raw = body.business_hours;
	if (!raw || typeof raw !== "object") return {};
	const o = raw as Record<string, unknown>;
	const patch: Partial<BusinessHoursConfig> = {};

	if (typeof o.enabled === "boolean") patch.enabled = o.enabled;
	if (typeof o.timezone === "string" && o.timezone.trim()) {
		patch.timezone = o.timezone.trim();
	}
	if (typeof o.away_message === "string") {
		patch.away_message = o.away_message;
	}
	if (typeof o.show_status_in_widget === "boolean") {
		patch.show_status_in_widget = o.show_status_in_widget;
	}
	if (Array.isArray(o.holidays)) {
		patch.holidays = o.holidays.filter(
			(h): h is string => typeof h === "string",
		);
	}
	if (o.schedule && typeof o.schedule === "object") {
		const schedule: Partial<Record<WeekdayKey, DaySchedule>> = {};
		for (const key of WEEKDAY_KEYS) {
			const day = parseDay((o.schedule as Record<string, unknown>)[key]);
			if (day) schedule[key] = day;
		}
		if (Object.keys(schedule).length > 0) patch.schedule = schedule;
	}

	return patch;
}
