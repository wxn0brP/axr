import { PluginCtx } from "#core/types";
import { YAML } from "bun";
import { existsSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface Task {
	id: string;
	time: string;
	title: string;
	body: string;
	to?: string;
	enabled?: boolean;
	sent?: boolean;
}

interface TasksFile {
	tasks: Task[];
}

let TASKS_FILE: string;
const timers = new Map<string, NodeJS.Timeout>();

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function readTasks(): Promise<TasksFile> {
	if (!existsSync(TASKS_FILE)) {
		return {
			tasks: [],
		};
	}
	try {
		const data = await readFile(TASKS_FILE, "utf-8");
		const parsed = YAML.parse(data) as any;
		if (!parsed || !parsed.tasks) {
			return {
				tasks: [],
			};
		}
		return parsed as TasksFile;
	} catch (error) {
		console.error("[scheduler] Failed to read tasks file:", error);
		return {
			tasks: [],
		};
	}
}

function writeTasks(data: TasksFile): void {
	try {
		writeFileSync(TASKS_FILE, YAML.stringify(data));
	} catch (error) {
		console.error("[scheduler] Failed to write tasks file:", error);
	}
}

function scheduleTask(ctx: PluginCtx, task: Task): void {
	if (!task.enabled || task.sent) return;

	const targetTime = new Date(task.time).getTime();
	const now = Date.now();
	const delay = targetTime - now;

	if (delay <= 0) {
		console.log(`[scheduler] Task ${task.id} is in the past, skipping`);
		return;
	}

	const timer = setTimeout(async () => {
		console.log(`[scheduler] Executing task ${task.id}`);

		const tasksData = await readTasks();
		const taskIndex = tasksData.tasks.findIndex(t => t.id === task.id);
		if (taskIndex === -1) {
			timers.delete(task.id);
			return;
		}

		const currentTask = tasksData.tasks[taskIndex];
		if (!currentTask.enabled || currentTask.sent) {
			timers.delete(task.id);
			return;
		}

		try {
			const result = await ctx.query({
				db: "notif",
				d: {
					add: {
						collection: "send",
						data: {
							title: currentTask.title,
							body: currentTask.body,
							to: currentTask.to || ctx.config?.default_to || "all",
						},
					},
				},
			});

			if (result && !("err" in result && result.err)) {
				tasksData.tasks.splice(taskIndex, 1);
				writeTasks(tasksData);
				console.log(`[scheduler] Task ${task.id} sent and removed`);
			} else {
				console.error(`[scheduler] Failed to send task ${task.id}:`, result);
			}
		} catch (error) {
			console.error(`[scheduler] Error executing task ${task.id}:`, error);
		}

		timers.delete(task.id);
	}, delay);

	timers.set(task.id, timer);
	console.log(`[scheduler] Scheduled task ${task.id} for ${task.time}`);
}

export function dispose() {
	for (const [, timer] of timers) {
		clearTimeout(timer);
	}
	timers.clear();
	console.log("[scheduler] All timers cleared");
}

export default async (ctx: PluginCtx) => {
	TASKS_FILE = join(ctx.configDir(), "tasks.yml");
	const tasksData = await readTasks();
	for (const task of tasksData.tasks) {
		if (!task.sent && task.enabled !== false) {
			task.enabled = true;
			scheduleTask(ctx, task);
		}
	}

	ctx.adapter.add("tasks", async query => {
		const { time, title, body, to } = query.data;

		if (!time || !title || !body) {
			return {
				err: true,
				msg: "Missing required fields: time, title, body",
			};
		}

		const parsedTime = new Date(time);
		if (Number.isNaN(parsedTime.getTime())) {
			return {
				err: true,
				msg: "Invalid time format",
			};
		}

		if (parsedTime.getTime() <= Date.now()) {
			return {
				err: true,
				msg: "Time must be in the future",
			};
		}

		const tasksData = await readTasks();
		const newTask: Task = {
			id: generateId(),
			time,
			title,
			body,
			to: to || ctx.config?.default_to || "all",
			enabled: true,
			sent: false,
		};

		tasksData.tasks.push(newTask);
		writeTasks(tasksData);
		scheduleTask(ctx, newTask);

		return {
			ok: true,
			data: newTask,
		};
	});

	ctx.adapter.find("tasks", async () => {
		const tasksData = await readTasks();
		return tasksData.tasks;
	});

	ctx.adapter.findOne("tasks", async query => {
		const tasksData = await readTasks();
		const task = tasksData.tasks.find(t => t.id === query.search.id);

		if (!task) {
			return {
				err: true,
				msg: "Task not found",
			};
		}

		return {
			ok: true,
			data: task,
		};
	});

	ctx.adapter.remove("tasks", async query => {
		const tasksData = await readTasks();
		const taskIndex = tasksData.tasks.findIndex(t => t.id === query.search.id);

		if (taskIndex === -1) {
			return {
				err: true,
				msg: "Task not found",
			};
		}

		const removed = tasksData.tasks.splice(taskIndex, 1)[0];
		writeTasks(tasksData);

		const timer = timers.get(removed.id);
		if (timer) {
			clearTimeout(timer);
			timers.delete(removed.id);
		}

		return {
			ok: true,
			data: removed,
		};
	});

	ctx.adapter.updateOne("tasks", async query => {
		const tasksData = await readTasks();
		const taskIndex = tasksData.tasks.findIndex(t => t.id === query.search.id);

		if (taskIndex === -1) {
			return {
				err: true,
				msg: "Task not found",
			};
		}

		const task = tasksData.tasks[taskIndex];
		const updates = query.updater as any;

		if (updates.time) {
			const parsedTime = new Date(updates.time);
			if (Number.isNaN(parsedTime.getTime())) {
				return {
					err: true,
					msg: "Invalid time format",
				};
			}
			task.time = updates.time;
		}
		if (updates.title) task.title = updates.title;
		if (updates.body) task.body = updates.body;
		if (updates.to) task.to = updates.to;
		if (updates.enabled !== undefined) task.enabled = updates.enabled;

		tasksData.tasks[taskIndex] = task;
		writeTasks(tasksData);

		const timer = timers.get(task.id);
		if (timer) {
			clearTimeout(timer);
			timers.delete(task.id);
		}
		if (task.enabled && !task.sent) {
			scheduleTask(ctx, task);
		}

		return {
			ok: true,
			data: task,
		};
	});

	ctx.panel.register({
		label: "Scheduler",
		description: "Schedule notifications to be sent at specific times.",
		endpoints: [
			{
				name: "list_tasks",
				label: "List Tasks",
				description: "View all scheduled tasks.",
				operation: "find",
				collection: "tasks",
				fields: [],
			},
			{
				name: "add_task",
				label: "Add Task",
				description: "Schedule a notification to be sent at a specific time.",
				operation: "add",
				collection: "tasks",
				fields: [
					{
						name: "time",
						type: "datetime",
						label: "Time",
						required: true,
					},
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
						type: "string",
						label: "To (all or client IDs)",
						placeholder: "all",
					},
				],
			},
			{
				name: "remove_task",
				label: "Remove Task",
				description: "Remove a scheduled task.",
				operation: "remove",
				collection: "tasks",
				fields: [
					{
						name: "id",
						type: "string",
						label: "Task ID",
						required: true,
					},
				],
			},
		],
	});
};
