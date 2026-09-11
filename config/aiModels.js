const MODEL_METADATA = {
        ask: {
                label: "ask",
                displayName: "Gemini",
                apiModel: "gemini-2.5-flash",
                service: "gemini",
                supportsVision: true,
                description: "Google Gemini 2.5 Flash with Search Grounding",
        },
        groq: {
                label: "groq",
                displayName: "GROQ",
                apiModel: "openai/gpt-oss-120b",
                service: "groq",
                supportsVision: true,
                description: "OpenAI GPT-OSS 120B via Groq",
        },
        gpt5: {
                label: "gpt5",
                displayName: "GPT-5",
                apiModel: "gpt-5",
                service: "megallm",
                supportsVision: true,
                description: "GPT-5 via MegaLLM",
        },
        "gpt5-mini": {
                label: "gpt5-mini",
                displayName: "GPT-5 Mini",
                apiModel: "gpt-5-mini",
                service: "megallm",
                supportsVision: true,
                description: "GPT-5 Mini - Faster and cost-effective",
        },
        claude: {
                label: "claude",
                displayName: "Claude",
                apiModel: "claude-sonnet-4-5-20250929",
                service: "megallm",
                supportsVision: true,
                description: "Claude Sonnet 4.5",
        },
        "gemini-pro": {
                label: "gemini-pro",
                displayName: "Gemini Pro",
                apiModel: "gemini-2.5-pro",
                service: "megallm",
                supportsVision: true,
                description: "Google Gemini 2.5 Pro via MegaLLM",
        },
        "gemini-flash": {
                label: "gemini-flash",
                displayName: "Gemini Flash",
                apiModel: "gemini-2.5-flash",
                service: "megallm",
                supportsVision: true,
                description: "Google Gemini 2.5 Flash via MegaLLM",
        },
};

function getModelMetadata(modelKey) {
        return MODEL_METADATA[modelKey] || MODEL_METADATA.ask;
}

function getApiModelId(modelKey) {
        const metadata = getModelMetadata(modelKey);
        return metadata.apiModel;
}

function getDisplayName(modelKey) {
        const metadata = getModelMetadata(modelKey);
        return metadata.displayName;
}

function getChannelLabel(modelKey) {
        const metadata = getModelMetadata(modelKey);
        return metadata.label;
}

function getModelService(modelKey) {
        const metadata = getModelMetadata(modelKey);
        return metadata.service;
}

function getAllModels() {
        return Object.keys(MODEL_METADATA);
}

function getModelsByService(service) {
        return Object.entries(MODEL_METADATA)
                .filter(([_, meta]) => meta.service === service)
                .map(([key, _]) => key);
}

function getModelKeyFromApiModel(apiModel) {
        const entry = Object.entries(MODEL_METADATA).find(
                ([_, meta]) => meta.apiModel === apiModel
        );
        return entry ? entry[0] : null;
}

function supportsVision(modelIdentifier) {
        let metadata = MODEL_METADATA[modelIdentifier];
        
        if (!metadata) {
                const modelKey = getModelKeyFromApiModel(modelIdentifier);
                metadata = modelKey ? MODEL_METADATA[modelKey] : null;
        }
        
        return metadata?.supportsVision || false;
}

module.exports = {
        MODEL_METADATA,
        getModelMetadata,
        getApiModelId,
        getDisplayName,
        getChannelLabel,
        getModelService,
        getAllModels,
        getModelsByService,
        getModelKeyFromApiModel,
        supportsVision,
};
