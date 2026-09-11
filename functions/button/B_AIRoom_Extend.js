const AIRoomManager = require("../../services/ai/AIRoomManager");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "B_AIRoom_Extend",
        type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const { channel, user } = interaction;

                const result = await AIRoomManager.extendTimeout(channel.id, user.id, 900000);

                const aiRoomHandler = useFunctions().get("aiRoomHandler");
                const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];

                if (!result.success) {
                        return await interaction.update({
                                content: `❌ ${result.message}`,
                                components: buttons,
                        });
                }

                const minutes = Math.floor(result.newTimeout / 60000);

                await interaction.update({
                        content: `✅ Đã gia hạn thời gian! Phòng sẽ tự đóng sau **${minutes} phút** không hoạt động.`,
                        components: buttons,
                });

                try {
                        const messages = await channel.messages.fetch({ limit: 50 });
                        const welcomeMessage = messages.find(msg => 
                                msg.author.id === interaction.client.user.id && 
                                msg.embeds.length > 0 && 
                                msg.embeds[0].title?.includes("Welcome to Your AI Chat Room")
                        );

                        if (welcomeMessage && welcomeMessage.embeds[0]) {
                                const oldEmbed = welcomeMessage.embeds[0];
                                const updatedFields = oldEmbed.fields.map(field => {
                                        if (field.name === "⏰ Auto-close") {
                                                return { ...field, value: `${minutes} phút` };
                                        }
                                        return field;
                                });

                                const updatedEmbed = {
                                        ...oldEmbed.data,
                                        fields: updatedFields
                                };

                                await welcomeMessage.edit({
                                        embeds: [updatedEmbed],
                                        components: welcomeMessage.components
                                });
                        }
                } catch (editError) {
                        console.error("[B_AIRoom_Extend] Error updating welcome message:", editError);
                }
        } catch (error) {
                console.error("[B_AIRoom_Extend] Error:", error);
                if (!interaction.replied && !interaction.deferred) {
                        const aiRoomHandler = useFunctions().get("aiRoomHandler");
                        const buttons = aiRoomHandler ? [aiRoomHandler.buildRoomButtons()] : [];
                        await interaction.update({
                                content: `❌ Đã xảy ra lỗi khi gia hạn phòng AI: ${error.message}`,
                                components: buttons,
                        }).catch(() => {});
                }
        }
};
