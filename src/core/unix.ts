import net from "net";
import { vql } from "./var";

export function createUnixSocket() {
    const socketPath = process.env.AXR_SOCKET || "/tmp/axr.sock";

    const server = net.createServer((socket => {
        socket.on("data", async (raw) => {
            const dataString = raw.toString().trim();
            const data = dataString.startsWith("{") ? JSON.parse(dataString) : dataString;
            const res = await vql.execute(data);
            socket.write(JSON.stringify(res));
            socket.end();
        })
    }));

    server.listen(socketPath);

    server.on("listening", () => {
        console.log(`UNIX Server listening on ${socketPath}`);
    });

    server.on("error", (err) => {
        console.error(`UNIX Server error: ${err.message}`);
    });

    server.on("close", () => {
        console.log("UNIX Server closed");
    });

    return server;
}
