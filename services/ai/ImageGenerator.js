const axios = require("axios");

class ImageGenerator {
        constructor() {
                this.apiKey = process.env.HUGGINGFACE_API_KEY;
                this.model = "black-forest-labs/FLUX.1-schnell";
                this.apiUrl = `https://router.huggingface.co/hf-inference/models/${this.model}`;
                this.defaultAspectRatio = "1:1";
        }

        async initialize() {
                if (!this.apiKey) {
                        throw new Error("HUGGINGFACE_API_KEY không được cấu hình. Vui lòng thêm API key vào file .env");
                }
        }

        async generateImage(prompt, options = {}) {
                await this.initialize();

                const {
                        size = "1024x1024",
                        style = "vivid",
                } = options;

                const aspectRatio = this.sizeToAspectRatio(size);

                try {
                        console.log("[ImageGenerator] 🎨 Generating FREE image with Hugging Face (FLUX.1-schnell - FAST):", {
                                prompt: prompt.substring(0, 100),
                                aspectRatio,
                                model: this.model,
                        });

                        const response = await axios.post(
                                this.apiUrl,
                                {
                                        inputs: prompt,
                                },
                                {
                                        headers: {
                                                Authorization: `Bearer ${this.apiKey}`,
                                                "Content-Type": "application/json",
                                                "Accept": "image/jpeg",
                                        },
                                        responseType: "arraybuffer",
                                        timeout: 120000,
                                }
                        );

                        const imageBuffer = Buffer.from(response.data);
                        const imageBase64 = imageBuffer.toString("base64");
                        const mimeType = "image/jpeg";

                        console.log("[ImageGenerator] ✅ Image generated successfully with Hugging Face FREE API");

                        return {
                                success: true,
                                base64: imageBase64,
                                mimeType,
                                revisedPrompt: prompt,
                                originalPrompt: prompt,
                        };
                } catch (error) {
                        console.error("[ImageGenerator] Error:", error.message);

                        if (error.response?.status === 503) {
                                throw new Error("Model đang load, vui lòng thử lại sau 20-30 giây. (Lần đầu có thể mất thời gian)");
                        }

                        if (error.response?.status === 429) {
                                throw new Error("Đã vượt quá giới hạn rate limit. Vui lòng thử lại sau vài phút.");
                        }

                        if (error.response?.status === 401 || error.response?.status === 403) {
                                throw new Error("API key không hợp lệ. Vui lòng kiểm tra lại HUGGINGFACE_API_KEY.");
                        }

                        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                                throw new Error("Tạo ảnh mất quá nhiều thời gian (>2 phút). Vui lòng thử lại với mô tả ngắn hơn.");
                        }

                        throw new Error(`Không thể tạo ảnh: ${error.message}`);
                }
        }

        sizeToAspectRatio(size) {
                const aspectRatioMap = {
                        "1024x1024": "1:1",
                        "1024x1792": "9:16",
                        "1792x1024": "16:9",
                };
                return aspectRatioMap[size] || this.defaultAspectRatio;
        }

        validatePrompt(prompt) {
                if (!prompt || prompt.trim().length === 0) {
                        return {
                                valid: false,
                                error: "Mô tả ảnh không được để trống",
                        };
                }

                if (prompt.length > 4000) {
                        return {
                                valid: false,
                                error: "Mô tả ảnh quá dài (tối đa 4000 ký tự)",
                        };
                }

                return { valid: true };
        }
}

module.exports = new ImageGenerator();
