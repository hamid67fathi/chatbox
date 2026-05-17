import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wpDir = join(root, "integrations", "wordpress");
const pluginDir = join(wpDir, "chatbox-abzar");
const outZip = join(wpDir, "chatbox-abzar.zip");

const wpDirEsc = wpDir.replace(/'/g, "''");

if (process.platform === "win32") {
	execSync(
		`powershell -NoProfile -Command "Set-Location '${wpDirEsc}'; if (Test-Path 'chatbox-abzar.zip') { Remove-Item 'chatbox-abzar.zip' -Force }; Compress-Archive -Path 'chatbox-abzar' -DestinationPath 'chatbox-abzar.zip'"`,
		{ stdio: "inherit" },
	);
} else {
	execSync(`rm -f '${outZip}' && zip -r chatbox-abzar.zip chatbox-abzar`, {
		cwd: wpDir,
		stdio: "inherit",
	});
}

console.log(`WordPress plugin zip: ${outZip}`);
