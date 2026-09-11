const xosoCommand = require("../../commands/utility/xoso.js");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");

module.exports.data = {
        name: "xoso_modal",
        type: "modal",
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                // Defer reply ngay lập tức để tránh timeout
                await interaction.deferReply({ ephemeral: false });
                
                // Lấy kết quả từ cache trước
                let results = xosoCommand.getUserResults(interaction.user.id);

                // Nếu không có trong cache, thử fetch lại từ embed footer
                if (!results) {
                        const footerText = interaction.message?.embeds?.[0]?.footer?.text;
                        
                        if (!footerText || !footerText.includes('xoso|')) {
                                return interaction.editReply({
                                        content: "❌ Không thể lấy thông tin kết quả. Vui lòng sử dụng lệnh `/xoso` lại!",
                                });
                        }

                        // Parse thông tin từ footer: xoso|page/total|uid=xxx|tinh=xxx|ngay=DD-MM-YYYY
                        const match = footerText.match(/tinh=([^|]+)\|ngay=([^|]+)/);
                        if (!match) {
                                return interaction.editReply({
                                        content: "❌ Không thể lấy thông tin kết quả. Vui lòng sử dụng lệnh `/xoso` lại!",
                                });
                        }

                        const [, provinceCode, date] = match;

                        // Fetch lại kết quả từ website
                        results = await xosoCommand.fetchResults(provinceCode, date);

                        if (!results) {
                                return interaction.editReply({
                                        content: "❌ Không thể lấy lại kết quả xổ số. Vui lòng sử dụng lệnh `/xoso` lại!",
                                });
                        }
                        
                        // Cập nhật lại cache để sử dụng cho lần sau
                        xosoCommand.saveUserResults(interaction.user.id, results);
                }

                const ticketNumber = interaction.fields.getTextInputValue("ticket_number");

                if (!/^\d{5,6}$/.test(ticketNumber)) {
                        return interaction.editReply({
                                content: "❌ Số vé không hợp lệ! Vui lòng nhập 5 hoặc 6 chữ số.",
                        });
                }

                const checkEmbed = xosoCommand.createCheckEmbed(results, ticketNumber, {}, interaction);

                const checkAnotherButton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                                .setCustomId("xoso_check_another")
                                .setLabel("🎫 Dò Vé Khác")
                                .setStyle(ButtonStyle.Success)
                );

                const message = await interaction.editReply({
                        embeds: [checkEmbed],
                        components: [checkAnotherButton],
                });

                const collector = message.createMessageComponentCollector({
                        filter: (i) => i.user.id === interaction.user.id,
                });

                collector.on("collect", async (i) => {
                        if (i.customId === "xoso_check_another") {
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

                                await i.showModal(modal);
                        }
                });
        } catch (error) {
                console.error("[XOSO_MODAL] Error:", error);
                await interaction.editReply({
                        content: "❌ Có lỗi xảy ra khi dò vé. Vui lòng thử lại!",
                }).catch(() => {});
        }
};
