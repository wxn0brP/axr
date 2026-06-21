import { PluginCtx } from "#core/types";

const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const DEFAULT_COMMAND = "wol %%";

function buildCommand(template: string, mac: string): string {
    return template.includes("%%")
        ? template.replaceAll("%%", mac)
        : `${template} ${mac}`;
}

async function wake(mac: string, commandTemplate = DEFAULT_COMMAND): Promise<string> {
    if (!MAC_RE.test(mac)) throw new Error(`Invalid MAC address: ${mac}`);

    const command = buildCommand(commandTemplate, mac);
    const proc = Bun.spawn(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);

    if (exitCode !== 0)
        throw new Error(stderr.trim() || `Wake command failed with exit code ${exitCode}`);

    return stdout.trim() || `Wake command executed: ${command}`;
}

export default (ctx: PluginCtx) => {
    function getDeviceMac(nameOrMac: string) {
        return ctx.config?.devices?.[nameOrMac] || nameOrMac;
    };

    const deviceOptions = Object.entries(ctx.config?.devices || {}).map(([name]) => ({
        label: name,
        value: name,
    }));

    ctx.panel.register({
        label: "Wake on LAN",
        description: "Send a Wake on LAN magic packet to a device.",
        endpoints: [
            {
                name: "send",
                label: "Wake device",
                description: "Enter a device name from config or a direct MAC address.",
                operation: "add",
                collection: "send",
                fields: [
                    {
                        name: "name",
                        type: "select",
                        label: "Device",
                        placeholder: "name or mac",
                        options: deviceOptions,
                        custom: {
                            label: "Custom",
                            placeholder: "MAC address",
                        },
                    },
                ],
            },
        ],
    });

    ctx.adapter.add("send", async (query) => {
        const mac = getDeviceMac(query.data.name || query.data.mac);

        if (!mac)
            return { err: true, msg: "MAC address or device name is required" };

        try {
            const msg = await wake(mac, ctx.config?.command || DEFAULT_COMMAND);
            return { ok: true, msg };
        } catch (e: any) {
            return { err: true, msg: e.message };
        }
    });
}
