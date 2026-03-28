import VEE from "@wxn0brp/event-emitter";
import FalconFrame from "@wxn0brp/falcon-frame";
import VQLProcessor from "@wxn0brp/vql";
import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";

export interface PluginCtx {
    event: VEE;
    adapter: AdapterBuilder;
    app: FalconFrame;
    query: VQLProcessor["execute"];
    vql: VQLProcessor;
    config: Record<string, any> | null;
}

export type Plugin = (ctx: PluginCtx) => void | Promise<void>;
