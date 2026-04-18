import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { app, vql } from "./var";
import { loadPlugins } from "./plugin";
import { FF_VQL } from "@wxn0brp/vql";
import { getAdapterHTTP, getAdaptersHTTP } from "@wxn0brp/vql-dev";
import { createUnixSocket } from "./unix";
import { createVqlRouteHandler } from "@wxn0brp/vql/helpers/falconFrame";
import { getRawBody, parseLimit } from "@wxn0brp/falcon-frame/body-utils";


if (!process.env.AXR_AUTH) {
    console.error("AXR_AUTH not set");
    process.exit(1);
}

app.l(15397);
app.setOrigin("*");

app.use((req, res, next) => {
    const auth =
        req.headers["authorization"] ||
        req.body.authorization ||
        req.query.authorization ||
        req.body.auth ||
        req.query.auth ||
        req.query.a;

    if (auth !== process.env.AXR_AUTH) {
        res.status(401).json({ err: true, msg: "Unauthorized" });
        return;
    }
    next();
});

FF_VQL(app, vql);
app.get("/VQL", createVqlRouteHandler(vql, {
    getQuery: (req) => req.query.q as string
}));
app.customParser("/VQL/r", createVqlRouteHandler(vql, {
    getQuery: async (req, res) => await getRawBody(req, res, parseLimit("50m"))
}));

app.get("/VQL/get-adapter", getAdapterHTTP(vql));
app.get("/VQL/get-adapters", getAdaptersHTTP(vql));

const coreAdapter = new AdapterBuilder();

vql.dbInstances["core"] = coreAdapter.getAdapter();

if (process.platform !== "win32") {
    createUnixSocket();
}

await loadPlugins("./plugins");
await loadPlugins("./plugins-custom");
