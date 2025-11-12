const { PermissionsBitField, EmbedBuilder, ChannelType } = require("discord.js");
const { useDB, useFunctions } = require("@zibot/zihooks");
const { loadGoldPriceConfigs } = require("../../cron/goldPriceCron");

module.exports.data = {
        name: "goldprice",
        description: "📊 Cấu hình và quản lý giá vàng tự động",
        type: 1,
        options: [
                {
                        name: "setup",
                        description: "🔧 Thiết lập kênh nhận giá vàng tự động mỗi 15 phút",
                        type: 1,
                        options: [
                                {
                                        name: "channel",
                                        description: "Chọn kênh Discord để nhận thông tin giá vàng",
                                        type: 7,
                                        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
                                        required: true,
                                },
                        ],
                },
                {
                        name: "disable",
                        description: "🛑 Tắt cập nhật giá vàng tự động",
                        type: 1,
                },
                {
                        name: "status",
                        description: "📋 Xem cấu hình hiện tại",
                        type: 1,
                },
        ],
        integration_types: [0],
        contexts: [0],
};

module.exports.execute = async ({ interaction, lang }) => {
        if (!interaction.guild) {
                return interaction.reply({
                        content: "❌ Lệnh này chỉ có thể sử dụng trong máy chủ!",
                        ephemeral: true,
                });
        }

        const database = useDB();
        const subcommand = interaction.options.getSubcommand();
        const user = await interaction.guild.members.fetch(interaction.user);

        if (!user.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({
                        content: "❌ Bạn cần quyền **Quản lý máy chủ** để sử dụng lệnh này!",
                        ephemeral: true,
                });
        }

        await interaction.deferReply({ ephemeral: true });

        if (!database) {
                return interaction.editReply({
                        content: "❌ Database hiện không được bật, vui lòng liên hệ dev bot!",
                });
        }

        try {
                switch (subcommand) {
                        case "setup": {
                                const channel = interaction.options.getChannel("channel");

                                const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                                const permissions = channel.permissionsFor(botMember);

                                if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
                                        return interaction.editReply({
                                                content: `❌ Bot không có quyền **Gửi tin nhắn** trong kênh <#${channel.id}>!`,
                                        });
                                }

                                if (!permissions.has(PermissionsBitField.Flags.EmbedLinks)) {
                                        return interaction.editReply({
                                                content: `❌ Bot không có quyền **Nhúng liên kết** trong kênh <#${channel.id}>!`,
                                        });
                                }

                                await database.ZiGoldPrice.updateOne(
                                        { guildId: interaction.guildId },
                                        {
                                                $set: {
                                                        channelId: channel.id,
                                                        enabled: true,
                                                        lastMessageId: null,
                                                        lastFetchedAt: null,
                                                },
                                        },
                                        { upsert: true }
                                );

                                await loadGoldPriceConfigs();

                                const setupEmbed = new EmbedBuilder()
                                        .setTitle("✅ Đã thiết lập giá vàng tự động!")
                                        .setColor("#00FF00")
                                        .setDescription(
                                                `🏆 **Kênh:** <#${channel.id}>\n\n` +
                                                `⏰ **Tần suất cập nhật:** Mỗi 15 phút\n` +
                                                `📊 **Nguồn dữ liệu:** giavang.org\n` +
                                                `💰 **Hệ thống:** SJC, PNJ, DOJI, Bảo Tín Minh Châu, Bảo Tín Mạnh Hải, Phú Quý, Mi Hồng, Ngọc Thẩm\n\n` +
                                                `🔔 Bot sẽ tự động gửi cập nhật giá vàng vào kênh này.`
                                        )
                                        .setFooter({ text: "Sử dụng /goldprice disable để tắt" })
                                        .setTimestamp();

                                await interaction.editReply({ embeds: [setupEmbed] });
                                break;
                        }

                        case "disable": {
                                const config = await database.ZiGoldPrice.findOne({ guildId: interaction.guildId });

                                if (!config || !config.enabled) {
                                        return interaction.editReply({
                                                content: "❌ Giá vàng tự động chưa được thiết lập hoặc đã bị tắt!",
                                        });
                                }

                                await database.ZiGoldPrice.updateOne(
                                        { guildId: interaction.guildId },
                                        { $set: { enabled: false } }
                                );

                                await loadGoldPriceConfigs();

                                const disableEmbed = new EmbedBuilder()
                                        .setTitle("🛑 Đã tắt giá vàng tự động")
                                        .setColor("#FF0000")
                                        .setDescription("✅ Bot sẽ không còn gửi cập nhật giá vàng tự động nữa.")
                                        .setFooter({ text: "Sử dụng /goldprice setup để bật lại" })
                                        .setTimestamp();

                                await interaction.editReply({ embeds: [disableEmbed] });
                                break;
                        }

                        case "status": {
                                const config = await database.ZiGoldPrice.findOne({ guildId: interaction.guildId });

                                if (!config) {
                                        return interaction.editReply({
                                                content: "❌ Giá vàng tự động chưa được thiết lập! Sử dụng `/goldprice setup` để bắt đầu.",
                                        });
                                }

                                const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
                                const statusEmoji = config.enabled ? "🟢" : "🔴";
                                const statusText = config.enabled ? "Đang hoạt động" : "Đã tắt";

                                const statusEmbed = new EmbedBuilder()
                                        .setTitle("📊 Trạng thái giá vàng tự động")
                                        .setColor(config.enabled ? "#00FF00" : "#FF0000")
                                        .addFields(
                                                { name: "Trạng thái", value: `${statusEmoji} ${statusText}`, inline: true },
                                                { name: "Kênh", value: channel ? `<#${channel.id}>` : "❌ Không tìm thấy", inline: true },
                                                { name: "Lần cập nhật cuối", value: config.lastFetchedAt ? `<t:${Math.floor(new Date(config.lastFetchedAt).getTime() / 1000)}:R>` : "Chưa có", inline: false }
                                        )
                                        .setFooter({ text: "giavang.org • Cập nhật mỗi 15 phút" })
                                        .setTimestamp();

                                await interaction.editReply({ embeds: [statusEmbed] });
                                break;
                        }
                }
        } catch (error) {
                console.error("[GOLDPRICE CMD] Error:", error);
                await interaction.editReply({
                        content: "❌ Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại sau!",
                });
        }
};
