import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
	copyPluginConfigs,
	getPluginConfigDir,
	loadPluginConfigs,
} from "./config";
import { clearPanelAdapter, createPanel } from "./panel";
import { PluginCtx } from "./types";
import { app, events, vql } from "./var";

const loadedPlugins = new Map<
	string,
	{
		dispose?: Function;
	}
>();

async function installPluginDependencies(pluginDir: string): Promise<void> {
	const packageJsonPath = join(pluginDir, "package.json");
	const nodeModulesPath = join(pluginDir, "node_modules");

	if (!existsSync(packageJsonPath)) return;

	if (existsSync(nodeModulesPath)) return;

	console.log(`Installing dependencies for plugin in ${pluginDir}...`);
	try {
		await $`cd ${pluginDir} && bun i --production -f`;
		console.log(`Plugin dependencies installed: ${pluginDir}`);
	} catch (error) {
		console.error(
			`Failed to install plugin dependencies in ${pluginDir}:`,
			error,
		);
	}
}

export async function loadPlugin(dir: string, ctx: PluginCtx) {
	const plugin = await import(dir);
	plugin?.default(ctx);
	return plugin;
}

function createContext(pluginName: string): PluginCtx {
	return {
		event: events,
		app: app,
		query: vql.execute.bind(vql),
		vql: vql,
		adapter: new AdapterBuilder(),
		config: {},
		configDir: () => getPluginConfigDir(pluginName),
		panel: createPanel(pluginName),
	};
}

export async function loadPlugins(
	dir: string,
	pluginsConfig: Record<string, any> = {},
) {
	if (!existsSync(dir))
		return console.warn("Plugins directory not found: " + dir);
	const entires = await readdir(dir, {
		withFileTypes: true,
	});
	const normalizedDir = dir.startsWith("./") ? dir.slice(2) : dir;

	for (const entire of entires) {
		if (!entire.isDirectory()) continue;

		const pluginPath = normalizedDir + "/" + entire.name;
		const pluginName = entire.name;

		const enabled =
			pluginPath in pluginsConfig
				? !!pluginsConfig[pluginPath]
				: pluginName in pluginsConfig
					? !!pluginsConfig[pluginName]
					: false;

		if (!enabled) {
			console.log("Plugin disabled: " + pluginPath);
			continue;
		}

		if (loadedPlugins.has(pluginName)) {
			const plugin = loadedPlugins.get(pluginName);
			await plugin?.dispose?.();
			clearPanelAdapter(pluginName);
		}

		const pluginDir = join(process.cwd(), dir, pluginName);

		await installPluginDependencies(pluginDir);
		await copyPluginConfigs(pluginDir, pluginName);

		const ctx = createContext(pluginName);
		ctx.config = await loadPluginConfigs(pluginName);

		const plugin = await loadPlugin(join(pluginDir, "index.ts"), ctx);

		console.log("Plugin loaded: " + pluginPath);
		const adapter = ctx.adapter.getAdapter();
		vql.dbInstances[pluginName] = adapter;
		vql.relation.dbs[pluginName] = adapter;
		loadedPlugins.set(pluginName, plugin);
	}
}
