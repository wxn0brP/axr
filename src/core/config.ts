import { YAML } from "bun";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_DIR = "config";

export async function loadPluginConfigs(pluginName: string): Promise<Record<string, any>> {
    const pluginConfigDir = join(CONFIG_DIR, pluginName);

    if (!existsSync(pluginConfigDir))
        return {};

    const configs: Record<string, any> = await loadPluginConfig(pluginName, "config.yml") || {};

    const files = await readdir(pluginConfigDir);
    for (const file of files) {
        if (!file.endsWith(".config.yml"))
            continue;

        const data = await loadPluginConfig(pluginName, file);
        configs[file.replace(".config.yml", "")] = data;
    }

    return configs;
}

export async function loadPluginConfig(pluginName: string, file: string) {
    const configPath = join(CONFIG_DIR, pluginName, file);
    if (!existsSync(configPath)) return null;

    const data = await readFile(configPath, "utf-8");
    return YAML.parse(data) as Record<string, any>;
}

export async function copyPluginConfigs(pluginDir: string, pluginName: string): Promise<void> {
    const sourceConfigDir = pluginDir;
    const targetConfigDir = join(CONFIG_DIR, pluginName);

    const files = await readdir(sourceConfigDir);
    const configFiles = files.filter(f =>
        f === "config.yml" ||
        f.endsWith(".config.yml")
    );

    if (configFiles.length === 0)
        return;

    if (!existsSync(targetConfigDir))
        mkdirSync(targetConfigDir, { recursive: true });

    for (const file of configFiles) {
        const targetPath = join(targetConfigDir, file);
        if (existsSync(targetPath))
            continue;

        const sourcePath = join(sourceConfigDir, file);
        copyFileSync(sourcePath, targetPath);
        console.log("Copied config file: " + targetPath);
    }
}
