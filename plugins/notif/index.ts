import { PluginCtx } from "#core/types";

export default (ctx: PluginCtx) => {
    ctx.adapter.add("send", async (query) => {
        const { host, secret } = ctx.config || {};
        const url = new URL(`http://${host}/send`);
        url.searchParams.set("secret", secret || "");
        url.searchParams.set("title", query.data.title);
        url.searchParams.set("body", query.data.body);

        const res = await fetch(url);
        if (!res.ok) return { err: true, msg: "Failed to send notification" };
        return await res.json();
    });
}
