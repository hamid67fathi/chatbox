import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["iife"],
	globalName: "ChatBoxWidget",
	outDir: "dist",
	minify: true,
	sourcemap: true,
	clean: true,
	target: "es2020",
});
