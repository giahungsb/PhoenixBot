const { useAI, useDB } = require("@zibot/zihooks");
const { ButtonStyle, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const ContextManager = require("../../services/ai/ContextManager");
const AttachmentProcessor = require("../../services/ai/AttachmentProcessor");

module.exports.data = {
        name: "runAI",
        type: "ai",
};

module.exports.execute = async (interaction, msg, lang, options = {}) => {
        try {
                if (!process.env.GEMINI_API_KEY) {
                        return await interaction.editReply({
                                content: "❌ **Gemini AI chưa được cấu hình!**\n\n🔑 Admin cần thêm `GEMINI_API_KEY` vào Secrets để sử dụng tính năng này.\n\n📖 Hướng dẫn lấy API key:\n• Truy cập: https://aistudio.google.com/app/apikey\n• Đăng nhập với Google account\n• Tạo API key miễn phí\n• Thêm vào Secrets với tên `GEMINI_API_KEY`",
                        });
                }
                
                const aiInstance = useAI();
                if (!aiInstance || !aiInstance.run) {
                        return await interaction.editReply({
                                content: "❌ **Gemini AI chưa khởi tạo!**\n\nVui lòng kiểm tra:\n• API key đã được thêm vào Secrets chưa?\n• Bot đã khởi động lại sau khi thêm key chưa?",
                        });
                }
                
                let attachments = options.attachments || null;
                
                if (!attachments && interaction.options?.getAttachment) {
                        const imageAttachment = interaction.options.getAttachment("image");
                        if (imageAttachment) {
                                const processed = await AttachmentProcessor.processAttachment(imageAttachment);
                                if (processed.error) {
                                        return await interaction.editReply({
                                                content: `❌ ${processed.message}`,
                                        });
                                }
                                attachments = [processed];
                        }
                }
                
                const userID = interaction.user.id;
                const threadId = options.threadId || null;
                const isRoomContext = options.isRoomContext || false;
                const thread = await ContextManager.getOrCreateThread(userID, threadId, isRoomContext);
                
                await ContextManager.addMessage(thread.threadId, "user", msg, 0, "gemini");
                
                await interaction.editReply({
                        content: "🤔 **Đang suy nghĩ...**\n*Gemini đang xử lý câu hỏi của bạn*",
                });
                
                const updatedThread = await ContextManager.getOrCreateThread(userID, thread.threadId, isRoomContext);
                
                const result = await aiInstance.run(msg, interaction.user, lang, updatedThread, attachments);

                if (!result || result.trim().length === 0) {
                        return await interaction.editReply({
                                content: "❌ Gemini AI không trả về kết quả. Vui lòng thử lại sau.",
                        });
                }
                
                await ContextManager.addMessage(thread.threadId, "assistant", result, 0, "gemini");

                const chunks = splitIntoChunks(result, 4090);
                let currentPage = 0;

        // Tạo embed cho trang hiện tại
        const generateEmbed = (page) => {
                return new EmbedBuilder()
                        .setTitle("Kết quả từ AI")
                        .setDescription(chunks[page]) // max 4096
                        .setFooter({
                                text: `Trang ${page + 1} / ${chunks.length}`,
                        })
                        .setColor("Blue");
        };

        // Nếu chỉ có một trang, gửi luôn
        if (chunks.length === 1) {
                await interaction.editReply({
                        content: null,
                        embeds: [generateEmbed(0)],
                });
                return;
        }

        // Tạo các nút điều hướng
        const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(true), // Vô hiệu hóa nút "Trước" ban đầu
                new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Secondary),
        );

        // Gửi tin nhắn ban đầu với trang đầu tiên
        const message = await interaction.editReply({
                content: null,
                embeds: [generateEmbed(currentPage)],
                components: [row],
        });

        // Bộ thu thập (collector) để xử lý các lần bấm nút
        const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: (btnInteraction) => btnInteraction.user.id === interaction.user.id, // Chỉ cho phép người hỏi bấm nút
                time: 60000, // Hết hạn sau 60 giây
        });

        collector.on("collect", async (btnInteraction) => {
                // Xác định nút được bấm
                if (btnInteraction.customId === "prev") {
                        currentPage = Math.max(currentPage - 1, 0);
                } else if (btnInteraction.customId === "next") {
                        currentPage = Math.min(currentPage + 1, chunks.length - 1);
                }

                // Cập nhật embed và trạng thái nút
                await btnInteraction.update({
                        embeds: [generateEmbed(currentPage)],
                        components: [
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId("prev")
                                                .setLabel("◀")
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(currentPage === 0), // Vô hiệu hóa nếu ở trang đầu
                                        new ButtonBuilder()
                                                .setCustomId("next")
                                                .setLabel("▶")
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(currentPage === chunks.length - 1), // Vô hiệu hóa nếu ở trang cuối
                                ),
                        ],
                });
        });

        collector.on("end", async () => {
                // Sau khi hết thời gian, vô hiệu hóa các nút
                await interaction.editReply({
                        components: [
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder().setCustomId("prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                        new ButtonBuilder().setCustomId("next").setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                ),
                        ],
                });
        });
        
        return { threadId: thread.threadId };
        } catch (error) {
                console.error("Gemini AI Error:", error);
                await interaction.editReply({
                        content: `❌ Đã xảy ra lỗi khi xử lý yêu cầu với Gemini AI: ${error.message}\n\nVui lòng thử lại sau.`,
                }).catch(() => {});
                return null;
        }
};

function splitIntoChunks(text, chunkSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
                chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
}
