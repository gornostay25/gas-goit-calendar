import appsscriptJson from "../appsscript.json" with { type: "json" };
import packageJson from "../package.json" with { type: "json" };
import path from "node:path";

const banner = `
/**
 * @title GoIT Calendar Sync
 * @description Sync GoIT events into a dedicated Google Calendar ("GoIT Calendar") with Google Apps Script.
 * @version ${packageJson.version}
 * @date ${new Date().toISOString()}
 * @author ${packageJson.author}
 * @source ${packageJson.repository.url}
 * @license ${packageJson.license}
 */
`.trim();

const OUTPUT_DIR = path.join(process.cwd(), "./dist");

const buildResult = await Bun.build({
	entrypoints: ["./src/main.ts"],
	outdir: OUTPUT_DIR,
	target: "browser",
	format: "esm",
	minify: true,
	env: "inline",
	plugins: [
		{
			name: "appsscript.json",
			setup(build) {
				build.onStart(() => {
					const appsscript = {
						...appsscriptJson,
						timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // User's time zone
						oauthScopes: [
							"https://www.googleapis.com/auth/script.external_request", // External Request
							"https://www.googleapis.com/auth/script.scriptapp", // Triggers & Properties
							"https://www.googleapis.com/auth/calendar", // Calendar
						],
					};

					Bun.write(
						path.join(OUTPUT_DIR, "appsscript.json"),
						JSON.stringify(appsscript, null, 2),
					);
				});
			},
		},
		{
			name: "GAS Export Fixer",
			setup(build) {
				const REGEXP_EXPORT = /export\s*\{(\s*[^}]*\s*)}\s*;/gm;
				build.onEnd(async (result) => {
					const entrypoint = result.outputs.find(
						(o) => o.kind === "entry-point",
					);
					if (!entrypoint) {
						throw new Error("Entry point not found");
					}
					const file = Bun.file(entrypoint.path);
					const contents = await file.text();
					const match = REGEXP_EXPORT.exec(contents);
					if (!match || !match[1]) {
						throw new Error("Export statement not found");
					}
					const exports = match[1].split(",").map((name) => name.trim());
					const exportedFunctions = build.config.minify
						? exports.map((exportItem) => {
								const [minifiedName, exportName] = exportItem.split(" as ");
								return `function ${exportName}(){return ${minifiedName}.apply(this, arguments)};`;
							})
						: [];
					const newContents = contents.replace(REGEXP_EXPORT, "");
					await file.write(
						`${banner}\n${exportedFunctions.join("")}\n${newContents}`,
					);
				});
			},
		},
	],
	sourcemap: "none",
});

if (!buildResult.success) {
	for (const log of buildResult.logs) {
		console.error(log);
	}

	process.exit(1);
}

console.log("Build completed:", OUTPUT_DIR);
