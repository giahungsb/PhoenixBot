const { ButtonStyle, ComponentType, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const AIService = require("../../services/ai/AIService");
const AttachmentProcessor = require("../../services/ai/AttachmentProcessor");

module.exports.data = {
        name: "runPolaris",
        type: "ai",
};

module.exports.execute = async (interaction, msg, lang) => {
        try {
                const apiKey = process.env.OPENROUTER_API_KEY;
                if (!apiKey) {
                        return await interaction.editReply({
                                content: "❌ Không tìm thấy OPENROUTER_API_KEY. Vui lòng thiết lập API key.",
                        });
                }

                const imageAttachment = interaction.options.get("image");
                let attachments = null;

                if (imageAttachment) {
                        const processed = await AttachmentProcessor.processAttachment(imageAttachment.attachment);
                        if (processed.error) {
                                return await interaction.editReply({
                                        content: `❌ ${processed.message}`,
                                });
                        }
                        attachments = [processed];
                }

                const result = await AIService.processRequest(interaction, msg, {
                        apiKey,
                        language: lang?.local_names,
                        streaming: false,
                        attachments,
                });

                if (result.error) {
                        return await interaction.editReply({
                                content: `❌ ${result.message}\n\n*Technical: ${result.technicalError || "Unknown error"}*`,
                        });
                }

                const header = `### 🌟 Kết quả từ Polaris-Alpha\n**Prompt:** ${msg}\n**Hỏi bởi:** ${interaction.user.username}\n`;
                const cacheInfo = result.fromCache ? "💾 *Từ cache*" : "";
                const quotaInfo = `📊 Quota còn lại: ${result.remaining || 0} lượt`;
                const threadInfo = result.threadId ? `🧵 Thread: ${result.threadId.substring(0, 8)}...` : "";
                const fallbackInfo = result.usedFallback ? `⚠️ Sử dụng fallback model: ${result.fallbackModel}` : "";

                const infoLine = [cacheInfo, quotaInfo, threadInfo, fallbackInfo].filter(Boolean).join(" | ");
                const fullHeader = `${header}${infoLine}\n\n`;

                const chunks = splitIntoChunks(result.response, 1800, fullHeader);
                let currentPage = 0;

                const generateContent = (page) => {
                        const footer = chunks.length > 1 ? `\n\n*Trang ${page + 1}/${chunks.length}*` : "";
                        return fullHeader + chunks[page] + footer;
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
                                        .setCustomId(`polaris_feedback_positive_${interaction.id}`)
                                        .setEmoji("👍")
                                        .setLabel("Hữu ích")
                                        .setStyle(ButtonStyle.Success)
                                        .setDisabled(disableFeedback),
                                new ButtonBuilder()
                                        .setCustomId(`polaris_feedback_negative_${interaction.id}`)
                                        .setEmoji("👎")
                                        .setLabel("Không hữu ích")
                                        .setStyle(ButtonStyle.Danger)
                                        .setDisabled(disableFeedback)
                        );
                        rows.push(feedbackRow);

                        return rows;
                };

                const message = await interaction.editReply({
                        content: generateContent(currentPage),
                        components: createButtons(currentPage),
                });

                const collector = message.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 300000,
                });

                let feedbackGiven = false;

                collector.on("collect", async (btnInteraction) => {
                        if (!btnInteraction.customId.startsWith("polaris_feedback")) {
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
                                        content: generateContent(currentPage),
                                        components: createButtons(currentPage, feedbackGiven),
                                });
                        } else if (btnInteraction.customId === "next") {
                                currentPage = Math.min(currentPage + 1, chunks.length - 1);
                                await btnInteraction.update({
                                        content: generateContent(currentPage),
                                        components: createButtons(currentPage, feedbackGiven),
                                });
                        } else if (btnInteraction.customId.startsWith("polaris_feedback")) {
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
                                        content: generateContent(currentPage),
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
                                await interaction.editReply({
                                        components: createButtons(currentPage, true).map(row => {
                                                const newRow = ActionRowBuilder.from(row);
                                                newRow.components.forEach(btn => btn.setDisabled(true));
                                                return newRow;
                                        }),
                                });
                        } catch (error) {
                        }
                });
        } catch (error) {
                console.error("Polaris Error:", error);
                await interaction.editReply({
                        content: `❌ Đã xảy ra lỗi: ${error.message}`,
                }).catch(() => {});
        }
};

function splitIntoChunks(text, chunkSize, header = "") {
        const maxSize = chunkSize - header.length;
        const chunks = [];
        
        if (text.length <= maxSize) {
                return [text];
        }
        
        let currentChunk = "";
        const lines = text.split("\n");
        
        for (const line of lines) {
                if ((currentChunk + line + "\n").length > maxSize) {
                        if (currentChunk.length > 0) {
                                chunks.push(currentChunk);
                                currentChunk = "";
                        }
                        
                        if (line.length > maxSize) {
                                for (let i = 0; i < line.length; i += maxSize) {
                                        chunks.push(line.slice(i, i + maxSize));
                                }
                        } else {
                                currentChunk = line + "\n";
                        }
                } else {
                        currentChunk += line + "\n";
                }
        }
        
        if (currentChunk.length > 0) {
                chunks.push(currentChunk);
        }
        
        return chunks.length > 0 ? chunks : [text.slice(0, maxSize)];
}
