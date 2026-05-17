export interface EmailMailboxConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	password: string;
}

export interface EmailIntegrationConfig {
	enabled: boolean;
	imap: EmailMailboxConfig;
	smtp: EmailMailboxConfig;
	from_address: string;
	from_name: string | null;
	imap_last_uid: number;
	connected_at: string;
}

export interface EmailIntegrationPublic {
	type: "email";
	enabled: boolean;
	from_address: string;
	from_name: string | null;
	imap_host: string;
	smtp_host: string;
	connected_at: string;
	imap_user_masked: string;
}

function integrationsRoot(settings: unknown): Record<string, unknown> {
	if (!settings || typeof settings !== "object") return {};
	const root = settings as Record<string, unknown>;
	const integrations = root.integrations;
	if (!integrations || typeof integrations !== "object") return {};
	return integrations as Record<string, unknown>;
}

function parseMailbox(raw: unknown): EmailMailboxConfig | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const host = typeof o.host === "string" ? o.host.trim() : "";
	const user = typeof o.user === "string" ? o.user.trim() : "";
	const password = typeof o.password === "string" ? o.password : "";
	const port =
		typeof o.port === "number"
			? o.port
			: typeof o.port === "string"
				? Number(o.port)
				: NaN;
	if (!host || !user || !password || !Number.isFinite(port)) return null;
	return {
		host,
		port,
		secure: o.secure === true,
		user,
		password,
	};
}

export function parseEmailIntegration(
	settings: unknown,
): EmailIntegrationConfig | null {
	const em = integrationsRoot(settings).email;
	if (!em || typeof em !== "object") return null;
	const o = em as Record<string, unknown>;
	const imap = parseMailbox(o.imap);
	const smtp = parseMailbox(o.smtp);
	const fromAddress =
		typeof o.from_address === "string" ? o.from_address.trim() : "";
	if (!imap || !smtp || !fromAddress) return null;

	const imapLastUid =
		typeof o.imap_last_uid === "number"
			? o.imap_last_uid
			: typeof o.imap_last_uid === "string"
				? Number(o.imap_last_uid)
				: 0;

	return {
		enabled: o.enabled !== false,
		imap,
		smtp,
		from_address: fromAddress,
		from_name:
			typeof o.from_name === "string" && o.from_name.trim()
				? o.from_name.trim().slice(0, 120)
				: null,
		imap_last_uid: Number.isFinite(imapLastUid) ? imapLastUid : 0,
		connected_at:
			typeof o.connected_at === "string"
				? o.connected_at
				: new Date().toISOString(),
	};
}

export function maskEmailUser(user: string): string {
	if (!user.includes("@")) return `${user.slice(0, 2)}…`;
	const [local, domain] = user.split("@");
	return `${local.slice(0, 2)}…@${domain}`;
}

export function toPublicEmailIntegration(
	config: EmailIntegrationConfig,
): EmailIntegrationPublic {
	return {
		type: "email",
		enabled: config.enabled,
		from_address: config.from_address,
		from_name: config.from_name,
		imap_host: config.imap.host,
		smtp_host: config.smtp.host,
		connected_at: config.connected_at,
		imap_user_masked: maskEmailUser(config.imap.user),
	};
}

export function mergeEmailIntegration(
	settings: unknown,
	config: EmailIntegrationConfig | null,
): Record<string, unknown> {
	const base =
		settings && typeof settings === "object"
			? { ...(settings as Record<string, unknown>) }
			: {};
	const integrations =
		base.integrations && typeof base.integrations === "object"
			? { ...(base.integrations as Record<string, unknown>) }
			: {};

	if (!config) {
		const { email: _removed, ...rest } = integrations;
		if (Object.keys(rest).length === 0) {
			const { integrations: _i, ...top } = base;
			return top;
		}
		return { ...base, integrations: rest };
	}

	return {
		...base,
		integrations: {
			...integrations,
			email: config,
		},
	};
}

export interface EmailConnectInput {
	imap_host: string;
	imap_port: number;
	imap_secure: boolean;
	imap_user: string;
	imap_password: string;
	smtp_host: string;
	smtp_port: number;
	smtp_secure: boolean;
	smtp_user: string;
	smtp_password: string;
	from_address: string;
	from_name?: string | null;
}

export function emailConfigFromInput(input: EmailConnectInput): EmailIntegrationConfig {
	return {
		enabled: true,
		imap: {
			host: input.imap_host.trim(),
			port: input.imap_port,
			secure: input.imap_secure,
			user: input.imap_user.trim(),
			password: input.imap_password,
		},
		smtp: {
			host: input.smtp_host.trim(),
			port: input.smtp_port,
			secure: input.smtp_secure,
			user: input.smtp_user.trim(),
			password: input.smtp_password,
		},
		from_address: input.from_address.trim(),
		from_name: input.from_name?.trim() || null,
		imap_last_uid: 0,
		connected_at: new Date().toISOString(),
	};
}
