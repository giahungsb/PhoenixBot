const Groq = require("groq-sdk");

class GroqService {
        constructor(apiKey) {
                if (!apiKey) {
                        throw new Error("GROQ_API_KEY is required");
                }
                this.client = new Groq({
                        apiKey: apiKey,
                });
                this.defaultModel = "openai/gpt-oss-120b";
                this.availableModels = [
                        "llama-3.1-8b-instant",
                        "llama-3.3-70b-versatile",
                        "openai/gpt-oss-120b",
                        "openai/gpt-oss-20b",
                        "meta-llama/llama-4-scout-17b-16e-instruct",
                        "qwen/qwen3-32b",
                ];
        }

        async chat(messages, options = {}) {
                try {
                        const model = options.model || this.defaultModel;
                        const temperature = options.temperature || 0.7;
                        const maxTokens = options.maxTokens || 32768;

                        console.log(`[GroqService] 🚀 Calling Groq with model: ${model}`);
                        console.log(`[GroqService] 📊 Request size: ${messages.length} messages`);
                        
                        const requestParams = {
                                messages: messages,
                                model: model,
                                temperature: temperature,
                                max_tokens: maxTokens,
                                top_p: options.topP || 0.95,
                        };

                        if (options.tools && options.tools.length > 0) {
                                requestParams.tools = options.tools;
                                requestParams.tool_choice = options.toolChoice || "auto";
                                requestParams.parallel_tool_calls = options.parallelToolCalls !== false;
                                console.log(`[GroqService] 🔧 Tool calling enabled with ${options.tools.length} tools`);
                        }
                        
                        const chatCompletion = await this.client.chat.completions.create(requestParams);

                        const assistantMessage = chatCompletion.choices[0]?.message;
                        
                        if (!assistantMessage) {
                                throw new Error("Empty response from Groq API");
                        }

                        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                                console.log(`[GroqService] 🔧 Model requested ${assistantMessage.tool_calls.length} tool calls`);
                                return {
                                        toolCalls: assistantMessage.tool_calls,
                                        message: assistantMessage,
                                };
                        }

                        const response = assistantMessage.content;
                        if (!response) {
                                throw new Error("Empty response from Groq API");
                        }

                        console.log(`[GroqService] ✅ Response received (${response.length} chars)`);
                        return response;
                } catch (error) {
                        console.error("[GroqService] ❌ Error:", error.message);
                        
                        if (error.status === 413 || error.response?.status === 413) {
                                console.error("[GroqService] 💥 Error 413: Request too large. Messages:", messages.length);
                                const newError = new Error(error.message || "Request too large - conversation history exceeds Groq API limits");
                                newError.response = {
                                        status: 413,
                                        data: error.response?.data || error.error
                                };
                                throw newError;
                        }
                        
                        throw error;
                }
        }

        async streamChat(messages, options = {}) {
                try {
                        const model = options.model || this.defaultModel;
                        const temperature = options.temperature || 0.7;
                        const maxTokens = options.maxTokens || 32768;

                        console.log(`[GroqService] 🌊 Starting stream with model: ${model}`);
                        console.log(`[GroqService] 📊 Stream request size: ${messages.length} messages`);

                        const stream = await this.client.chat.completions.create({
                                messages: messages,
                                model: model,
                                temperature: temperature,
                                max_tokens: maxTokens,
                                stream: true,
                        });

                        return stream;
                } catch (error) {
                        console.error("[GroqService] ❌ Stream error:", error.message);
                        
                        if (error.status === 413 || error.response?.status === 413) {
                                console.error("[GroqService] 💥 Stream Error 413: Request too large. Messages:", messages.length);
                                const newError = new Error(error.message || "Request too large - conversation history exceeds Groq API limits");
                                newError.response = {
                                        status: 413,
                                        data: error.response?.data || error.error
                                };
                                throw newError;
                        }
                        
                        throw error;
                }
        }
}

module.exports = GroqService;
