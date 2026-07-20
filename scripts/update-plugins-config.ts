import { YAML } from "bun";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CONFIG_DIR = "config";
const PLUGIN_DIRS = [
	"./plugins",
	"./plugins-custom",
];

const configPath = join(CONFIG_DIR, "plugins.yml");

const existing: Record<string, any> = {};
if (existsSync(configPath)) {
	const data = readFileSync(configPath, "utf-8");
	const parsed = YAML.parse(data) as Record<string, any> | null;
	if (parsed?.plugins) {
		for (const [key, val] of Object.entries(parsed.plugins)) {
			existing[key] = val;
		}
	}
}

for (const dir of PLUGIN_DIRS) {
	if (!existsSync(dir)) continue;
	const entries = readdirSync(dir, {
		withFileTypes: true,
	});
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const normalizedDir = dir.startsWith("./") ? dir.slice(2) : dir;
		const key = normalizedDir + "/" + entry.name;
		if (!(key in existing)) {
			existing[key] = false;
		}
	}
}

const lines = [
	"plugins:",
];

for (const [key, val] of Object.entries(existing)) {
	lines.push(`  ${key}: ${val}`);
}
lines.push("");

writeFileSync(configPath, lines.join("\n"));
console.log("Updated " + configPath);
