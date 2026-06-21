import { PluginCtx } from "#core/types";
import dgram from "dgram";

const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const broadcast = "255.255.255.255";
const port = 9;

function parseMac(mac: string): Buffer | null {
    if (!MAC_RE.test(mac)) return null;
    return Buffer.from(mac.replace(/[:-]/g, ""), "hex");
}

function createMagicPacket(mac: Buffer): Buffer {
    const magic = Buffer.alloc(6 + 16 * 6);
    magic.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i++) mac.copy(magic, 6 + i * 6);
    return magic;
}

async function wake(mac: string): Promise<string> {
    const macBuf = parseMac(mac);
    if (!macBuf) throw new Error(`Invalid MAC address: ${mac}`);

    const packet = createMagicPacket(macBuf);
    const socket = dgram.createSocket("udp4");
    socket.unref();

    return new Promise((resolve, reject) => {
        socket.on("error", (err) => {
            socket.close();
            reject(err);
        });

        socket.send(packet, 0, packet.length, port, broadcast, (err) => {
            socket.close();
            if (err) reject(err);
            else resolve(`Magic packet sent to ${mac} via ${broadcast}:${port}`);
        });
    });
}

export default (ctx: PluginCtx) => {
    const deviceOptions = Object.entries(ctx.config?.devices || {}).map(([id, device]: [string, any]) => ({
        label: device?.name ? `${device.name} (${id})` : id,
        value: id,
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
                        label: "Device name",
                        options: [
                            { label: "Manual MAC", value: "" },
                            ...deviceOptions,
                        ],
                    },
                    {
                        name: "mac",
                        type: "string",
                        label: "MAC",
                        placeholder: "AA:BB:CC:DD:EE:FF"
                    },
                ],
            },
        ],
    });

    ctx.adapter.add("send", async (query) => {
        const mac = query.data.mac || ctx.config?.devices?.[query.data.name]?.mac;

        if (!mac)
            return { err: true, msg: "MAC address or device name is required" };

        try {
            const msg = await wake(mac);
            return { ok: true, msg };
        } catch (e: any) {
            return { err: true, msg: e.message };
        }
    });
}
