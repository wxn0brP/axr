import { getRawBody, parseLimit } from "@wxn0brp/falcon-frame/body-utils";
import { FF_VQL } from "@wxn0brp/vql";
import { getAdapterHTTP, getAdaptersHTTP } from "@wxn0brp/vql-dev";
import { AdapterBuilder } from "@wxn0brp/vql/helpers/apiAbstract";
import { createVqlRouteHandler } from "@wxn0brp/vql/helpers/falconFrame";
import { getPanelAdapters } from "./panel";
import { loadPlugins } from "./plugin";
import { createUnixSocket } from "./unix";
import { app, vql } from "./var";

if (!process.env.AXR_AUTH) {
    console.error("AXR_AUTH not set");
    process.exit(1);
}

app.l(15397);
app.setOrigin("*");
app.static("public");

app.post("/panel/logout", (_req, res) => {
    res.cookie("AXR_TOKEN", "", {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        maxAge: -1,
    });
    res.json({ err: false });
});

app.post("/panel/login", (req, res) => {
    const token = req.body?.token || req.body?.AXR_TOKEN || req.query?.token;
    if (token !== process.env.AXR_AUTH) {
        res.status(401).json({ err: true, msg: "Unauthorized" });
        return;
    }
    res.cookie("AXR_TOKEN", token, {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        maxAge: 60 * 60, // 1 hour
    });
    res.json({ err: false });
});

app.use((req, res, next) => {
    const auth =
        req.headers["authorization"] ||
        req.cookies?.["AXR_TOKEN"] ||
        req.body?.authorization ||
        req.query?.authorization ||
        req.body?.auth ||
        req.query?.auth ||
        req.query?.a;

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

app.get("/panel/list", (_req, res) => {
    res.json({ err: false, adapters: getPanelAdapters() });
});

const coreAdapter = new AdapterBuilder();

vql.dbInstances["core"] = coreAdapter.getAdapter();

if (process.platform !== "win32") {
    createUnixSocket();
}

await loadPlugins("./plugins");
await loadPlugins("./plugins-custom");
