import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGET_ENTRY = resolve(__dirname, "../../../widget/src/index.ts");
const WIDGET_DIST = resolve(__dirname, "../../../widget/dist/index.global.js");

let builtCache: string | null = null;

export function readWidgetBundleFromDisk(): string | null {
	if (!existsSync(WIDGET_DIST)) return null;
	return readFileSync(WIDGET_DIST, "utf8");
}

/** Build widget IIFE when dist/ is missing (typical after git pull without build). */
export async function bundleWidgetOnTheFly(): Promise<string> {
	if (builtCache) return builtCache;

	const result = await build({
		entryPoints: [WIDGET_ENTRY],
		bundle: true,
		format: "iife",
		write: false,
		target: "es2020",
		platform: "browser",
		minify: process.env.NODE_ENV === "production",
		logLevel: "silent",
	});

	const text = result.outputFiles[0]?.text;
	if (!text) throw new Error("Widget bundle produced no output.");
	builtCache = text;
	return text;
}

export async function getWidgetBundleJs(): Promise<string> {
	const fromDisk = readWidgetBundleFromDisk();
	if (fromDisk) return fromDisk;
	return bundleWidgetOnTheFly();
}
