import { PluginCtx } from "#core/types";
import { $ } from "bun";

async function gen(model: string, text: string, target: string) {
    await $`piper -m ${model} -f ${target} ${text}`;
}

async function play(target: string) {
    await $`mpv ${target}`;
}

export default (ctx: PluginCtx) => {
    const { config } = ctx;

    ctx.adapter.add("gen", async (query) => {
        const model = query.data.model || config.model;
        if (!model) return { err: true, msg: "Piper model not set" };

        const text = query.data.text;
        const target = query.data.target || config.target;

        await gen(model, text, target);

        if (query.data.play)
            await play(target);

        return { ok: true, msg: "Piper generated", target };
    });

    ctx.adapter.findOne("play", async (query) => {
        const target = query.search["target"] || config.target;
        await play(target);
        return { ok: true, msg: "Piper played" };
    });
}
