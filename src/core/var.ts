import VEE from "@wxn0brp/event-emitter";
import FalconFrame from "@wxn0brp/falcon-frame";
import VQLProcessor from "@wxn0brp/vql";

export const events = new VEE();
export const app = new FalconFrame();
export const vql = new VQLProcessor({});
