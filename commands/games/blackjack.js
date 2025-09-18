const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require("discord.js");
const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "blackjack",
        description: "Chơi trò chơi blackjack",
        type: 1, // lệnh slash
        options: [
                {
                        name: "opponent",
                        description: "Người bạn muốn thách đấu",
                        type: 6,
                        required: false,
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
        const { useDB } = require("@zibot/zihooks");
        const DataBase = useDB();
        const ZiRank = useFunctions().get("ZiRank");
        const opponent = interaction.options.getUser("opponent");
        if (opponent && (opponent.bot || opponent.id === interaction.user.id))
                return interaction.reply({ content: "Bạn không thể thách đấu người này.", ephemeral: true });
        
        // Kiểm tra xem người chơi có đủ tiền để chơi không (yêu cầu tối thiểu 100 đồng xu)
        const minCoins = 100;
        const playerDB = await DataBase.ZiUser.findOne({ userID: interaction.user.id });
        const playerBalance = playerDB?.coin || 0;
        
        if (playerBalance < minCoins) {
                const errorEmbed = new EmbedBuilder()
                        .setTitle("❌ Không đủ ZiGold")
                        .setColor("#FF0000")
                        .setDescription(`Bạn cần ít nhất **${minCoins.toLocaleString()} ZiGold** để chơi Blackjack! Bạn hiện có **${playerBalance.toLocaleString()} ZiGold**.\n\nSử dụng \`\`\`text\n/daily\n\`\`\` để nhận ZiGold miễn phí!`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        // Kiểm tra số dư của đối thủ nếu chơi với ai đó
        if (opponent) {
                const opponentDB = await DataBase.ZiUser.findOne({ userID: opponent.id });
                const opponentBalance = opponentDB?.coin || 0;
                if (opponentBalance < minCoins) {
                        const errorEmbed = new EmbedBuilder()
                                .setTitle("❌ Đối thủ không đủ ZiGold")
                                .setColor("#FF0000")
                                .setDescription(`${opponent.username} cần ít nhất **${minCoins.toLocaleString()} ZiGold** để chơi! Họ hiện có **${opponentBalance.toLocaleString()} ZiGold**.`);
                        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
        }
        
        const players = [interaction.user];
        if (opponent) players.push(opponent);

        const createDeck = () => {
                const suits = ["♠️", "♥️", "♦️", "♣️"];
                const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
                const deck = [];
                for (const suit of suits) {
                        for (const rank of ranks) {
                                deck.push({ suit, rank });
                        }
                }
                return deck;
        };

        const shuffle = (array) => {
                for (let i = array.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
        };

        const handValue = (hand) => {
                let value = 0;
                let aces = 0;
                for (const card of hand) {
                        if (card.rank === "A") {
                                value += 11;
                                aces += 1;
                        } else if (["K", "Q", "J"].includes(card.rank)) {
                                value += 10;
                        } else {
                                value += Number(card.rank);
                        }
                }
                while (value > 21 && aces) {
                        value -= 10;
                        aces -= 1;
                }
                return value;
        };

        const formatHand = (hand) => hand.map((c) => `${c.rank}${c.suit}`).join(" ");

        const deck = shuffle(createDeck());
        const dealerHand = [deck.pop(), deck.pop()];
        const dealerState = { blackjack: false, natural21: false };
        if (dealerHand[0].rank === "A" && dealerHand[1].rank === "A") {
                dealerState.blackjack = true;
        } else if (handValue(dealerHand) === 21) {
                dealerState.natural21 = true;
        }
        const playerHands = {};
        const playerStates = {};
        players.forEach((p) => {
                const hand = [deck.pop(), deck.pop()];
                playerHands[p.id] = hand;
                const state = { stand: false, bust: false, blackjack: false, natural21: false };
                if (hand[0].rank === "A" && hand[1].rank === "A") {
                        state.blackjack = true;
                        state.stand = true;
                } else if (handValue(hand) === 21) {
                        state.natural21 = true;
                        state.stand = true;
                }
                playerStates[p.id] = state;
        });

        const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("hit").setLabel("Rút").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("stand").setLabel("Dừng").setStyle(ButtonStyle.Danger),
        );
        let currentPlayerIndex = 0;
        const advanceToNextPlayer = () => {
                while (currentPlayerIndex < players.length && playerStates[players[currentPlayerIndex].id].stand) {
                        currentPlayerIndex++;
                }
        };
        advanceToNextPlayer();

        const renderDescription = (revealDealer = false) => {
                const lines = players.map((p) => {
                        const label = players.length === 1 ? "bạn" : p.toString();
                        const hand = playerHands[p.id];
                        const state = playerStates[p.id];
                        const total = state.blackjack ? "Xì bàn" : handValue(hand);
                        return `**Bài của ${label}**: ${formatHand(hand)} (Tổng: ${total})`;
                });
                const dealerTotal = dealerState.blackjack ? "Xì bàn" : handValue(dealerHand);
                const dealerShown = revealDealer ? `${formatHand(dealerHand)} (Tổng: ${dealerTotal})` : `${formatHand([dealerHand[0]])} ??`;
                lines.push(`**Bài của nhà cái**: ${dealerShown}`);
                if (!revealDealer && players.length > 1 && currentPlayerIndex < players.length) {
                        lines.push(`**Lượt hiện tại**: ${players[currentPlayerIndex]}`);
                }

                return lines.join("\n");
        };

        let embed = new EmbedBuilder().setTitle("Blackjack").setColor("#5865F2").setDescription(renderDescription());
        const replyPayload = { embeds: [embed], components: [buttons] };

        if (opponent) replyPayload.content = `${opponent}, bạn được mời chơi Blackjack!`;
        await interaction.reply(replyPayload);
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
        });

        const endGame = async (fields) => {
                buttons.components.forEach((btn) => btn.setDisabled(true));

                embed = new EmbedBuilder()
                        .setTitle("Blackjack")
                        .setColor("#5865F2")
                        .setDescription(renderDescription(true))
                        .addFields(fields);
                await interaction.editReply({ embeds: [embed], components: [buttons] });
                collector.stop("finished");
        };
        const nextPlayer = async () => {
                currentPlayerIndex++;
                advanceToNextPlayer();
                if (currentPlayerIndex >= players.length) {
                        await dealerTurn();
                } else {
                        embed = EmbedBuilder.from(embed).setDescription(renderDescription());
                        await interaction.editReply({ embeds: [embed], components: [buttons] });
                }
        };

        const dealerTurn = async () => {
                while (!dealerState.blackjack && !dealerState.natural21 && handValue(dealerHand) < 17) dealerHand.push(deck.pop());
                const dealerTotal = handValue(dealerHand);
                const results = players.map((p) => {
                        const hand = playerHands[p.id];
                        const total = handValue(hand);
                        const state = playerStates[p.id];
                        let result;
                        if (state.blackjack) {
                                result = dealerState.blackjack ? "tie" : "blackjack";
                        } else if (dealerState.blackjack) {
                                result = "lose";
                        } else if (state.bust) {
                                result = "lose";
                        } else if (dealerState.natural21) {
                                result = state.natural21 ? "tie" : "lose";
                        } else if (state.natural21) {
                                result = dealerTotal === 21 ? "tie" : "win";
                        } else if (dealerTotal > 21 || total > dealerTotal) {
                                result = "win";
                        } else if (total === dealerTotal) {
                                result = "tie";
                        } else {
                                result = "lose";
                        }
                        return { user: p, result };
                });
                const resultFields = results.map((r) => ({
                        name: r.user.username,
                        value:
                                r.result === "blackjack" ? "Xì bàn"
                                : r.result === "win" ? "Thắng"
                                : r.result === "tie" ? "Hòa"
                                : "Thua",
                        inline: true,
                }));
                // Update coins using atomic operations with balance validation
                await Promise.all(
                        results.map(async ({ user, result }) => {
                                const CoinADD =
                                        result === "blackjack" ? 150
                                        : result === "win" ? 100
                                        : result === "lose" ? -100
                                        : 0;
                                
                                if (CoinADD < 0) {
                                        // For losses, use atomic operation with balance validation
                                        await DataBase.ZiUser.findOneAndUpdate(
                                                { userID: user.id, coin: { $gte: Math.abs(CoinADD) } },
                                                { $inc: { coin: CoinADD, xp: 1 } },
                                                { new: true }
                                        );
                                } else if (CoinADD > 0) {
                                        // For wins, just add coins
                                        return ZiRank.execute({ user, XpADD: 1, CoinADD });
                                } else {
                                        // For ties, just add XP
                                        return ZiRank.execute({ user, XpADD: 1, CoinADD: 0 });
                                }
                        }),
                );
                await endGame(resultFields);
        };

        collector.on("collect", async (i) => {
                const player = players[currentPlayerIndex];
                if (i.user.id !== player.id) {
                        return i.reply({ content: `Chỉ ${player} mới có thể sử dụng các nút này.`, ephemeral: true });
                }
                await i.deferUpdate();
                const hand = playerHands[player.id];
                if (i.customId === "hit") {
                        hand.push(deck.pop());
                        const total = handValue(hand);
                        if (total > 21) {
                                playerStates[player.id].bust = true;
                                await nextPlayer();
                        } else {
                                embed = EmbedBuilder.from(embed).setDescription(renderDescription());
                                await interaction.editReply({ embeds: [embed], components: [buttons] });
                        }
                } else if (i.customId === "stand") {
                        playerStates[player.id].stand = true;
                        await nextPlayer();
                }
        });

        collector.on("end", async (_, reason) => {
                if (reason === "time") {
                        buttons.components.forEach((btn) => btn.setDisabled(true));
                        const finalEmbed = EmbedBuilder.from(embed).setFooter({ text: "Trò chơi đã hết thời gian!" });
                        await interaction.editReply({ embeds: [finalEmbed], components: [buttons] });
                }
        });

        if (currentPlayerIndex >= players.length) {
                await dealerTurn();
        }
};
