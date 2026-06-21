const state = { adapters: [], selected: null };
const loginView = document.querySelector("#login");
const appView = document.querySelector("#app");
const adapterList = document.querySelector("#adapter-list");
const content = document.querySelector("#content");
const loginError = document.querySelector("#login-error");

function showLogin(message = "") {
    loginError.textContent = message;
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
}

function showApp() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
}

function fieldTarget(endpoint, field) {
    if (field.target) return field.target;
    if (endpoint.operation === "find" || endpoint.operation === "findOne" || endpoint.operation?.startsWith("remove")) return "search";
    if (endpoint.operation?.startsWith("update")) return "updater";
    return "data";
}

function literal(value, type) {
    if (type === "json") return value || "{}";
    if (type === "number") return value === "" ? "0" : String(Number(value));
    if (type === "boolean") return value ? "true" : "false";
    return JSON.stringify(value);
}

function readFieldValue(field, form) {
    const input = form.elements[field.name];
    if (!input) return undefined;
    if (field.type === "boolean") return input.checked;
    if (field.type === "select") {
        const customInput = form.elements[field.name + "__custom"];
        if (field.multiple) {
            const values = [...input.selectedOptions].map((option) => option.value);
            if (values.includes("__custom__")) return customInput?.value || "";
            if (values.includes("all")) return "all";
            return values.filter(Boolean).join(",");
        }
        if (input.value === "__custom__") return customInput?.value || "";
    }
    return input.value;
}

function buildVql(adapter, endpoint, form) {
    const lines = [adapter.name + " " + (endpoint.operation || "add") + " " + (endpoint.collection || endpoint.name)];
    for (const field of endpoint.fields || []) {
        const value = readFieldValue(field, form);
        if (value === undefined) continue;
        if ((value === "" || value === false) && !field.required) continue;
        const target = fieldTarget(endpoint, field);
        const alias = target === "search" ? "s" : target === "updater" ? "u" : "d";
        lines.push(alias + "." + field.name + " = " + literal(value, field.type));
    }
    return lines.join("\n");
}

function renderField(field) {
    const id = "field-" + field.name + "-" + Math.random().toString(36).slice(2);
    const label = field.label || field.name;
    const required = field.required ? " required" : "";
    const placeholder = field.placeholder ? " placeholder=\"" + escapeHtml(field.placeholder) + "\"" : "";
    const value = field.default !== undefined ? " value=\"" + escapeHtml(String(field.default)) + "\"" : "";

    if (field.type === "boolean") {
        return "<label class=\"checkbox\"><input id=\"" + id + "\" name=\"" + escapeHtml(field.name) + "\" type=\"checkbox\"" + (field.default ? " checked" : "") + "> " + escapeHtml(label) + "</label>";
    }
    if (field.type === "text" || field.type === "json") {
        const text = field.default !== undefined ? escapeHtml(typeof field.default === "string" ? field.default : JSON.stringify(field.default, null, 2)) : "";
        return "<label for=\"" + id + "\">" + escapeHtml(label) + "<textarea id=\"" + id + "\" name=\"" + escapeHtml(field.name) + "\"" + required + placeholder + ">" + text + "</textarea></label>";
    }
    if (field.type === "select") {
        const options = (field.options || []).map((option) => {
            const item = typeof option === "string" ? { label: option, value: option } : option;
            const selected = item.value === field.default ? " selected" : "";
            return "<option value=\"" + escapeHtml(item.value) + "\"" + selected + ">" + escapeHtml(item.label) + "</option>";
        }).join("");
        const custom = field.custom ? (typeof field.custom === "object" ? field.custom : {}) : null;
        const customOption = custom ? "<option value=\"__custom__\">" + escapeHtml(custom.label || "Custom") + "</option>" : "";
        const customInput = custom ? "<input class=\"custom-input hidden\" name=\"" + escapeHtml(field.name) + "__custom\" type=\"text\" placeholder=\"" + escapeHtml(custom.placeholder || field.placeholder || "") + "\">" : "";
        const multiple = field.multiple ? " multiple" : "";
        return "<label for=\"" + id + "\">" + escapeHtml(label) + "<select id=\"" + id + "\" name=\"" + escapeHtml(field.name) + "\"" + required + multiple + ">" + options + customOption + "</select>" + customInput + "</label>";
    }
    return "<label for=\"" + id + "\">" + escapeHtml(label) + "<input id=\"" + id + "\" name=\"" + escapeHtml(field.name) + "\" type=\"" + (field.type === "number" ? "number" : "text") + "\"" + required + placeholder + value + "></label>";
}

