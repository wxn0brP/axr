import { PluginCtx } from "#core/types";
import admin from "firebase-admin";
import { Message } from "firebase-admin/messaging";
import fs from "fs";
import { join } from "node:path";

let initialized = false;

export async function firebaseSend(title: string, body: string, token: string) {
	if (!initialized) return console.error("Firebase not initialized");

	try {
		const message: Message = {
			data: {
				title,
				body,
			},
			token,
			android: {
				priority: "high",
			},
		};
		admin.messaging().send(message);
	} catch (e) {
		console.log("Firebase error: ", e.message);
	}
}

export default (ctx: PluginCtx) => {
	const path = join(ctx.configDir(), "firebase.json");
	try {
		if (!initialized) {
			if (fs.existsSync(path)) {
				const serviceAccount = JSON.parse(fs.readFileSync(path, "utf8"));
				admin.initializeApp({
					credential: admin.credential.cert(serviceAccount),
				});
				initialized = true;
			} else {
				console.error("Firebase service account not found");
				return;
			}
		} else {
			console.log("Firebase already initialized");
		}
	} catch (e) {
		console.error("Firebase not initialized");
		console.error(e);
		return;
	}

	const clientOptions = Object.keys(ctx.config?.clients || {}).map(id => ({
		label: id,
		value: id,
	}));

	ctx.panel.register({
		label: "Notifications",
		description: "Send notifications through configured channels.",
		endpoints: [
			{
				name: "send",
				label: "Firebase send",
				description:
					"Send a notification to one client, a client list, or everyone.",
				operation: "add",
				collection: "send",
				fields: [
					{
						name: "t",
						type: "string",
						label: "Title",
					},
					{
						name: "b",
						type: "text",
						label: "Body",
					},
					{
						name: "m",
						type: "string",
						label: "Module",
					},
					{
						name: "to",
						type: "select",
						label: "Recipients",
						placeholder: "all or id1,id2",
						multiple: true,
						options: [
							{
								label: "All",
								value: "all",
							},
							...clientOptions,
						],
						custom: {
							label: "Custom",
							placeholder: "all or id1,id2",
						},
					},
				],
			},
			{
				name: "r_send",
				label: "Remote send",
				description:
					"Send a notification through the remote endpoint from plugin config.",
				operation: "add",
				collection: "r_send",
				fields: [
					{
						name: "t",
						type: "string",
						label: "Title",
					},
					{
						name: "b",
						type: "text",
						label: "Body",
					},
					{
						name: "m",
						type: "string",
						label: "Module",
					},
				],
			},
		],
	});

	ctx.adapter.add("r_send", async query => {
		const data = query.data as {
			title?: string;
			body?: string;
			t?: string;
			b?: string;
			m?: string;
		};

		let title: string;
		let body: string;

		// New format: t, b, m all required
		if (data.t !== undefined || data.b !== undefined || data.m !== undefined) {
			if (!data.t || !data.b || !data.m)
				return {
					err: true,
					msg: "Missing required fields: t, b, m",
				};
			title = `[${data.m}] ${data.t}`;
			body = data.b;
		} else {
			// Old format: title, body
			if (!data.title || !data.body)
				return {
					err: true,
					msg: "Missing required fields: title, body",
				};
			title = data.title;
			body = data.body;
		}

		const { host, secret } = ctx.config || {};
		const url = new URL(`http://${host}/send`);
		url.searchParams.set("secret", secret || "");
		url.searchParams.set("title", title);
		url.searchParams.set("body", body);

		const res = await fetch(url);
		if (!res.ok)
			return {
				err: true,
				msg: "Failed to send notification",
			};
		return await res.json();
	});

	ctx.adapter.add("send", async query => {
		if (!initialized)
			return {
				err: true,
				msg: "Firebase not initialized",
			};

		const data = query.data as {
			title?: string;
			body?: string;
			t?: string;
			b?: string;
			m?: string;
			to?: string;
		};

		let title: string;
		let body: string;
		const to = data.to || ctx.config.default_to || "all";

		if (data.title !== undefined || data.body !== undefined) {
			if (!data.title || !data.body)
				return {
					err: true,
					msg: "Missing required fields: title, body",
				};
			title = data.title;
			body = data.body;
		} else {
			if (!data.t || !data.b || !data.m)
				return {
					err: true,
					msg: "Missing required fields: t, b, m",
				};
			title = `[${data.m}] ${data.t}`;
			body = data.b;
		}

		if (!to)
			return {
				err: true,
				msg: "Missing required field: to",
			};

		const toSend: string[] =
			to === "all" ? Object.keys(ctx.config.clients) : to.split(",");
		if (toSend.length === 0)
			return {
				err: true,
				msg: "Invalid recipient",
			};

		for (const id of toSend) {
			const token = ctx.config.clients[id];
			if (!token) continue;

			await firebaseSend(title, body, token);
			console.log("[notif] Notification sent to:", id);
		}

		return {
			err: false,
			msg: "Notification sent",
		};
	});
};
