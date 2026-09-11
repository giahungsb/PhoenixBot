const { ButtonStyle, ComponentType, ActionRowBuilder, ButtonBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const AIService = require("../../services/ai/AIService");
const AttachmentProcessor = require("../../services/ai/AttachmentProcessor");

module.exports.data = {
        name: "runGPT5",
        type: "ai",
};

module.exports.execute = async (interaction, msg, lang, options = {}) => {
        try {
                const apiKey = process.env.MEGALLM_API_KEY;
                if (!apiKey) {
                        return await interaction.editReply({
                                content: "❌ **GPT-5/Claude/Gemini Pro chưa được cấu hình!**\n\n🔑 Admin cần thêm `MEGALLM_API_KEY` vào Secrets để sử dụng tính năng này.\n\n📖 Hướng dẫn lấy API key:\n• Truy cập: https://megallm.io\n• Đăng ký tài khoản\n• Tạo API key trong Dashboard\n• Thêm vào Secrets với tên `MEGALLM_API_KEY`",
                        });
                }
                
                if (!AIService.megaLLMService) {
                        return await interaction.editReply({
                                content: "❌ **MegaLLM service chưa khởi tạo!**\n\nVui lòng:\n• Kiểm tra API key trong Secrets\n• Restart bot sau khi thêm key\n• Liên hệ admin nếu vấn đề vẫn tiếp diễn",
                        });
                }

                let attachments = options.attachments || null;
                
                if (!attachments && interaction.options?.get) {
                        const imageAttachment = interaction.options.get("image");
                        if (imageAttachment) {
                                const processed = await AttachmentProcessor.processAttachment(imageAttachment.attachment);
                                if (processed.error) {
                                        return await interaction.editReply({
                                                content: `❌ ${processed.message}`,
                                        });
                                }
                                attachments = [processed];
                        }
                }

                const modelKey = options.modelKey || "gpt5";
                const { getDisplayName, getApiModelId } = require("../../config/aiModels");
                const displayName = getDisplayName(modelKey);
                const apiModel = getApiModelId(modelKey);

                await interaction.editReply({
                        content: `🤔 **Đang suy nghĩ...**\n*${displayName} đang xử lý câu hỏi của bạn*`,
                });

                const result = await AIService.processRequest(interaction, msg, {
                        apiKey,
                        language: lang?.local_names,
                        streaming: false,
                        attachments,
                        model: apiModel,
                        threadId: options.threadId,
                        isRoomContext: options.isRoomContext || false,
                });

                if (result.error) {
                        return await interaction.editReply({
                                content: `❌ ${result.message}\n\n*Technical: ${result.technicalError || "Unknown error"}*`,
                        });
                }

                const chunks = splitIntoChunks(result.response, 4000);
                let currentPage = 0;

                const generateEmbed = (page) => {
                        const modelEmoji = modelKey === "claude" ? "🧠" : (modelKey === "gemini-pro" || modelKey === "gemini-flash" ? "✨" : "🚀");
                        const embed = new EmbedBuilder()
                                .setColor("#10A37F")
                                .setAuthor({
                                        name: `${displayName} ${modelEmoji}`,
                                        iconURL: interaction.client.user.displayAvatarURL()
                                })
                                .setDescription(chunks[page])
                                .setFooter({
                                        text: chunks.length > 1 
                                                ? `Trang ${page + 1}/${chunks.length} • Quota: ${result.remaining || 0} lượt ${result.fromCache ? "• 💾 Cache" : ""}`
                                                : `Quota: ${result.remaining || 0} lượt ${result.fromCache ? "• 💾 Cache" : ""}`,
                                        iconURL: interaction.user.displayAvatarURL()
                                })
                                .setTimestamp();

                        if (result.threadId) {
                                embed.addFields({
                                        name: "🧵 Thread ID",
                                        value: `\`${result.threadId.substring(0, 16)}...\``,
                                        inline: true
                                });
                        }

                        if (result.usedFallback) {
                                embed.addFields({
                                        name: "⚠️ Fallback Model",
                                        value: result.fallbackModel,
                                        inline: true
                                });
                        }

                        return embed;
                };

                const createButtons = (page, disableFeedback = false) => {
                        const rows = [];

                        const navRow = new ActionRowBuilder();
                        if (chunks.length > 1) {
                                navRow.addComponents(
                                        new ButtonBuilder()
                                                .setCustomId("prev")
                                                .setLabel("◀")
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(page === 0),
                                        new ButtonBuilder()
                                                .setCustomId("next")
                                                .setLabel("▶")
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(page === chunks.length - 1)
                                );
                                rows.push(navRow);
                        }

                        const feedbackRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(`gpt5_feedback_positive_${interaction.id}`)
                                        .setEmoji("👍")
                                        .setLabel("Hữu ích")
                                        .setStyle(ButtonStyle.Success)
                                        .setDisabled(disableFeedback),
                                new ButtonBuilder()
                                        .setCustomId(`gpt5_feedback_negative_${interaction.id}`)
                                        .setEmoji("👎")
                                        .setLabel("Không hữu ích")
                                        .setStyle(ButtonStyle.Danger)
                                        .setDisabled(disableFeedback)
                        );
                        rows.push(feedbackRow);

                        return rows;
                };

                const messageOptions = {
                        content: null,
                        embeds: [generateEmbed(currentPage)],
                        components: createButtons(currentPage),
                };
                
                if (result.generatedImage) {
                        try {
                                const imageBuffer = Buffer.from(result.generatedImage.base64, 'base64');
                                const extension = result.generatedImage.mimeType === 'image/jpeg' ? 'jpg' : 'png';
                                const attachment = new AttachmentBuilder(imageBuffer, { 
                                        name: `generated-image.${extension}` 
                                });
                                messageOptions.files = [attachment];
                                console.log("[runGPT5] ✅ Attached generated image to response");
                        } catch (imageError) {
                                console.error("[runGPT5] Error attaching image:", imageError);
                        }
                }
                
                const message = await interaction.editReply(messageOptions);

                const collector = message.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 300000,
                });

                let feedbackGiven = false;

                collector.on("collect", async (btnInteraction) => {
                        if (!btnInteraction.customId.startsWith("gpt5_feedback")) {
                                if (btnInteraction.user.id !== interaction.user.id) {
                                        return await btnInteraction.reply({
                                                content: "⚠️ Chỉ người hỏi mới có thể chuyển trang!",
                                                ephemeral: true,
                                        });
                                }
                        }

                        if (btnInteraction.customId === "prev") {
                                currentPage = Math.max(currentPage - 1, 0);
                                await btnInteraction.update({
                                        embeds: [generateEmbed(currentPage)],
                                        components: createButtons(currentPage, feedbackGiven),
                                });
                        } else if (btnInteraction.customId === "next") {
                                currentPage = Math.min(currentPage + 1, chunks.length - 1);
                                await btnInteraction.update({
                                        embeds: [generateEmbed(currentPage)],
                                        components: createButtons(currentPage, feedbackGiven),
                                });
                        } else if (btnInteraction.customId.startsWith("gpt5_feedback")) {
                                if (feedbackGiven) {
                                        return await btnInteraction.reply({
                                                content: "✅ Bạn đã đánh giá phản hồi này rồi!",
                                                ephemeral: true,
                                        });
                                }

                                const rating = btnInteraction.customId.includes("positive") ? "positive" : "negative";
                                
                                await AIService.recordFeedback(
                                        btnInteraction.user.id,
                                        message.id,
                                        result.threadId,
                                        rating,
                                        msg,
                                        result.response
                                );

                                feedbackGiven = true;

                                await btnInteraction.update({
                                        embeds: [generateEmbed(currentPage)],
                                        components: createButtons(currentPage, true),
                                });

                                await btnInteraction.followUp({
                                        content: `✅ Cảm ơn phản hồi của bạn! ${rating === "positive" ? "👍" : "👎"}`,
                                        ephemeral: true,
                                });
                        }
                });

                collector.on("end", async () => {
                        try {
                                const disabledButtons = createButtons(currentPage, true).map(row => {
                                        const newRow = ActionRowBuilder.from(row);
                                        newRow.components.forEach(btn => btn.setDisabled(true));
                                        return newRow;
                                });
                                
                                await interaction.editReply({
                                        components: disabledButtons,
                                });
                        } catch (error) {
                                console.error("[runGPT5] Error disabling buttons:", error);
                        }
                });
                
                return { threadId: result.threadId };
        } catch (error) {
                console.error("GPT-5 AI Error:", error);
                await interaction.editReply({
                        content: `❌ Đã xảy ra lỗi: ${error.message}`,
                }).catch(() => {});
        }
};

function splitIntoChunks(text, chunkSize) {
        const chunks = [];
        
        if (text.length <= chunkSize) {
                return [text];
        }
        
        let currentChunk = "";
        const lines = text.split("\n");
        
        for (const line of lines) {
                if ((currentChunk + line + "\n").length > chunkSize) {
                        if (currentChunk.length > 0) {
                                chunks.push(currentChunk.trim());
                                currentChunk = "";
                        }
                        
                        if (line.length > chunkSize) {
                                for (let i = 0; i < line.length; i += chunkSize) {
                                        chunks.push(line.slice(i, i + chunkSize));
                                }
                        } else {
                                currentChunk = line + "\n";
                        }
                } else {
                        currentChunk += line + "\n";
                }
        }
        
        if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
}
