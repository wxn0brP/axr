import { PanelAdapter, PanelEndpoint } from "./types";

const adapters = new Map<string, PanelAdapter>();

function normalizeEndpoint(endpoint: PanelEndpoint): PanelEndpoint {
    return {
        operation: "add",
        collection: endpoint.name,
        fields: [],
        ...endpoint,
    };
}

export function createPanel(pluginName: string) {
    return {
        register(adapterOrEndpoints: Omit<PanelAdapter, "name"> | PanelEndpoint | PanelEndpoint[]) {
            const current = adapters.get(pluginName) || {
                name: pluginName,
                label: pluginName,
                endpoints: [],
            };

            if (Array.isArray(adapterOrEndpoints)) {
                current.endpoints.push(...adapterOrEndpoints.map(normalizeEndpoint));
                adapters.set(pluginName, current);
                return;
            }

            if ("endpoints" in adapterOrEndpoints) {
                adapters.set(pluginName, {
                    ...current,
                    ...adapterOrEndpoints,
                    name: pluginName,
                    endpoints: adapterOrEndpoints.endpoints.map(normalizeEndpoint),
                });
                return;
            }

            current.endpoints.push(normalizeEndpoint(adapterOrEndpoints));
            adapters.set(pluginName, current);
        },
    };
}

export function clearPanelAdapter(pluginName: string) {
    adapters.delete(pluginName);
}

export function getPanelAdapters() {
    return [...adapters.values()].sort((a, b) => a.name.localeCompare(b.name));
}
