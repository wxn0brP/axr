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

	ctx.panel.register({
		label: "Piper",
		description: "Generate and play speech with piper/mpv.",
		endpoints: [
			{
				name: "gen",
				label: "Generate",
				description: "Generate an audio file from text.",
				operation: "add",
				collection: "gen",
				fields: [
					{
						name: "text",
						type: "text",
						label: "Text",
						required: true,
					},
					{
						name: "model",
						type: "string",
						label: "Model",
						placeholder: config.model,
						default: config.model,
					},
					{
						name: "target",
						type: "string",
						label: "Target file",
						placeholder: config.target,
						default: config.target,
					},
					{
						name: "play",
						type: "boolean",
						label: "Play after generating",
						default: true,
					},
				],
			},
			{
				name: "play",
				label: "Play",
				description: "Play an existing audio file.",
				operation: "findOne",
				collection: "play",
				fields: [
					{
						name: "target",
						type: "string",
						label: "File",
						placeholder: String(config.target || ""),
						target: "search",
					},
				],
			},
		],
	});

	ctx.adapter.add("gen", async query => {
		const model = query.data.model || config.model;
		if (!model)
			return {
				err: true,
				msg: "Piper model not set",
			};

		const text = query.data.text;
		const target = query.data.target || config.target;

		await gen(model, text, target);

		if (query.data.play) await play(target);

		return {
			ok: true,
			msg: "Piper generated",
			target,
		};
	});

	ctx.adapter.findOne("play", async query => {
		const target = query.search["target"] || config.target;
		await play(target);
		return {
			ok: true,
			msg: "Piper played",
		};
	});
};
