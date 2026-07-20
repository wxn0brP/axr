import { PluginCtx } from "#core/types";
import admin from "firebase-admin";
import { Message } from "firebase-admin/messaging";
import fs from "fs";

let initialized = false;

try {
	const path = "config/notif/firebase.json";
	if (fs.existsSync(path)) {
		const serviceAccount = JSON.parse(
			fs.readFileSync("config/notif/firebase.json", "utf8"),
		);
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});
		initialized = true;
	} else {
		console.error("Firebase service account not found");
	}
} catch (e) {
	console.error(e);
}

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
						name: "title",
						type: "string",
						label: "Title",
						required: true,
					},
					{
						name: "body",
						type: "text",

						label: "Body",
						required: true,
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
						name: "title",
						type: "string",
						label: "Title",
						required: true,
					},
					{
						name: "body",
						type: "text",
						label: "Body",
						required: true,
					},
				],
			},
		],
	});

	ctx.adapter.add("r_send", async query => {
		const { host, secret } = ctx.config || {};
		const url = new URL(`http://${host}/send`);
		url.searchParams.set("secret", secret || "");
		url.searchParams.set("title", query.data.title);
		url.searchParams.set("body", query.data.body);

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

		let { title, body, to } = query.data as {
			title: string;
			body: string;
			to: string;
		};
		to = to || ctx.config.default_to || "all";

		if (!title || !body || !to)
			return {
				err: true,
				msg: "Missing required fields",
			};

		const toSend =
			to === "all" ? Object.keys(ctx.config.clients) : to.split(",");
		if (toSend.length === 0)
			return {
				err: true,
				msg: "Invalid recipient",
			};

		const tokens = toSend.map(id => [
			id,
			ctx.config.clients[id],
		]);
		for (const [id, token] of tokens) {
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
