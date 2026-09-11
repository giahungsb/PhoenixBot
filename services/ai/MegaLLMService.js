const axios = require("axios");

class MegaLLMService {
        constructor(apiKey) {
                if (!apiKey) {
                        throw new Error("MEGALLM_API_KEY is required");
                }
                this.apiKey = apiKey;
                this.baseURL = "https://ai.megallm.io/v1";
                this.defaultModel = "gpt-5";
                this.availableModels = [
                        "gpt-5",
                        "gpt-5-mini",
                        "claude-sonnet-4-5-20250929",
                        "gemini-2.5-pro",
                        "gemini-2.5-flash",
                ];
        }

        async chat(messages, options = {}) {
                try {
                        const model = options.model || this.defaultModel;
                        const temperature = options.temperature || 0.7;
                        const maxTokens = options.maxTokens || 4096;

                        console.log(`[MegaLLMService] 🚀 Calling MegaLLM with model: ${model}`);
                        
                        const requestData = {
                                model: model,
                                messages: messages,
                                temperature: temperature,
                                max_tokens: maxTokens,
                                top_p: options.topP || 0.95,
                        };

                        if (options.tools && options.tools.length > 0) {
                                requestData.tools = options.tools;
                                requestData.tool_choice = options.toolChoice || "auto";
                                console.log(`[MegaLLMService] 🔧 Tool calling enabled with ${options.tools.length} tools`);
                        }

                        const response = await axios.post(
                                `${this.baseURL}/chat/completions`,
                                requestData,
                                {
                                        headers: {
                                                "Content-Type": "application/json",
                                                "Authorization": `Bearer ${this.apiKey}`,
                                        },
                                        timeout: 60000,
                                }
                        );

                        const assistantMessage = response.data.choices[0]?.message;
                        
                        if (!assistantMessage) {
                                throw new Error("Empty response from MegaLLM API");
                        }

                        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                                console.log(`[MegaLLMService] 🔧 Model requested ${assistantMessage.tool_calls.length} tool calls`);
                                return {
                                        toolCalls: assistantMessage.tool_calls,
                                        message: assistantMessage,
                                        usage: response.data.usage,
                                };
                        }

                        const content = assistantMessage.content;
                        if (!content) {
                                throw new Error("Empty content from MegaLLM API");
                        }

                        console.log(`[MegaLLMService] ✅ Response received (${content.length} chars)`);
                        return {
                                content,
                                usage: response.data.usage,
                        };
                } catch (error) {
                        console.error("[MegaLLMService] ❌ Error:", error.response?.data || error.message);
                        
                        if (error.response?.status === 401) {
                                throw new Error("Invalid API key. Please check MEGALLM_API_KEY.");
                        } else if (error.response?.status === 429) {
                                throw new Error("Rate limit exceeded. Please try again later.");
                        } else if (error.response?.status === 500) {
                                throw new Error("MegaLLM service error. Please try again later.");
                        }
                        
                        throw error;
                }
        }

        async streamChat(messages, options = {}) {
                try {
                        const model = options.model || this.defaultModel;
                        const temperature = options.temperature || 0.7;
                        const maxTokens = options.maxTokens || 4096;

                        console.log(`[MegaLLMService] 🚀 Starting stream with model: ${model}`);

                        const response = await axios.post(
                                `${this.baseURL}/chat/completions`,
                                {
                                        model: model,
                                        messages: messages,
                                        temperature: temperature,
                                        max_tokens: maxTokens,
                                        stream: true,
                                },
                                {
                                        headers: {
                                                "Content-Type": "application/json",
                                                "Authorization": `Bearer ${this.apiKey}`,
                                        },
                                        responseType: 'stream',
                                        timeout: 60000,
                                }
                        );

                        return response.data;
                } catch (error) {
                        console.error("[MegaLLMService] ❌ Stream error:", error.response?.data || error.message);
                        throw error;
                }
        }

        async listModels() {
                try {
                        const response = await axios.get(
                                `${this.baseURL}/models`,
                                {
                                        headers: {
                                                "Authorization": `Bearer ${this.apiKey}`,
                                        },
                                }
                        );

                        return response.data;
                } catch (error) {
                        console.error("[MegaLLMService] ❌ Error listing models:", error.message);
                        throw error;
                }
        }
}

module.exports = MegaLLMService;
