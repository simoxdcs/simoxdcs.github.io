import Model from "./model.js";
import showMessage from "./message.js";
import randomSelection from "./utils.js";
import tools from "./tools.js";

let widgetApi;

function mergeConfig(base, patch) {
    const result = { ...base };
    for (const [key, value] of Object.entries(patch || {})) {
        result[key] = value && typeof value === "object" && !Array.isArray(value)
            ? mergeConfig(base?.[key] || {}, value)
            : value;
    }
    return result;
}

function applyRuntimeConfig(config) {
    const waifu = document.getElementById("waifu");
    const toggle = document.getElementById("waifu-toggle");
    if (!waifu) return;
    const layout = config.layout || {};
    const tips = config.tips || {};
    const behavior = config.behavior || {};
    const canvas = document.getElementById("live2d");
    const tipsElement = document.getElementById("waifu-tips");
    const tool = document.getElementById("waifu-tool");
    const side = layout.side === "left" ? "left" : "right";
    const otherSide = side === "left" ? "right" : "left";
    waifu.style[side] = `${layout.edgeOffset ?? 50}px`;
    waifu.style[otherSide] = "auto";
    waifu.style.marginBottom = `${layout.bottomOffset ?? 100}px`;
    waifu.style.zIndex = String(layout.zIndex ?? 1000);
    waifu.style.opacity = String(layout.opacity ?? 1);
    if (canvas) {
        canvas.style.width = `${layout.width ?? 250}px`;
        canvas.style.height = `${layout.height ?? 250}px`;
    }
    if (tipsElement) {
        tipsElement.style.display = tips.enabled === false ? "none" : "block";
        tipsElement.style.width = `${tips.width ?? 200}px`;
        tipsElement.style.minHeight = `${tips.minHeight ?? 70}px`;
        tipsElement.style.fontSize = `${tips.fontSize ?? 14}px`;
        tipsElement.style.lineHeight = `${tips.lineHeight ?? 24}px`;
        tipsElement.style.background = tips.background || "rgba(236, 217, 188, .72)";
        tipsElement.style.color = tips.color || "#3f3a35";
        tipsElement.style.borderColor = tips.borderColor || "rgba(224, 186, 140, .72)";
    }
    if (tool) {
        tool.style[side] = "-4px";
        tool.style[otherSide] = "auto";
        const enabledTools = new Set(Array.isArray(config.tools) ? config.tools : Object.keys(tools));
        for (const item of tool.children) item.style.display = enabledTools.has(item.id.replace("waifu-tool-", "")) ? "grid" : "none";
    }
    if (toggle) {
        toggle.style[side] = "0";
        toggle.style[otherSide] = "auto";
    }
    waifu.classList.toggle("waifu-no-lift", behavior.hoverLift === false);
}

