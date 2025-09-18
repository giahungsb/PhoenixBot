const { TwoZeroFourEight } = require("discord-gamecord");
const icons = require("../../utility/icon");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "2048",
        description: "Trò chơi giải đố",
        type: 1, // lệnh slash
        integration_types: [0],
        contexts: [0, 1],
};
/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
        const { useDB } = require("@zibot/zihooks");
        const { EmbedBuilder } = require("discord.js");
        const DataBase = useDB();
        const ZiRank = useFunctions().get("ZiRank");
        
        // Kiểm tra xem người chơi có đủ tiền để chơi không (yêu cầu tối thiểu 100 đồng xu)
        const minCoins = 100;
        const playerDB = await DataBase.ZiUser.findOne({ userID: interaction.user.id });
        const playerBalance = playerDB?.coin || 0;
        
        if (playerBalance < minCoins) {
                const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Không đủ ZiGold")
                        .setColor("#FF0000")
                        .setDescription(`Bạn cần ít nhất **${minCoins.toLocaleString()} ZiGold** để chơi 2048! Bạn hiện có **${playerBalance.toLocaleString()} ZiGold**.\n\nSử dụng \`\`\`text\n/daily\n\`\`\` để nhận ZiGold miễn phí!`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        const Game = new TwoZeroFourEight({
                message: interaction,
                isSlashGame: true,
                embed: {
                        title: "2048",
                        color: "#5865F2",
                },
                emojis: {
                        up: `${icons.up}`,
                        down: `${icons.down}`,
                        left: `${icons.left}`,
                        right: `${icons.right}`,
                },
                timeoutTime: 60000,
                buttonStyle: "SECONDARY",
                playerOnlyMessage: "Only {player} can use these buttons.",
        });

        Game.startGame();
        Game.on("gameOver", async (result) => {
                const CoinADD = result.result === "win" ? 100 : -100;
                
                if (CoinADD < 0) {
                        // Đối với thua cuộc, sử dụng hoạt động nguyên tử với kiểm tra số dư
                        await DataBase.ZiUser.findOneAndUpdate(
                                { userID: interaction.user.id, coin: { $gte: Math.abs(CoinADD) } },
                                { $inc: { coin: CoinADD, xp: 1 } },
                                { new: true }
                        );
                } else {
                        // Đối với thắng cuộc, chỉ cần thêm tiền
                        await ZiRank.execute({ user: interaction.user, XpADD: 1, CoinADD });
                }
        });
};
