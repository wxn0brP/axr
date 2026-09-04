import { PluginCtx } from "#core/types";
import { Cron } from "croner";
import { YAML } from "bun";
import { existsSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LIST_MARKER = "The current list of models includes:";
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

let STATE_FILE: string;

interface State {
	models: string[];
	last_check: string;
}

let jobs: Cron[] = [];

async function readState(): Promise<State> {
	if (!existsSync(STATE_FILE))
		return {
			models: [],
			last_check: null,
		};
	try {
		const data = await readFile(STATE_FILE, "utf-8");
		const parsed = YAML.parse(data) as any;
		return {
			models: Array.isArray(parsed?.models) ? parsed.models : [],
			last_check: parsed?.last_check ?? null,
		};
	} catch (error) {
		console.error("[model-watch] Failed to read state:", error);
		return {
			models: [],
			last_check: null,
		};
	}
}

function writeState(state: State) {
	try {
		writeFileSync(STATE_FILE, YAML.stringify(state, null, 2));
	} catch (error) {
		console.error("[model-watch] Failed to write state:", error);
	}
}

export function parseModels(markdown: string) {
	const idx = markdown.indexOf(LIST_MARKER);
	if (idx === -1) return [];

	let section = markdown.slice(idx + LIST_MARKER.length);
	const end = section.search(/\n---|\n## /);
	if (end !== -1) section = section.slice(0, end);

	const models = [
		...section.matchAll(/^- \*\*(.+?)\*\*/gm),
	].map(m => m[1].trim());
	return [
		...new Set(models),
	];
}

function ensureTimesArray(times: unknown) {
	if (Array.isArray(times)) return times;
	if (typeof times === "string")
		return [
			times,
		];
	return [];
}

function normalizeTimes(times: unknown) {
	const list = ensureTimesArray(times);
	const valid = list.filter(t => typeof t === "string" && TIME_RE.test(t));
	if (valid.length > 0) return valid;
	throw new Error("Invalid times: " + list.join(", "));
}

export function hhmmToCron(time: string) {
	const [h, m] = time.split(":").map(Number);
	return `${m} ${h} * * *`;
}

async function notify(ctx: PluginCtx, added: string[]) {
	try {
		const result: any = await ctx.query({
			db: "notif",
			d: {
				add: {
					collection: "send",
					data: {
						title: "New models in OpenCode Go",
						body: "New models: " + added.join(", "),
						to: ctx.config?.to || "all",
					},
				},
			},
		});
		if (result?.err)
			console.error("[model-watch] Notification failed:", result.msg);
		else console.log("[model-watch] Notification sent");
	} catch (error: any) {
		console.error("[model-watch] Notification error:", error.message);
	}
}

async function check(ctx: PluginCtx) {
	const url = ctx.config.url;
	if (!url) throw new Error("Missing URL");

	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const models = parseModels(await res.text());
		if (models.length === 0)
			throw new Error("No models found, page format changed?");

		const state = await readState();
		const isFirstRun = state.models.length === 0;
		const known = new Set(state.models);
		const added = models.filter(m => !known.has(m));

		writeState({
			models,
			last_check: new Date().toISOString(),
		});

		if (isFirstRun) {
			console.log(`[model-watch] Initial state saved: ${models.length} models`);
		} else if (added.length > 0) {
			console.log(`[model-watch] New models: ${added.join(", ")}`);
			await notify(ctx, added);
		} else {
			console.log(`[model-watch] No changes (${models.length} models)`);
		}

		return {
			ok: true,
			added,
			total: models.length,
		};
	} catch (error: any) {
		console.error("[model-watch] Check failed:", error.message);
		return {
			err: true,
			msg: error.message,
		};
	}
}

function scheduleNext(ctx: PluginCtx) {
	const times = normalizeTimes(ctx.config?.times);
	jobs = times.map(
		t =>
			new Cron(
				hhmmToCron(t),
				{
					protect: true,
				},
				async () => {
					console.log(`[model-watch] Cron triggered (time: ${t})`);
					await check(ctx);
				},
			),
	);

	console.log(`[model-watch] Cron scheduled (times: ${times.join(", ")})`);
}

export function dispose() {
	for (const job of jobs) job.stop();
	jobs = [];
	console.log("[model-watch] Cron jobs stopped");
}

export default (ctx: PluginCtx) => {
	STATE_FILE = join(ctx.configDir(), "state.yml");

	ctx.panel.register({
		label: "Model Watch",
		description: "Monitor the OpenCode Go model list and alert on new models.",
		endpoints: [
			{
				name: "check_now",
				label: "Check now",
				description: "Force a check of the OpenCode Go model list.",
				operation: "add",
				collection: "check",
				fields: [],
			},
			{
				name: "state",
				label: "Known models",
				description: "View the last known model list and check time.",
				operation: "find",
				collection: "state",
				fields: [],
			},
		],
	});

	ctx.adapter.add("check", async () => check(ctx));
	ctx.adapter.find("state", async () => {
		const state = await readState();
		return state.models.map(m => ({
			model: m,
		}));
	});

	check(ctx);
	scheduleNext(ctx);
};