function setupDragging(getConfig) {
    const waifu = document.getElementById("waifu");
    const handle = document.getElementById("waifu-tips");
    if (!waifu || !handle || handle.dataset.dragReady) return;
    handle.dataset.dragReady = "true";
    let drag;
    handle.addEventListener("pointerdown", event => {
        const config = getConfig();
        if (!config.behavior?.draggable) return;
        const rect = waifu.getBoundingClientRect();
        drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener("pointermove", event => {
        if (!drag) return;
        const config = getConfig();
        const axis = config.behavior?.dragAxis || "x";
        const nextLeft = drag.left + event.clientX - drag.x;
        const nextTop = drag.top + event.clientY - drag.y;
        waifu.style.left = `${Math.max(0, Math.min(window.innerWidth - waifu.offsetWidth, nextLeft))}px`;
        waifu.style.right = "auto";
        if (axis === "both") {
            waifu.style.bottom = "auto";
            waifu.style.marginBottom = "0";
            waifu.style.top = `${Math.max(0, Math.min(window.innerHeight - waifu.offsetHeight, nextTop))}px`;
        }
    });
    const finish = () => {
        if (!drag) return;
        const config = getConfig();
        drag = null;
        if (config.behavior?.dragRevert) {
            waifu.style.top = "auto";
            waifu.style.bottom = "0";
            applyRuntimeConfig(config);
        }
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
}

function loadWidget(initialConfig) {
    const model = new Model(initialConfig);
    let config = initialConfig;
    sessionStorage.removeItem("waifu-text");
    document.body.insertAdjacentHTML("beforeend", `<div id="waifu">
            <div id="waifu-tips"></div>
            <canvas id="live2d" width="800" height="800"></canvas>
            <div id="waifu-tool"></div>
        </div>`);
    applyRuntimeConfig(config);
    setTimeout(() => { document.getElementById("waifu").style.bottom = 0; }, 0);

    tools["switch-model"].callback = () => model.loadOtherModel();
    tools["switch-texture"].callback = () => model.loadOtherTexture();
    tools.info.callback = () => open(config.infoUrl || "https://github.com/stevenjoezhang/live2d-widget", "_blank", "noopener");
    tools.quit.callback = () => {
        const hours = Number(config.behavior?.hideHours) || 24;
        localStorage.setItem("waifu-display", Date.now());
        localStorage.setItem("waifu-hide-hours", hours);
        showMessage("下次再见。", 1500, 11);
        document.getElementById("waifu").style.bottom = "-500px";
        setTimeout(() => {
            document.getElementById("waifu").style.display = "none";
            document.getElementById("waifu-toggle").classList.add("waifu-toggle-active");
        }, 1700);
    };
    const enabledTools = Array.isArray(config.tools) ? config.tools : Object.keys(tools);
    for (const tool of enabledTools) {
        if (!tools[tool]) continue;
        const { icon, callback } = tools[tool];
        document.getElementById("waifu-tool").insertAdjacentHTML("beforeend", `<span id="waifu-tool-${tool}" title="${tool}">${icon}</span>`);
        document.getElementById(`waifu-tool-${tool}`).addEventListener("click", callback);
    }

    function welcomeMessage(time) {
        if (location.pathname === "/") {
            for (const item of time || []) {
                const [after, before = after] = item.hour.split("-").map(Number);
                const hour = new Date().getHours();
                if (after <= hour && hour <= before) return item.text;
            }
        }
        return `欢迎阅读<span>「${document.title.split(" - ")[0]}」</span>`;
    }

    function safeClosest(target, selector) {
        try { return target instanceof Element ? target.closest(selector) : null; }
        catch { return null; }
    }

    function registerEventListener(result) {
        if (config.tips?.enabled === false) return;
        let userAction = false;
        let idleTimer;
        let lastHoverElement;
        const messages = result.message?.default || [];
        window.addEventListener("mousemove", () => { userAction = true; }, { passive: true });
        window.addEventListener("keydown", () => { userAction = true; }, { passive: true });
        const idleInterval = Math.max(5000, Number(config.tips?.idleInterval) || 20000);
        setInterval(() => {
            if (userAction) {
                userAction = false;
                clearInterval(idleTimer);
                idleTimer = null;
            } else if (!idleTimer) {
                idleTimer = setInterval(() => showMessage(messages, 6000, 9), idleInterval);
            }
        }, 1000);
        showMessage(welcomeMessage(result.time), Number(config.tips?.welcomeDuration) || 7000, 11);
        window.addEventListener("mouseover", event => {
            for (const item of result.mouseover || []) {
                const matched = safeClosest(event.target, item.selector);
                if (!matched || lastHoverElement === item.selector) continue;
                lastHoverElement = item.selector;
                showMessage(randomSelection(item.text).replace("{text}", matched.innerText || ""), 4000, 8);
                return;
            }
        });
        window.addEventListener("click", event => {
            for (const item of result.click || []) {
                const matched = safeClosest(event.target, item.selector);
                if (!matched) continue;
                showMessage(randomSelection(item.text).replace("{text}", matched.innerText || ""), 4000, 8);
                return;
            }
        });
        window.addEventListener("copy", () => showMessage(result.message?.copy, 6000, 9));
        window.addEventListener("visibilitychange", () => {
            if (!document.hidden) showMessage(result.message?.visibilitychange, 6000, 9);
        });
        for (const item of result.seasons || []) {
            const now = new Date();
            const [after, before = after] = item.date.split("-");
            const current = (now.getMonth() + 1) * 100 + now.getDate();
            const parseDate = value => Number(value.split("/")[0]) * 100 + Number(value.split("/")[1]);
            if (parseDate(after) <= current && current <= parseDate(before)) messages.push(randomSelection(item.text).replace("{year}", now.getFullYear()));
        }
    }

    const savedModel = config.model?.remember !== false ? localStorage.getItem("modelId") : null;
    const savedTexture = config.model?.remember !== false ? localStorage.getItem("modelTexturesId") : null;
    model.loadModel(savedModel ?? config.model?.id ?? 1, savedTexture ?? config.model?.textureId ?? 0)
        .catch(error => console.error("Live2D model failed to load", error));
    fetch(config.waifuPath)
        .then(response => {
            if (!response.ok) throw new Error(`Unable to load waifu tips (${response.status})`);
            return response.json();
        })
        .then(registerEventListener)
        .catch(error => console.error("Live2D tips failed to load", error));
    setupDragging(() => config);

    widgetApi = {
        update(patch) {
            const previousModel = config.model || {};
            config = mergeConfig(config, patch);
            model.config = config;
            applyRuntimeConfig(config);
            if (patch.model && (patch.model.id !== previousModel.id || patch.model.textureId !== previousModel.textureId)) {
                model.loadModel(config.model.id, config.model.textureId).catch(error => console.error("Live2D preview update failed", error));
            }
        },
        switchModel: () => model.loadOtherModel(),
        switchTexture: () => model.loadOtherTexture()
    };
    window.Live2DWidget = widgetApi;
    window.dispatchEvent(new CustomEvent("live2d-widget-ready"));
}

function initWidget(config, apiPath) {
    if (document.getElementById("waifu-toggle")) return widgetApi;
    if (typeof config === "string") config = { waifuPath: config, apiPath };
    document.body.insertAdjacentHTML("beforeend", `<div id="waifu-toggle"><span>看板娘</span></div>`);
    const toggle = document.getElementById("waifu-toggle");
    const show = () => {
        toggle.classList.remove("waifu-toggle-active");
        if (!document.getElementById("waifu")) loadWidget(config);
        else {
            localStorage.removeItem("waifu-display");
            document.getElementById("waifu").style.display = "";
            setTimeout(() => { document.getElementById("waifu").style.bottom = 0; }, 0);
        }
    };
    toggle.addEventListener("click", show);
    const hiddenAt = Number(localStorage.getItem("waifu-display"));
    const hiddenHours = Number(localStorage.getItem("waifu-hide-hours")) || Number(config.behavior?.hideHours) || 24;
    if (hiddenAt && Date.now() - hiddenAt <= hiddenHours * 3600000) {
        setTimeout(() => toggle.classList.add("waifu-toggle-active"), 0);
    } else show();
    return widgetApi;
}

export default initWidget;
