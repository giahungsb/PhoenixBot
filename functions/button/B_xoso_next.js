const xosoCommand = require("../../commands/utility/xoso.js");

module.exports.data = {
        name: "B_xoso_next",
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
                        console.error("[XOSO_NEXT] Cannot parse footer:", footerText);
                        return await interaction.reply({
                                content: "❌ Không thể xác định trang hiện tại.",
                                ephemeral: true
                        });
                }
                
                const [, currentPageStr, totalPagesStr, userId] = match;
                const currentPage = parseInt(currentPageStr) - 1;
                const totalPages = parseInt(totalPagesStr);
                
                if (userId !== interaction.user.id.toString()) {
                        return await interaction.reply({
                                content: "❌ Chỉ người yêu cầu mới có thể sử dụng các nút này!",
                                ephemeral: true
                        });
                }
                
                if (currentPage >= totalPages - 1) {
                        return await interaction.reply({
                                content: "❌ Bạn đang ở trang cuối cùng rồi!",
                                ephemeral: true
                        });
                }
                
                // Defer ngay lập tức để tránh timeout
                await interaction.deferUpdate();
                
                // Lấy kết quả từ cache trước
                let results = xosoCommand.getUserResults(interaction.user.id);
                
                // Nếu không có trong cache, thử fetch lại từ embed footer
                if (!results) {
                        const match2 = footerText.match(/tinh=([^|]+)\|ngay=([^|]+)/);
                        if (!match2) {
                                return await interaction.editReply({
                                        content: "❌ Phiên xem kết quả đã hết hạn. Vui lòng sử dụng lệnh `/xoso` lại!"
                                });
                        }

                        const [, provinceCode, date] = match2;

                        // Fetch lại kết quả từ website
                        results = await xosoCommand.fetchResults(provinceCode, date);

                        if (!results) {
                                return await interaction.editReply({
                                        content: "❌ Không thể lấy lại kết quả xổ số. Vui lòng sử dụng lệnh `/xoso` lại!"
                                });
                        }
                        
                        // Cập nhật lại cache để sử dụng cho lần sau
                        xosoCommand.saveUserResults(interaction.user.id, results);
                }
                
                const newPage = currentPage + 1;
                const newEmbed = xosoCommand.createResultEmbed(results, lang, interaction, newPage);
                
                // Không tạo resultId mới, component không cần resultId vì chúng ta dùng footer
                const components = xosoCommand.createComponents(newPage, totalPages, "");
                
                await interaction.editReply({
                        embeds: [newEmbed],
                        components: components,
                });
        } catch (error) {
                console.error("[XOSO_NEXT] Error:", error);
                // Nếu chưa defer, dùng reply; nếu đã defer, dùng editReply
                const hasDeferred = interaction.deferred || interaction.replied;
                if (hasDeferred) {
                        await interaction.editReply({
                                content: "❌ Lỗi khi chuyển trang. Vui lòng thử lại hoặc sử dụng lệnh `/xoso` mới!",
                                embeds: [],
                                components: []
                        }).catch(() => {});
                } else {
                        await interaction.reply({
                                content: "❌ Lỗi khi chuyển trang. Vui lòng thử lại hoặc sử dụng lệnh `/xoso` mới!",
                                ephemeral: true
                        }).catch(() => {});
                }
        }
};
