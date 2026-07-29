import showMessage from "./message.js";
import randomSelection from "./utils.js";

class Model {
    constructor(config) {
        let { apiPath, cdnPath } = config;
        this.config = config;
        this.useCDN = typeof cdnPath === "string";
        if (this.useCDN) {
            this.cdnPath = cdnPath.endsWith("/") ? cdnPath : `${cdnPath}/`;
        } else if (typeof apiPath === "string") {
            this.apiPath = apiPath.endsWith("/") ? apiPath : `${apiPath}/`;
        } else {
            throw new Error("Live2D requires either cdnPath or apiPath");
        }
    }

    async loadModelList() {
        const response = await fetch(`${this.cdnPath}model_list.json`);
        if (!response.ok) throw new Error(`Unable to load Live2D model list (${response.status})`);
        this.modelList = await response.json();
    }

    async variants(modelId) {
        if (!this.modelList) await this.loadModelList();
        const safeModelId = Math.max(0, Math.min(Number(modelId) || 0, this.modelList.models.length - 1));
        const entry = this.modelList.models[safeModelId];
        return { modelId: safeModelId, items: Array.isArray(entry) ? entry : [entry] };
    }

    announceModel(result) {
        const canvas = document.getElementById("live2d");
        if (canvas) {
            canvas.dataset.modelId = String(result.modelId);
            canvas.dataset.textureId = String(result.textureId);
            if (result.textureCount) canvas.dataset.textureCount = String(result.textureCount);
        }
        window.dispatchEvent(new CustomEvent("live2d-model-changed", { detail: result }));
        return result;
    }

    async loadModel(modelId, modelTexturesId = 0, message) {
        if (this.useCDN) {
            const variants = await this.variants(modelId);
            const textureId = Math.max(0, Math.min(Number(modelTexturesId) || 0, variants.items.length - 1));
            localStorage.setItem("modelId", variants.modelId);
            localStorage.setItem("modelTexturesId", textureId);
            showMessage(message, 4000, 10);
            loadlive2d("live2d", `${this.cdnPath}model/${variants.items[textureId]}/index.json`);
            return this.announceModel({ modelId: variants.modelId, textureId, textureCount: variants.items.length });
        }
        localStorage.setItem("modelId", modelId);
        localStorage.setItem("modelTexturesId", modelTexturesId);
        showMessage(message, 4000, 10);
        loadlive2d("live2d", `${this.apiPath}get/?id=${modelId}-${modelTexturesId}`);
        return this.announceModel({ modelId: Number(modelId), textureId: Number(modelTexturesId) });
    }

    async loadOtherModel() {
        if (!this.useCDN) {
            const modelId = localStorage.getItem("modelId") || 0;
            const response = await fetch(`${this.apiPath}switch/?id=${modelId}`);
            const result = await response.json();
            return this.loadModel(result.model.id, 0, result.model.message);
        }
        if (!this.modelList) await this.loadModelList();
        const current = Number(localStorage.getItem("modelId")) || 0;
        let next;
        if (this.config.model?.switchModelMode === "random" && this.modelList.models.length > 1) {
            do next = Math.floor(Math.random() * this.modelList.models.length); while (next === current);
        } else {
            next = (current + 1) % this.modelList.models.length;
        }
        return this.loadModel(next, 0, randomSelection(this.modelList.messages[next]));
    }

    async loadOtherTexture() {
        const modelId = Number(localStorage.getItem("modelId")) || 0;
        const textureId = Number(localStorage.getItem("modelTexturesId")) || 0;
        if (!this.useCDN) {
            const mode = this.config.model?.switchTextureMode === "random" ? "rand" : "switch";
            const response = await fetch(`${this.apiPath}${mode}_textures/?id=${modelId}-${textureId}`);
            const result = await response.json();
            return this.loadModel(modelId, result.textures.id, "我的新衣服好看吗？");
        }
        const variants = await this.variants(modelId);
        if (variants.items.length <= 1) {
            showMessage("我暂时还没有其他衣服。", 4000, 10);
            return { modelId, textureId: 0, textureCount: 1 };
        }
        let next;
        if (this.config.model?.switchTextureMode === "random") {
            do next = Math.floor(Math.random() * variants.items.length); while (next === textureId);
        } else {
            next = (textureId + 1) % variants.items.length;
        }
        return this.loadModel(modelId, next, "我的新衣服好看吗？");
    }
}

export default Model;
