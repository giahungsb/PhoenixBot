const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports.data = {
        name: "B_xoso_check",
        type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const footerText = interaction.message?.embeds?.[0]?.footer?.text;
                
                if (!footerText || !footerText.includes('xoso|')) {
                        return await interaction.reply({
                                content: "❌ Phiên xem kết quả đã hết hạn. Vui lòng sử dụng lệnh `/xoso` lại!",
                                ephemeral: true
                        });
                }
                
                const match = footerText.match(/xoso\|(\d+)\/(\d+)\|uid=(\d+)/);
                if (!match) {
                        console.error("[XOSO_CHECK] Cannot parse footer:", footerText);
                        return await interaction.reply({
                                content: "❌ Không thể mở modal dò vé.",
                                ephemeral: true
                        });
                }
                
                const [, , , userId] = match;
                
                if (userId !== interaction.user.id.toString()) {
                        return await interaction.reply({
                                content: "❌ Chỉ người yêu cầu mới có thể sử dụng các nút này!",
                                ephemeral: true
                        });
                }
                
                const modal = new ModalBuilder()
                        .setCustomId("xoso_modal")
                        .setTitle("🎫 Dò Vé Số");

                const ticketInput = new TextInputBuilder()
                        .setCustomId("ticket_number")
                        .setLabel("Nhập số vé (5 hoặc 6 chữ số)")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("Ví dụ: 123456")
                        .setRequired(true)
                        .setMinLength(5)
                        .setMaxLength(6);

                const firstActionRow = new ActionRowBuilder().addComponents(ticketInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
        } catch (error) {
                console.error("[XOSO_CHECK] Error:", error);
                await interaction.reply({
                        content: "❌ Lỗi khi mở modal. Vui lòng thử lại!",
                        ephemeral: true
                }).catch(() => {});
        }
};
