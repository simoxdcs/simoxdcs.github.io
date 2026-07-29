(() => {
    "use strict";
    const currentScript = document.currentScript;
    const live2dPath = new URL("./", currentScript?.src || `${location.origin}/live2d-widget/`);

    function resolveResource(value, fallback) {
        const source = value || fallback;
        return new URL(source, source.startsWith("/") ? location.origin : live2dPath).href;
    }

    function loadExternalResource(url, type) {
        const selector = type === "css" ? `link[href="${url}"]` : `script[src="${url}"]`;
        if (document.querySelector(selector)) return Promise.resolve(url);
        return new Promise((resolve, reject) => {
            const tag = type === "css" ? document.createElement("link") : document.createElement("script");
            if (type === "css") {
                tag.rel = "stylesheet";
                tag.href = url;
            } else tag.src = url;
            tag.onload = () => resolve(url);
            tag.onerror = () => reject(new Error(`Unable to load ${url}`));
            document.head.appendChild(tag);
        });
    }

    async function start() {
        const response = await fetch(new URL("config.json", live2dPath), { cache: "no-store" });
        if (!response.ok) throw new Error(`Unable to load Live2D config (${response.status})`);
        const config = await response.json();
        if (config.enabled === false) return;
        const minWidth = Number(config.minWidth) || 768;
        if (!config.showOnMobile && window.innerWidth < minWidth) return;
        await new Promise(resolve => setTimeout(resolve, Math.max(0, Number(config.loadDelay) || 0)));
        await Promise.all([
            loadExternalResource(new URL("waifu.css", live2dPath).href, "css"),
            loadExternalResource(new URL("live2d.min.js", live2dPath).href, "js"),
            loadExternalResource(new URL("waifu-tips.js", live2dPath).href, "js")
        ]);
        initWidget({
            ...config,
            waifuPath: resolveResource(config.paths?.waifuTips, "waifu-tips.shokax.json"),
            cdnPath: resolveResource(config.paths?.cdn, "/live2d_api/")
        });
    }

    start().catch(error => console.error("Live2D widget failed to start", error));
})();
