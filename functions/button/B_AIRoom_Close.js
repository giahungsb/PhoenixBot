const AIRoomManager = require("../../services/ai/AIRoomManager");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "B_AIRoom_Close",
        type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const { channel, user } = interaction;

                const result = await AIRoomManager.closeRoom(channel.id, user.id);

                if (!result.success) {
                        const aiRoomHandler = useFunctions().get("aiRoomHandler");
                        const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];
                        return await interaction.update({
                                content: `❌ ${result.message}`,
                                components: buttons,
                        });
                }

                await interaction.update({
                        content: "✅ Phòng AI đang được đóng... Bạn có 5 giây để lưu lại thông tin quan trọng.\n\n💾 Lịch sử hội thoại đã được lưu tự động!",
                        components: [],
                });
        } catch (error) {
                console.error("[B_AIRoom_Close] Error:", error);
                if (!interaction.replied && !interaction.deferred) {
                        const aiRoomHandler = useFunctions().get("aiRoomHandler");
                        const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];
                        await interaction.update({
                                content: `❌ Đã xảy ra lỗi khi đóng phòng AI: ${error.message}`,
                                components: buttons,
                        }).catch(() => {});
                }
        }
};
