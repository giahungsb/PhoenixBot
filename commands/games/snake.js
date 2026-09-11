const { Snake } = require("discord-gamecord");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "snake",
        description: "Trò chơi rắn săn mồi",
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
        const ZiRank = useFunctions().get("ZiRank");
        const Game = new Snake({
                message: interaction,
                isSlashGame: true,
                embed: {
                        title: "Rắn săn mồi",
                        overTitle: "Trò chơi kết thúc",
                        color: "#5865F2",
                },
                emojis: {
                        board: "⬛",
                        food: "🍎",
                        up: "⬆️",
                        down: "⬇️",
                        left: "⬅️",
                        right: "➡️",
                },
                snake: {
                        head: "🟢",
                        body: "🟩",
                        tail: "🟢",
                        skull: "💀",
                },
                foods: ["🍎", "🍇", "🍊", "🫐", "🥕", "🥝", "🌽"],
                stopButton: "🟥",
                timeoutTime: 60000,
                playerOnlyMessage: "Only {player} can use these buttons.",
        });

        Game.startGame();
        Game.on("gameOver", async (result) => {
                const { useDB } = require("@zibot/zihooks");
                const DataBase = useDB();
                
                if (result.result === "win") {
                        // Người thắng nhận tiền thông qua ZiRank (hoạt động an toàn)
                        await ZiRank.execute({ user: interaction.user, XpADD: 1, CoinADD: 100 });
                } else {
                        // Người thua sử dụng hoạt động nguyên tử với kiểm tra số dư
                        const deductResult = await DataBase.ZiUser.findOneAndUpdate(
                                { userID: interaction.user.id, coin: { $gte: 100 } },
                                { $inc: { coin: -100, xp: 1 } },
                                { new: true }
                        ).catch((error) => {
                                console.error(`Snake: Failed to deduct coins from user ${interaction.user.id}:`, error);
                                return null;
                        });
                        
                        if (!deductResult) {
                                // Người dùng không có đủ tiền, nhưng trò chơi đã được chơi
                                // Vẫn tặng XP cho việc tham gia
                                await ZiRank.execute({ user: interaction.user, XpADD: 1, CoinADD: 0 });
                        }
                }
        });
};
