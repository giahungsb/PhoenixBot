const axios = require("axios");

class ErrorHandler {
        constructor() {
                this.maxRetries = 2;
                this.retryDelay = 1000;
                this.fallbackModels = [
                        "meta-llama/Meta-Llama-3.1-8B-Instruct",
                        "mistralai/Mistral-7B-Instruct-v0.2",
                ];
        }

        async executeWithRetry(fn, options = {}) {
                const maxRetries = options.maxRetries || this.maxRetries;
                const retryDelay = options.retryDelay || this.retryDelay;
                const fallbackModels = options.fallbackModels || this.fallbackModels;

                let lastError = null;

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                        try {
                                return await fn();
                        } catch (error) {
                                lastError = error;
                                
                                if (!this.isRetryable(error)) {
                                        throw error;
                                }

                                if (attempt < maxRetries - 1) {
                                        const delay = retryDelay * Math.pow(2, attempt);
                                        await this.sleep(delay);
                                }
                        }
                }

                if (options.useFallback && fallbackModels.length > 0) {
                        return await this.tryFallbackModels(options.apiCall, fallbackModels, options.apiKey);
                }

                throw lastError;
        }

        async tryFallbackModels(apiCall, fallbackModels, apiKey) {
                for (const model of fallbackModels) {
                        try {
                                const result = await apiCall(model, apiKey);
                                return {
                                        ...result,
                                        usedFallback: true,
                                        fallbackModel: model,
                                };
                        } catch (error) {
                                continue;
                        }
                }

                throw new Error("All fallback models failed");
        }

        isRetryable(error) {
                if (error.response) {
                        const status = error.response.status;
                        return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
                }

                if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
                        return true;
                }

                return false;
        }

        sleep(ms) {
                return new Promise((resolve) => setTimeout(resolve, ms));
        }

        getUserFriendlyError(error) {
                const errorMessage = error.message || "";
                
                if (errorMessage.includes("không hỗ trợ phân tích ảnh")) {
                        const modelMatch = errorMessage.match(/Model (\S+) không/);
                        const modelName = modelMatch ? modelMatch[1] : "này";
                        
                        return `⚠️ **Model ${modelName} không hỗ trợ phân tích ảnh**\n\n💡 **Giải pháp:**\n• Sử dụng model có hỗ trợ vision như:\n  - \`/ai ask\` (Gemini 2.5)\n  - \`/ai gpt5\` (GPT-5.1)\n  - \`/ai claude\` (Claude)\n• Hoặc gửi câu hỏi văn bản không kèm ảnh`;
                }
                
                if (error.response?.status === 400) {
                        const errorData = error.response?.data?.error;
                        const responseMessage = errorData?.message || "";
                        const errorCode = errorData?.code || "";
                        
                        console.error("[ErrorHandler] 400 Bad Request Details:", {
                                message: responseMessage,
                                code: errorCode,
                                fullData: error.response?.data
                        });
                        
                        if (responseMessage.includes("invalid") || responseMessage.includes("Invalid")) {
                                return `Yêu cầu không hợp lệ: ${responseMessage}`;
                        }
                        
                        if (errorCode === "invalid_request_error") {
                                return `Định dạng yêu cầu không đúng. Vui lòng thử lại hoặc liên hệ admin.`;
                        }
                        
                        return `Yêu cầu không hợp lệ. ${responseMessage || "Vui lòng kiểm tra lại thông tin."}`;
                }

                if (error.response?.status === 413) {
                        const errorData = error.response?.data?.error;
                        const errorCode = errorData?.code;
                        const errorMessage = errorData?.message || "";
                        
                        if (errorCode === "rate_limit_exceeded" && errorMessage.includes("tokens per minute")) {
                                return "❌ Vượt quá giới hạn tokens/phút của Groq API!\n\n🔄 **Giải pháp:**\n• Reset lịch sử hội thoại bằng nút 🔄 trong AI Room\n• Rút gọn câu hỏi của bạn\n• Đợi vài giây rồi thử lại\n\n💡 *Tip: Lịch sử hội thoại càng dài càng tốn nhiều tokens*";
                        }
                        
                        return "❌ Lịch sử hội thoại quá dài! Vui lòng:\n• Reset lịch sử bằng nút 🔄 Reset trong AI Room\n• Hoặc rút gọn câu hỏi của bạn\n• Hoặc gửi ít ảnh/file đính kèm hơn";
                }

                if (error.response?.status === 429) {
                        const errorData = error.response?.data?.error;
                        const errorCode = errorData?.code;
                        
                        if (errorCode === "rate_limit_exceeded") {
                                return "⏰ Groq API đang giới hạn tốc độ. Vui lòng đợi 10-30 giây rồi thử lại.";
                        }
                        
                        return "Hệ thống đang quá tải. Vui lòng thử lại sau vài giây.";
                }

                if (error.response?.status === 401 || error.response?.status === 403) {
                        return "Lỗi xác thực API. Vui lòng liên hệ admin.";
                }

                if (error.response?.status >= 500) {
                        return "Server AI đang gặp sự cố. Chúng tôi đã thử với model dự phòng nhưng không thành công.";
                }

                if (error.code === "ETIMEDOUT" || error.code === "ECONNRESET") {
                        return "Kết nối bị gián đoạn. Vui lòng thử lại.";
                }

                return "Đã có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại.";
        }

        async callHuggingFaceAPI(model, messages, apiKey, streaming = false, tools = null) {
                const requestBody = {
                        model,
                        messages,
                        stream: streaming,
                };

                if (tools && tools.length > 0) {
                        requestBody.tools = tools;
                }

                const response = await axios.post(
                        `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
                        requestBody,
                        {
                                headers: {
                                        Authorization: `Bearer ${apiKey}`,
                                        "Content-Type": "application/json",
                                },
                                timeout: 30000,
                        }
                );

                return response;
        }
}

module.exports = new ErrorHandler();
