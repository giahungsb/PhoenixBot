const AIRoomManager = require("../../services/ai/AIRoomManager");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports.data = {
        name: "aiRoomHandler",
        type: "ai",
};

module.exports.execute = async () => {
        // This function is loaded as a handler, not directly executed
        // The actual execution happens via handleAIRequest method
};

module.exports.handleAIRequest = async (interaction, aiFunction, aiModel = "ask", ...args) => {
        const { guild, user } = interaction;

        if (!guild) {
                return await aiFunction(interaction, ...args);
        }

        try {
                const { useDB } = require("@zibot/zihooks");
                const DataBase = useDB();
                
                if (!DataBase) {
                        console.error("[aiRoomHandler] Database not available");
                        return await aiFunction(interaction, ...args);
                }
                
                const guildSettings = await DataBase.ZiGuild.findOne({ guildId: guild.id });

                if (!guildSettings?.aiRooms?.enabled) {
                        return await aiFunction(interaction, ...args);
                }

                const roomResult = await AIRoomManager.getOrCreateRoom(guild, user, null, aiModel);

                if (roomResult.error) {
                        console.error("[aiRoomHandler] Room creation error:", roomResult.message);
                        return await interaction.editReply({
                                content: `❌ ${roomResult.message}`,
                        });
                }

                let { room, channel, isNew } = roomResult;

        if (!channel && room) {
                console.log(`[aiRoomHandler] Room ${room.channelId} exists but channel is missing, cleaning up...`);
                await AIRoomManager.deleteRoom(room.channelId);
                
                const retryResult = await AIRoomManager.getOrCreateRoom(guild, user, null, aiModel);
                if (retryResult.error || !retryResult.channel) {
                        return await interaction.editReply({
                                content: `❌ Không thể tạo AI Room mới. Vui lòng thử lại sau.`,
                        });
                }
                room = retryResult.room;
                channel = retryResult.channel;
                isNew = retryResult.isNew;
        }

        if (isNew) {
                await module.exports.sendWelcomeMessage(channel, user, room, aiModel);
                
                const { getDisplayName } = require("../../config/aiModels");
                const modelName = getDisplayName(aiModel);
                await interaction.editReply({
                        content: `✅ AI Room mới đã được tạo! <#${channel.id}>\n\n💡 Bạn có thể chat trực tiếp với **${modelName}** trong phòng này.\n📝 Gửi câu hỏi của bạn vào phòng để bắt đầu!\n\n⏰ Phòng sẽ tự động đóng sau 15 phút không hoạt động.`,
                        ephemeral: true,
                });
                
                await AIRoomManager.updateActivity(channel.id);
                return;
        }

        const { getDisplayName } = require("../../config/aiModels");
        const modelName = getDisplayName(aiModel);
        await interaction.editReply({
                content: `✅ Đang chuyển câu hỏi vào AI Room của bạn! <#${channel.id}>`,
                ephemeral: true,
        });

        const thinkingMessage = await channel.send({
                content: "🤔 **Đang suy nghĩ...**\n*AI đang xử lý câu hỏi của bạn*",
        });

        const clonedInteraction = Object.create(interaction);
        clonedInteraction.channel = channel;
        clonedInteraction.channelId = channel.id;

        const originalEditReply = clonedInteraction.editReply.bind(clonedInteraction);
        clonedInteraction.editReply = async (options) => {
                try {
                        return await thinkingMessage.edit(options);
                } catch (error) {
                        console.error("[aiRoomHandler] Error editing thinking message:", error);
                        try {
                                return await channel.send(options);
                        } catch (sendError) {
                                console.error("[aiRoomHandler] Error sending to room:", sendError);
                                return await originalEditReply(options);
                        }
                }
        };

        await AIRoomManager.updateActivity(channel.id);

                return await aiFunction(clonedInteraction, ...args);
        } catch (error) {
                console.error("[aiRoomHandler] Error handling AI request:", error);
                
                try {
                        await interaction.editReply({
                                content: `❌ Đã xảy ra lỗi khi xử lý AI request: ${error.message}\n\nBot sẽ thử trả lời trực tiếp...`,
                        });
                } catch (replyError) {
                        console.error("[aiRoomHandler] Failed to send error message:", replyError);
                }
                
                return await aiFunction(interaction, ...args);
        }
};

module.exports.buildRoomButtons = () => {
        return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                        .setCustomId("B_AIRoom_Close")
                        .setLabel("🚪 Đóng phòng")
                        .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                        .setCustomId("B_AIRoom_Extend")
                        .setLabel("⏰ Gia hạn +15 phút")
                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                        .setCustomId("B_AIRoom_Reset")
                        .setLabel("🔄 Reset lịch sử")
                        .setStyle(ButtonStyle.Secondary)
        );
};

module.exports.sendWelcomeMessage = async (channel, user, room, aiModel = "ask") => {
        const { getDisplayName } = require("../../config/aiModels");
        const modelName = getDisplayName(aiModel);
        const modelEmoji = aiModel === "claude" ? "🧠" : (aiModel === "gpt5" || aiModel === "gpt5-mini" ? "🚀" : (aiModel === "gemini-pro" || aiModel === "gemini-flash" ? "✨" : (aiModel === "ask" ? "✨" : "🤖")));
        
        const embed = new EmbedBuilder()
                .setTitle(`${modelEmoji} Welcome to Your ${modelName} Chat Room!`)
                .setDescription(`Xin chào ${user}! Đây là phòng chat **${modelName}** riêng của bạn.`)
                .addFields(
                        {
                                name: "📝 Cách sử dụng",
                                value: `• Chỉ cần gửi tin nhắn vào phòng này, **${modelName}** sẽ tự động trả lời!\n• Không cần gõ lệnh \`/ai\` nữa\n• Conversation history được lưu tự động\n• Phòng sẽ tự đóng sau 15 phút không hoạt động`,
                        },
                        {
                                name: "🔧 Quản lý phòng",
                                value: "Sử dụng các nút bên dưới để:\n• Đóng phòng ngay lập tức\n• Gia hạn thời gian thêm 15 phút\n• Reset lịch sử hội thoại",
                        },
                        {
                                name: "🧵 Thread ID",
                                value: `\`${room.threadId.substring(0, 16)}...\``,
                                inline: true,
                        },
                        {
                                name: "⏰ Auto-close",
                                value: "15 phút",
                                inline: true,
                        }
                )
                .setColor("Blue")
                .setTimestamp();

        await channel.send({
                embeds: [embed],
                components: [module.exports.buildRoomButtons()],
        });
};
