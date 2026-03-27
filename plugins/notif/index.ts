import { PluginCtx } from "#core/types";

export default (ctx: PluginCtx) => {
    ctx.adapter.add("send", async (query) => {
        const host = process.env.AXR_NOTIF_HOST || "localhost:23456";
        const url = new URL(`http://${host}/send`);
        url.searchParams.set("secret", process.env.AXR_NOTIF_SECRET || "");
        url.searchParams.set("title", query.data.title);
        url.searchParams.set("body", query.data.body);

        const res = await fetch(url);
        if (!res.ok) return { err: true, msg: "Failed to send notification" };
        return await res.json();
    });
}
