const axios = require("axios");

class AttachmentProcessor {
        constructor() {
                this.supportedImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
                this.maxImageSize = 10 * 1024 * 1024;
        }

        async processAttachments(interaction) {
                const attachments = interaction.options.data.find(option => option.name === "image")?.attachment;
                
                if (!attachments) {
                        return null;
                }

                return await this.processAttachment(attachments);
        }

        async processAttachment(attachment) {
                if (!this.isValidImage(attachment)) {
                        return {
                                error: true,
                                message: `Loại file không được hỗ trợ. Chỉ chấp nhận: ${this.supportedImageTypes.join(", ")}`,
                        };
                }

                if (attachment.size > this.maxImageSize) {
                        return {
                                error: true,
                                message: `File quá lớn. Kích thước tối đa: ${this.maxImageSize / 1024 / 1024}MB`,
                        };
                }

                return {
                        error: false,
                        url: attachment.url,
                        contentType: attachment.contentType,
                        size: attachment.size,
                        name: attachment.name,
                };
        }

        isValidImage(attachment) {
                return this.supportedImageTypes.includes(attachment.contentType);
        }

        async downloadImage(url) {
                try {
                        const response = await axios.get(url, {
                                responseType: "arraybuffer",
                                timeout: 10000,
                        });

                        return {
                                data: Buffer.from(response.data, "binary").toString("base64"),
                                contentType: response.headers["content-type"],
                        };
                } catch (error) {
                        throw new Error(`Failed to download image: ${error.message}`);
                }
        }

        formatImageForAPI(imageUrl, contentType = "image/jpeg") {
                return {
                        type: "image_url",
                        image_url: {
                                url: imageUrl,
                        },
                };
        }

        createVisionMessage(textContent, imageAttachments) {
                const content = [
                        {
                                type: "text",
                                text: textContent,
                        },
                ];

                if (imageAttachments && imageAttachments.length > 0) {
                        imageAttachments.forEach((attachment) => {
                                content.push(this.formatImageForAPI(attachment.url, attachment.contentType));
                        });
                }

                return {
                        role: "user",
                        content,
                };
        }

        hasVisionCapability(model) {
                const visionModels = [
                        "openrouter/polaris-alpha",
                        "anthropic/claude-3.5-sonnet",
                        "openai/gpt-4o",
                        "openai/gpt-4o-mini",
                ];

                return visionModels.some((m) => model.includes(m));
        }
}

module.exports = new AttachmentProcessor();
