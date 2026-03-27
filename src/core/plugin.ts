import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PluginCtx } from "./types";
import { app, events, vql } from "./var";

const loadedPlugins = new Map<string, { dispose?: Function }>();

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

        const ctx = createContext();
        const plugin = await loadPlugin(join(process.cwd(), dir, entire.name, "index.ts"), ctx);

        console.log("Plugin loaded: " + entire.name);
        const adapter = ctx.adapter.getAdapter();
        vql.dbInstances[entire.name] = adapter;
        vql.relation.dbs[entire.name] = adapter;
        loadedPlugins.set(entire.name, plugin);
    }
}
