import VEE from "@wxn0brp/event-emitter";
import FalconFrame from "@wxn0brp/falcon-frame";
import VQLProcessor from "@wxn0brp/vql";
import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";

export type PanelFieldType = "string" | "number" | "boolean" | "text" | "json" | "select";

export interface PanelField {
    name: string;
    type: PanelFieldType;
    label?: string;
    required?: boolean;
    default?: any;
    placeholder?: string;
    options?: Array<string | { label: string; value: string }>;
    multiple?: boolean;
    custom?: boolean | {
        label?: string;
        placeholder?: string;
    };
    target?: "data" | "search" | "updater";
}

export interface PanelEndpoint {
    name: string;
    label?: string;
    description?: string;
    operation?: "add" | "find" | "findOne" | "update" | "updateOne" | "remove" | "removeOne" | "updateOneOrAdd" | "toggleOne";
    collection?: string;
    fields?: PanelField[];
}

export interface PanelAdapter {
    name: string;
    label?: string;
    description?: string;
    endpoints: PanelEndpoint[];
}

export interface PanelCtx {
    register(adapter: Omit<PanelAdapter, "name"> | PanelEndpoint | PanelEndpoint[]): void;
}

export interface PluginCtx {
    event: VEE;
    adapter: AdapterBuilder;
    app: FalconFrame;
    query: VQLProcessor["execute"];
    vql: VQLProcessor;
    config: Record<string, any> | null;
    panel: PanelCtx;
}

export type Plugin = (ctx: PluginCtx) => void | Promise<void>;
