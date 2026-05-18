import type { ChatBoxWidget } from "./widget.js";

type CbxArgs =
	| ["track", string, Record<string, unknown>?]
	| ["identify", Record<string, unknown>?];

const pending: CbxArgs[] = [];

function getWidget(): ChatBoxWidget | null {
	const w = (window as unknown as { __chatbox?: ChatBoxWidget }).__chatbox;
	return w ?? null;
}

function runCommand(args: CbxArgs): void {
	const widget = getWidget();
	if (!widget) {
		pending.push(args);
		return;
	}
	const [cmd, a, b] = args;
	if (cmd === "track") {
		widget.trackCustom(String(a), (b as Record<string, unknown>) ?? {});
	} else if (cmd === "identify") {
		void widget.identifyTraits((a as Record<string, unknown>) ?? {});
	}
}

export function flushCbxQueue(): void {
	while (pending.length > 0) {
		const cmd = pending.shift();
		if (cmd) runCommand(cmd);
	}
}

function toArgs(raw: IArguments | CbxArgs): CbxArgs {
	const arr = Array.from(raw as unknown as unknown[]);
	return arr as CbxArgs;
}

export function installCbxGlobal(): void {
	const prev = (window as unknown as { cbx?: { q?: unknown[] } }).cbx;
	const queued: CbxArgs[] = [];
	if (prev && Array.isArray(prev.q)) {
		for (const item of prev.q) {
			queued.push(toArgs(item as IArguments));
		}
	}

	const api = (...args: CbxArgs) => {
		runCommand(args);
	};
	(window as unknown as { cbx: typeof api }).cbx = api;

	for (const item of queued) {
		runCommand(item);
	}
}