function syncCustomInputs(root = content) {
    root.querySelectorAll("select").forEach((select) => {
        const customInput = select.parentElement.querySelector("[name=\"" + CSS.escape(select.name + "__custom") + "\"]");
        if (!customInput) return;
        const values = [...select.selectedOptions].map((option) => option.value);
        customInput.classList.toggle("hidden", !values.includes("__custom__"));
    });
}

function renderAdapters() {
    adapterList.innerHTML = state.adapters.map((adapter) => {
        const active = state.selected?.name === adapter.name ? " active" : "";
        return "<button class=\"adapter-button" + active + "\" type=\"button\" data-adapter=\"" + escapeHtml(adapter.name) + "\"><strong>" + escapeHtml(adapter.label || adapter.name) + "</strong><br><span class=\"muted\">" + escapeHtml(adapter.description || adapter.name) + "</span></button>";
    }).join("");
}

function renderContent() {
    const adapter = state.selected;
    if (!adapter) {
        content.innerHTML = "<div class=\"card\"><h2>No adapters</h2><p class=\"muted\">Plugins can add forms with ctx.panel.register().</p></div>";
        return;
    }
    content.innerHTML = "<div><h2>" + escapeHtml(adapter.label || adapter.name) + "</h2><p class=\"muted\">" + escapeHtml(adapter.description || "") + "</p></div>" +
        (adapter.endpoints || []).map((endpoint, index) => {
            return "<section class=\"card\"><div class=\"endpoint-head\"><div><h3>" + escapeHtml(endpoint.label || endpoint.name) + "</h3><p class=\"muted\">" + escapeHtml(endpoint.description || "") + "</p></div><code>" + escapeHtml(endpoint.operation || "add") + " " + escapeHtml(endpoint.collection || endpoint.name) + "</code></div><form data-endpoint=\"" + index + "\">" + (endpoint.fields || []).map(renderField).join("") + "<div class=\"actions\"><button type=\"button\" data-preview>VQL</button><button class=\"primary\" type=\"submit\">Send</button></div><pre class=\"hidden\"></pre></form></section>";
        }).join("");
    syncCustomInputs();
}

async function loadAdapters() {
    const response = await fetch("/panel/list", { credentials: "same-origin" });
    if (response.status === 401) {
        showLogin();
        return;
    }
    const data = await response.json();
    state.adapters = data.adapters || [];
    state.selected = state.adapters[0] || null;
    renderAdapters();
    renderContent();
    showApp();
}

async function submitVql(vql, pre) {
    pre.classList.remove("hidden");
    pre.textContent = vql + "\n\n...";
    const response = await fetch("/VQL/r", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "text/plain" },
        body: vql,
    });
    const data = await response.json();
    pre.textContent = vql + "\n\n" + JSON.stringify(data, null, 2);
    if (response.status === 401) showLogin("Session expired or the token is invalid.");
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;",
    })[char]);
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");
    const response = await fetch("/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
    });
    if (!response.ok) {
        showLogin("Invalid AXR_TOKEN.");
        return;
    }
    await loadAdapters();
});

document.querySelector("#logout").addEventListener("click", async () => {
    await fetch("/panel/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
});

adapterList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-adapter]");
    if (!button) return;
    state.selected = state.adapters.find((adapter) => adapter.name === button.dataset.adapter);
    renderAdapters();
    renderContent();
});

content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview]");
    if (!button) return;
    const form = button.closest("form");
    const endpoint = state.selected.endpoints[Number(form.dataset.endpoint)];
    const pre = form.querySelector("pre");
    pre.classList.remove("hidden");
    pre.textContent = buildVql(state.selected, endpoint, form);
});

content.addEventListener("change", (event) => {
    if (event.target.matches("select")) syncCustomInputs(event.target.closest("form") || content);
});

content.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const endpoint = state.selected.endpoints[Number(form.dataset.endpoint)];
    await submitVql(buildVql(state.selected, endpoint, form), form.querySelector("pre"));
});

loadAdapters().catch((error) => showLogin(error.message));
