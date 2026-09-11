const axios = require("axios");
const { supportsVision } = require("../../config/aiModels");

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

        formatImageForAPI(base64Data, contentType = "image/jpeg") {
                return {
                        type: "image_url",
                        image_url: {
                                url: `data:${contentType};base64,${base64Data}`,
                        },
                };
        }

        async createVisionMessage(textContent, imageAttachments) {
                const content = [
                        {
                                type: "text",
                                text: textContent,
                        },
                ];

                if (imageAttachments && imageAttachments.length > 0) {
                        for (const attachment of imageAttachments) {
                                try {
                                        const downloadedImage = await this.downloadImage(attachment.url);
                                        content.push(this.formatImageForAPI(downloadedImage.data, downloadedImage.contentType));
                                } catch (error) {
                                        console.error("[AttachmentProcessor] Failed to download image:", error.message);
                                }
                        }
                }

                return {
                        role: "user",
                        content,
                };
        }

        hasVisionCapability(modelIdentifier) {
                return supportsVision(modelIdentifier);
        }
}

module.exports = new AttachmentProcessor();
