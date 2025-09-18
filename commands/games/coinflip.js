const { EmbedBuilder } = require("discord.js");
const { useFunctions, useDB } = require("@zibot/zihooks");
const { updateQuestProgress } = require("./quests");

const maxBet = 250000;
const zigold = "🪙"; // Biểu tượng ZiGold
const spin = "🔄"; // Biểu tượng quay cho hoạt hình
const heads = "🟦"; // Hình vuông xanh cho mặt ngửa
const tails = "🟥"; // Hình vuông đỏ cho mặt sấp

module.exports.data = {
        name: "coinflip",
        description: "Trò chơi tung đồng xu với hệ thống cược",
        type: 1,
        options: [
                {
                        name: "side",
                        description: "Chọn mặt đồng xu",
                        type: 3,
                        required: true,
                        choices: [
                                { name: "Ngửa (Heads)", value: "heads" },
                                { name: "Sấp (Tails)", value: "tails" },
                        ],
                },
                {
                        name: "bet",
                        description: "Số tiền cược (mặc định: 100)",
                        type: 4,
                        required: false,
                        min_value: 1,
                        max_value: maxBet,
                },
        ],
        integration_types: [0],
        contexts: [0, 1],
};

/**
 * @param { object } command - object command
 * @param { import("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import("../../lang/vi.js") } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
        const DataBase = useDB();
        const choice = interaction.options.getString("side");
        let bet = interaction.options.getInteger("bet") || 100;
        const words = lang?.Coinflip ?? {};
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

        // Xác thực số tiền cược
        if (bet <= 0) {
                const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Lỗi")
                        .setColor("#FF0000")
                        .setDescription("Bạn không thể cược số tiền <= 0!");
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (bet > maxBet) {
                bet = maxBet;
        }

        // Kiểm tra tình trạng cơ sở dữ liệu
        if (!DataBase) {
                const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Lỗi Database")
                        .setColor("#FF0000")
                        .setDescription("Không thể kết nối đến database. Vui lòng thử lại sau!");
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        try {
                // Kiểm tra xem người dùng có đủ ZiGold không
                const userDB = await DataBase.ZiUser.findOne({ userID: interaction.user.id });
                const userBalance = userDB?.coin || 0;

                if (userBalance < bet) {
                        const errorEmbed = new EmbedBuilder()
                                .setTitle("❌ Không đủ ZiGold")
                                .setColor("#FF0000")
                                .setDescription(
                                        `Bạn không có đủ ZiGold để cược! Bạn có **${userBalance.toLocaleString()} ZiGold** nhưng cần **${bet.toLocaleString()} ZiGold**.`,
                                )
                                .addFields({
                                        name: "💡 Gợi ý",
                                        value: "Sử dụng `/zigold` để kiểm tra số dư hoặc chơi các trò chơi khác để kiếm ZiGold!",
                                });
                        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const displayChoice = choice === "heads" ? (words.head ?? "Ngửa") : (words.tail ?? "Sấp");

                // Initial embed with spinning animation
                const spinningEmbed = new EmbedBuilder()
                        .setTitle(`${zigold} ZiGold Coinflip`)
                        .setColor("#FFD700")
                        .setDescription(
                                `**${userName}** đã cược **${zigold} ${bet.toLocaleString()} ZiGold** và chọn **${displayChoice}**\n\n${spin} Đồng xu đang quay...`,
                        )
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                const message = await interaction.reply({ embeds: [spinningEmbed], fetchReply: true });

                // Simulate coin flip delay for suspense
                setTimeout(async () => {
                        try {
                                // First, atomically deduct the bet amount
                                const deductResult = await DataBase.ZiUser.findOneAndUpdate(
                                        { userID: interaction.user.id, coin: { $gte: bet } },
                                        { $inc: { coin: -bet, xp: 1 } },
                                        { new: true, upsert: false },
                                );

                                if (!deductResult) {
                                        const errorEmbed = new EmbedBuilder()
                                                .setTitle("❌ Không đủ ZiGold")
                                                .setColor("#FF0000")
                                                .setDescription("Bạn không còn đủ ZiGold để thực hiện cược này!");
                                        return await message.edit({ embeds: [errorEmbed] });
                                }

                                const result = Math.random() < 0.5 ? "heads" : "tails";
                                const win = choice === result;
                                const displayResult = result === "heads" ? (words.head ?? "Ngửa") : (words.tail ?? "Sấp");
                                const resultEmoji = result === "heads" ? heads : tails;

                                let resultText = "";
                                let embedColor = "";
                                let newBalance = deductResult.coin;

                                if (win) {
                                        // Give back the bet + winnings atomically
                                        const winResult = await DataBase.ZiUser.findOneAndUpdate(
                                                { userID: interaction.user.id },
                                                { $inc: { coin: bet * 2 } },
                                                { new: true },
                                        );
                                        newBalance = winResult.coin;
                                        resultText = `${resultEmoji} **${displayResult}** - Bạn thắng **${zigold} ${bet.toLocaleString()} ZiGold**!`;
                                        embedColor = "#00FF00";
                                        
                                        // Update quest progress for gambling wins
                                        await updateQuestProgress(DataBase, interaction.user.id, 'gamble', 1);
                                } else {
                                        resultText = `${resultEmoji} **${displayResult}** - Bạn thua **${zigold} ${bet.toLocaleString()} ZiGold**... 😢`;
                                        embedColor = "#FF0000";
                                }

                                const finalEmbed = new EmbedBuilder()
                                        .setTitle(`${zigold} ZiGold Coinflip - Kết quả`)
                                        .setColor(embedColor)
                                        .setDescription(
                                                `**${userName}** đã cược **${zigold} ${bet.toLocaleString()} ZiGold** và chọn **${displayChoice}**\n\n` +
                                                        `🎯 ${words.result ?? "Kết quả"}: ${resultText}\n\n` +
                                                        `💰 Số dư mới: **${newBalance.toLocaleString()} ZiGold**`,
                                        )
                                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

                                await message.edit({ embeds: [finalEmbed] });
                        } catch (error) {
                                console.error("Coinflip error:", error);
                                const errorEmbed = new EmbedBuilder()
                                        .setTitle("❌ Lỗi")
                                        .setColor("#FF0000")
                                        .setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại!");
                                await message.edit({ embeds: [errorEmbed] });
                        }
                }, 2500); // 2.5 second delay for suspense
        } catch (error) {
                console.error("Coinflip error:", error);
                const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Lỗi")
                        .setColor("#FF0000")
                        .setDescription("Có lỗi xảy ra khi thực hiện lệnh. Vui lòng thử lại!");
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
};
