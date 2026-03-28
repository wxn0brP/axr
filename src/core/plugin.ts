import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { $ } from "bun";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { copyPluginConfigs, loadPluginConfigs } from "./config";
import { PluginCtx } from "./types";
import { app, events, vql } from "./var";

const loadedPlugins = new Map<string, { dispose?: Function }>();

async function installPluginDependencies(pluginDir: string): Promise<void> {
    const packageJsonPath = join(pluginDir, "package.json");
    const nodeModulesPath = join(pluginDir, "node_modules");

    if (!existsSync(packageJsonPath))
        return;

    if (existsSync(nodeModulesPath))
        return;

    console.log(`Installing dependencies for plugin in ${pluginDir}...`);
    try {
        await $`cd ${pluginDir} && bun i --production -f`;
        console.log(`Plugin dependencies installed: ${pluginDir}`);
    } catch (error) {
        console.error(`Failed to install plugin dependencies in ${pluginDir}:`, error);
    }
}

export async function loadPlugin(dir: string, ctx: PluginCtx) {
    const plugin = await import(dir);
    plugin?.default(ctx);
    return plugin;
}

function createContext(): PluginCtx {
    return {
        event: events,
        app: app,
        query: vql.execute.bind(vql),
        vql: vql,
        adapter: new AdapterBuilder(),
        config: {},
    };
}

export async function loadPlugins(dir: string) {
    if (!existsSync(dir)) return console.warn("Plugins directory not found: " + dir);
    const entires = await readdir(dir, { withFileTypes: true });

    for (const entire of entires) {
        if (!entire.isDirectory()) continue;

        if (loadedPlugins.has(entire.name)) {
            const plugin = loadedPlugins.get(entire.name);
            await plugin?.dispose?.();
        }

        const pluginDir = join(process.cwd(), dir, entire.name);

        await installPluginDependencies(pluginDir);
        await copyPluginConfigs(pluginDir, entire.name);

        const ctx = createContext();
        ctx.config = await loadPluginConfigs(entire.name);

        const plugin = await loadPlugin(join(pluginDir, "index.ts"), ctx);

        console.log("Plugin loaded: " + entire.name);
        const adapter = ctx.adapter.getAdapter();
        vql.dbInstances[entire.name] = adapter;
        vql.relation.dbs[entire.name] = adapter;
        loadedPlugins.set(entire.name, plugin);
    }
}
