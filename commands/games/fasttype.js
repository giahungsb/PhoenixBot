const { FastType } = require("discord-gamecord");
const { sentence } = require("txtgen/dist/cjs/txtgen.js");
const { useFunctions } = require("@zibot/zihooks");
module.exports.data = {
        name: "fast-type",
        description: "Kiểm tra trình độ gõ của bạn",
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
        const sent = sentence();
        const Game = new FastType({
                message: interaction,
                isSlashGame: true,
                embed: {
                        title: "Fast Type",
                        color: "#5865F2",
                        description: "You have {time} seconds to type the sentence below.",
                },
                timeoutTime: 120000,
                sentence: sent,
                winMessage: "Bạn đã thắng với thời gian là {time} giây và wpm là {wpm}.",
                loseMessage: "Bạn đã thua!",
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
                                console.error(`FastType: Failed to deduct coins from user ${interaction.user.id}:`, error);
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
