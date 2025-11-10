const axios = require("axios");

class ErrorHandler {
        constructor() {
                this.maxRetries = 3;
                this.retryDelay = 1000;
                this.fallbackModels = [
                        "anthropic/claude-3.5-sonnet",
                        "openai/gpt-4o-mini",
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
                if (error.response?.status === 429) {
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

        async callOpenRouterAPI(model, messages, apiKey, streaming = false) {
                const requestBody = {
                        model,
                        messages,
                        stream: streaming,
                };

                if (model.includes("polaris")) {
                        requestBody.plugins = [{ id: "web" }];
                }

                const response = await axios.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        requestBody,
                        {
                                headers: {
                                        Authorization: `Bearer ${apiKey}`,
                                        "Content-Type": "application/json",
                                        "HTTP-Referer": "https://replit.com",
                                        "X-Title": "Zibot Discord Bot",
                                },
                                timeout: 60000,
                        }
                );

                return response;
        }
}

module.exports = new ErrorHandler();
