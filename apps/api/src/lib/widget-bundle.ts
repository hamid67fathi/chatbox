import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDGET_SRC_DIR = resolve(__dirname, "../../../widget/src");
const WIDGET_ENTRY = join(WIDGET_SRC_DIR, "index.ts");
const WIDGET_DIST = resolve(__dirname, "../../../widget/dist/index.global.js");

let builtCache: string | null = null;
let builtCacheMtime = 0;

function latestSourceMtime(dir: string): number {
	let latest = 0;
	for (const name of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, name.name);
		if (name.isDirectory()) {
			latest = Math.max(latest, latestSourceMtime(path));
		} else if (/\.tsx?$/.test(name.name)) {
			latest = Math.max(latest, statSync(path).mtimeMs);
		}
	}
	return latest;
}

function isDistStale(): boolean {
	if (!existsSync(WIDGET_DIST)) return true;
	const srcMtime = latestSourceMtime(WIDGET_SRC_DIR);
	const distMtime = statSync(WIDGET_DIST).mtimeMs;
	return srcMtime > distMtime;
}

export function readWidgetBundleFromDisk(): string | null {
	if (isDistStale()) return null;
	return readFileSync(WIDGET_DIST, "utf8");
}

/** Build widget IIFE when dist/ is missing (typical after git pull without build). */
export async function bundleWidgetOnTheFly(): Promise<string> {
	const srcMtime = latestSourceMtime(WIDGET_SRC_DIR);
	if (builtCache && builtCacheMtime >= srcMtime) return builtCache;

	const result = await build({
		entryPoints: [WIDGET_ENTRY],
		bundle: true,
		format: "iife",
		write: false,
		target: "es2020",
		platform: "browser",
		minify: process.env.NODE_ENV === "production",
		logLevel: "silent",
		loader: { ".ttf": "dataurl" },
	});

	const text = result.outputFiles[0]?.text;
	if (!text) throw new Error("Widget bundle produced no output.");
	builtCache = text;
	builtCacheMtime = Date.now();
	return text;
}

export async function getWidgetBundleJs(): Promise<string> {
	const fromDisk = readWidgetBundleFromDisk();
	if (fromDisk) return fromDisk;
	return bundleWidgetOnTheFly();
}
