const { useDB, useFunctions } = require("@zibot/zihooks");
const ContextManager = require("../../services/ai/ContextManager");

module.exports.data = {
        name: "B_AIRoom_Reset",
        type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const { channel, user } = interaction;
                const DataBase = useDB();

                const room = await DataBase.ZiAIRoom.findOne({
                        channelId: channel.id,
                        userId: user.id,
                        status: "active",
                });

                const aiRoomHandler = useFunctions().get("aiRoomHandler");
                const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];

                if (!room) {
                        return await interaction.update({
                                content: "❌ Không tìm thấy AI room của bạn.",
                                components: buttons,
                        });
                }

                if (room.threadId) {
                        const oldThread = await DataBase.ZiGroqThread.findOne({ 
                                threadId: room.threadId, 
                                userID: user.id 
                        });
                        
                        if (oldThread) {
                                await ContextManager.deleteThread(room.threadId, user.id);
                        } else {
                                console.warn(`[B_AIRoom_Reset] Thread ${room.threadId.substring(0, 8)} not found, creating new thread anyway`);
                        }
                }

                const newThread = await ContextManager.createRoomThread(user.id);

                await DataBase.ZiAIRoom.updateOne(
                        { channelId: channel.id },
                        { $set: { threadId: newThread.threadId } }
                );

                await interaction.update({
                        content: "✅ Đã reset lịch sử hội thoại! Bạn có thể bắt đầu cuộc trò chuyện mới.",
                        components: buttons,
                });
        } catch (error) {
                console.error("[B_AIRoom_Reset] Error:", error);
                if (!interaction.replied && !interaction.deferred) {
                        const aiRoomHandler = useFunctions().get("aiRoomHandler");
                        const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];
                        await interaction.update({
                                content: `❌ Đã xảy ra lỗi khi reset lịch sử: ${error.message}`,
                                components: buttons,
                        }).catch(() => {});
                }
        }
};
