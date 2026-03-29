import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { app, vql } from "./var";
import { loadPlugins } from "./plugin";
import { FF_VQL } from "@wxn0brp/vql";
import { getAdapterHTTP, getAdaptersHTTP } from "@wxn0brp/vql-dev";
import { createUnixSocket } from "./unix";

app.l(15397);
app.setOrigin("*");

if (!process.env.AXR_AUTH) {
    console.error("AXR_AUTH not set");
    process.exit(1);
}

app.use((req, res, next) => {
    const auth =
        req.headers["authorization"] ||
        req.body.authorization ||
        req.query.authorization ||
        req.body.auth ||
        req.query.auth;

    if (auth !== process.env.AXR_AUTH) {
        res.status(401).json({ err: true, msg: "Unauthorized" });
        return;
    }
    next();
});

FF_VQL(app, vql);
app.get("/VQL", async (req, res) => {
    try {
        const query = req.query.q as string;
        const result = await vql.execute(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
app.get("/VQL/get-adapter", getAdapterHTTP(vql));
app.get("/VQL/get-adapters", getAdaptersHTTP(vql));

const coreAdapter = new AdapterBuilder();

vql.dbInstances["core"] = coreAdapter.getAdapter();

if (process.platform !== "win32") {
    createUnixSocket();
}

await loadPlugins("./plugins");
await loadPlugins("./plugins-custom");
