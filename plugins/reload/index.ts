import { reloadAllPluginsAndConfig } from "#core/plugin";
import { PluginCtx } from "#core/types";

export default (ctx: PluginCtx) => {
	ctx.panel.register({
		label: "Reload",
		description: "Reload all plugins without restarting the application.",
		endpoints: [
			{
				name: "reload",
				label: "Reload plugins",
				description: "Dispose and re-load every plugin.",
				operation: "add",
				collection: "reload",
			},
		],
	});

	ctx.adapter.add("reload", async () => {
		try {
			await reloadAllPluginsAndConfig();
			return {
				ok: true,
				msg: "All plugins reloaded",
			};
		} catch (e: any) {
			return {
				err: true,
				msg: e.message,
			};
		}
	});
};
