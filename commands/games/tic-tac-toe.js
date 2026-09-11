const { TicTacToe } = require("discord-gamecord");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "tic-tac-toe",
        description: "Chơi trò chơi cờ caro (tic-tac-toe)",
        type: 1, // lệnh slash
        options: [
                {
                        name: "opponent",
                        description: "Đối thủ của trò chơi",
                        type: 6,
                        required: true,
                },
        ],
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
        const Game = new TicTacToe({
                message: interaction,
                isSlashGame: true,
                opponent: interaction.options.getUser("opponent"),
                embed: {
                        title: "Trò chơi cờ Caro",
                        color: "#ffcc99",
                        statusTitle: "Trạng thái",
                        overTitle: "Trò chơi kết thúc",
                },
                emojis: {
                        xButton: "❌",
                        oButton: "🔵",
                        blankButton: "➖",
                },
                mentionUser: true,
                timeoutTime: 60000,
                xButtonStyle: "DANGER",
                oButtonStyle: "PRIMARY",
                mentionUser: true,
                timeoutTime: 60000,
                xButtonStyle: "DANGER",
                oButtonStyle: "PRIMARY",
                turnMessage: lang.TicTacToe.turnMessage,
                winMessage: lang.TicTacToe.winMessage,
                tieMessage: lang.TicTacToe.tieMessage,
                timeoutMessage: lang.TicTacToe.timeoutMessage,
                playerOnlyMessage: lang.TicTacToe.playerOnlyMessage,
        });

        Game.startGame();
        Game.on("gameOver", async (result) => {
                const { useDB } = require("@zibot/zihooks");
                const DataBase = useDB();
                const players = [result.player, result.opponent].filter(Boolean);
                
                if (result.result === "win" && result.winner) {
                        const winner = players.find((u) => u.id === result.winner);
                        const loser = players.find((u) => u.id !== result.winner);
                        
                        // Xử lý người thắng (chỉ thêm tiền) và người thua (trừ tiền nguyên tử) riêng biệt
                        const operations = [];
                        
                        // Người thắng nhận tiền thông qua ZiRank (hoạt động an toàn)
                        operations.push(ZiRank.execute({ user: winner, XpADD: 0, CoinADD: 100 }));
                        
                        // Người thua sử dụng hoạt động nguyên tử với kiểm tra số dư
                        operations.push(
                                DataBase.ZiUser.findOneAndUpdate(
                                        { userID: loser.id, coin: { $gte: 100 } },
                                        { $inc: { coin: -100, xp: 0 } },
                                        { new: true }
                                ).catch((error) => {
                                        console.error(`Tic-tac-toe: Failed to deduct coins from loser ${loser.id}:`, error);
                                        // Player doesn't have enough coins, but game was already played
                                        // Just log the error and continue
                                        return null;
                                })
                        );
                        
                        await Promise.all(operations);
                } else if (result.result === "tie") {
                        // Ties don't affect coins, just add minimal XP
                        await Promise.all(players.map((u) => ZiRank.execute({ user: u, XpADD: 1, CoinADD: 0 })));
                }
        });
};
