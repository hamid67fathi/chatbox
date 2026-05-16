export interface PrechatFieldConfig {
	enabled: boolean;
	required: boolean;
}

export interface PrechatConfig {
	enabled: boolean;
	fields: {
		name: PrechatFieldConfig;
		email: PrechatFieldConfig;
		phone: PrechatFieldConfig;
	};
}

export const DEFAULT_PRECHAT_CONFIG: PrechatConfig = {
	enabled: false,
	fields: {
		name: { enabled: true, required: true },
		email: { enabled: true, required: false },
		phone: { enabled: false, required: false },
	},
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseField(
	raw: unknown,
	fallback: PrechatFieldConfig,
): PrechatFieldConfig {
	if (!raw || typeof raw !== "object") return { ...fallback };
	const o = raw as Record<string, unknown>;
	return {
		enabled: o.enabled === true,
		required: o.required === true,
	};
}

export function parsePrechatConfig(settings: unknown): PrechatConfig {
	const base =
		settings && typeof settings === "object"
			? (settings as Record<string, unknown>)
			: {};
	const raw = base.prechat ?? base.prechat_form;
	if (!raw || typeof raw !== "object") return { ...DEFAULT_PRECHAT_CONFIG };
	const o = raw as Record<string, unknown>;
	const fields = o.fields;
	const f =
		fields && typeof fields === "object"
			? (fields as Record<string, unknown>)
			: {};
	return {
		enabled: o.enabled === true,
		fields: {
			name: parseField(f.name, DEFAULT_PRECHAT_CONFIG.fields.name),
			email: parseField(f.email, DEFAULT_PRECHAT_CONFIG.fields.email),
			phone: parseField(f.phone, DEFAULT_PRECHAT_CONFIG.fields.phone),
		},
	};
}

export function prechatToPublic(config: PrechatConfig) {
	return {
		enabled: config.enabled,
		fields: {
			name: { ...config.fields.name },
			email: { ...config.fields.email },
			phone: { ...config.fields.phone },
		},
	};
}

export function mergePrechatSettings(
	settings: unknown,
	patch: Partial<PrechatConfig> & {
		fields?: Partial<PrechatConfig["fields"]>;
	},
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const current = parsePrechatConfig(base);
	const next: PrechatConfig = {
		enabled: patch.enabled ?? current.enabled,
		fields: {
			name: { ...current.fields.name, ...patch.fields?.name },
			email: { ...current.fields.email, ...patch.fields?.email },
			phone: { ...current.fields.phone, ...patch.fields?.phone },
		},
	};
	base.prechat = next;
	return base;
}

export type ContactProfile = {
	fullName: string | null;
	email: string | null;
	phone: string | null;
};

export function isContactProfileComplete(
	contact: ContactProfile,
	prechat: PrechatConfig,
): boolean {
	if (!prechat.enabled) return true;

	const checks: Array<{ cfg: PrechatFieldConfig; value: string | null }> = [
		{ cfg: prechat.fields.name, value: contact.fullName },
		{ cfg: prechat.fields.email, value: contact.email },
		{ cfg: prechat.fields.phone, value: contact.phone },
	];

	for (const { cfg, value } of checks) {
		if (!cfg.enabled || !cfg.required) continue;
		const trimmed = value?.trim() ?? "";
		if (!trimmed) return false;
		if (
			cfg === prechat.fields.name &&
			trimmed.toLowerCase() === "visitor"
		) {
			return false;
		}
	}
	return true;
}

export function validatePrechatPayload(
	prechat: PrechatConfig,
	data: { full_name?: string; email?: string; phone?: string },
): { fullName: string | null; email: string | null; phone: string | null } {
	const fullName = data.full_name?.trim() || null;
	const email = data.email?.trim().toLowerCase() || null;
	const phone = data.phone?.trim() || null;

	if (prechat.enabled) {
		if (prechat.fields.name.enabled && prechat.fields.name.required && !fullName) {
			throw new Error("full_name is required.");
		}
		if (prechat.fields.email.enabled && prechat.fields.email.required && !email) {
			throw new Error("email is required.");
		}
		if (prechat.fields.phone.enabled && prechat.fields.phone.required && !phone) {
			throw new Error("phone is required.");
		}
	}

	if (email && !EMAIL_RE.test(email)) {
		throw new Error("email is invalid.");
	}

	return { fullName, email, phone };
}
