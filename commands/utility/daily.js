const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { useFunctions, useDB, useConfig } = require("@zibot/zihooks");

const zigoldEmoji = "🪙"; // Biểu tượng ZiGold
const streakEmoji = "🔥"; // Biểu tượng streak
const rankEmoji = "🏆"; // Biểu tượng xếp hạng
const sparkleEmoji = "✨"; // Biểu tượng lấp lánh
const gemEmoji = "💎"; // Biểu tượng kim cương
const crownEmoji = "👑"; // Biểu tượng vương miện
const starEmoji = "⭐"; // Biểu tượng ngôi sao
const rocketEmoji = "🚀"; // Biểu tượng tên lửa
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 giờ tính bằng milliseconds
const BASE_DAILY_REWARD = 500;
const STREAK_BONUS_MULTIPLIER = 1.2; // 20% bonus per streak day
const MAX_STREAK_BONUS = 7; // Max 7 days for streak bonus

module.exports.data = {
        name: "daily",
        description: "Nhận phần thưởng ZiGold hàng ngày với streak bonus và ranking",
        type: 1,
        options: [],
        integration_types: [0, 1], // Guild app + User app  
        contexts: [0, 1, 2], // Guild + DM + Private channels
        dm_permission: true,
        nsfw: false,
};

/**
 * @param { object } command - object command
 * @param { import("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import("../../lang/vi.js") } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
        try {
                const ZiRank = useFunctions().get("ZiRank");
                const DataBase = useDB();
                const config = useConfig();

                // Check if database and functions are properly initialized
                if (!DataBase || !DataBase.ZiUser || !ZiRank) {
                        return await handleInitializationError(interaction, !DataBase);
                }

                const userId = interaction.user.id;
                const guildId = interaction.guild?.id;
                const now = new Date();

                // Get user data with ZiRank integration
                let userLang;
                try {
                        userLang = await ZiRank.execute({ user: interaction.user, XpADD: 0, CoinADD: 0 });
                } catch (error) {
                        console.error("Error calling ZiRank:", error);
                        userLang = lang;
                }

                const userDB = await DataBase.ZiUser.findOne({ userID: userId });

                // Check cooldown
                const cooldownCheck = checkDailyCooldown(userDB, now);
                if (cooldownCheck.onCooldown) {
                        return await showCooldownMessage(interaction, cooldownCheck, userDB);
                }

                // Calculate streak
                const streakData = calculateStreak(userDB, now);
                
                // Calculate rewards with advanced bonus system
                const rewardData = calculateAdvancedRewards(userDB, streakData, guildId);

                // Update user data with ZiRank integration
                const updateResult = await updateUserDaily(DataBase, userId, now, rewardData, streakData);
                
                if (!updateResult.success) {
                        return await showAlreadyClaimedMessage(interaction);
                }

                // Call ZiRank to handle XP and level progression
                const updatedLang = await ZiRank.execute({ 
                        user: interaction.user, 
                        XpADD: rewardData.xpReward,
                        CoinADD: 0 // We handle coins separately for better control
                });

                // Get updated user data after ZiRank processing
                const finalUserData = await DataBase.ZiUser.findOne({ userID: userId });

                // Check for level up
                const levelUpInfo = checkLevelUp(userDB, finalUserData);

                // Generate server ranking info if in guild
                const rankingInfo = guildId ? await getServerRanking(DataBase, userId, guildId) : null;

                // Send success message with full integration
                await sendDailySuccessMessage(
                        interaction, 
                        rewardData, 
                        streakData, 
                        finalUserData, 
                        levelUpInfo,
                        rankingInfo,
                        updatedLang || userLang
                );

        } catch (error) {
                console.error("Error in daily command:", error);
                await handleCommandError(interaction, error);
        }
};

async function handleInitializationError(interaction, isDatabaseError) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`⚠️ ${sparkleEmoji} Khởi tạo hệ thống`)
                .setColor("#FFD700")
                .setDescription(
                        isDatabaseError 
                        ? `🔄 **Database đang khởi tạo...**\n\n${sparkleEmoji} Vui lòng đợi vài giây rồi thử lại!`
                        : `🔄 **Hệ thống ZiRank đang khởi tạo...**\n\n${sparkleEmoji} Vui lòng đợi vài giây rồi thử lại!`
                )
                .setFooter({ 
                        text: "Hệ thống sẽ sẵn sàng trong giây lát!", 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
        
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

function checkDailyCooldown(userDB, now) {
        if (!userDB?.lastDaily) {
                return { onCooldown: false };
        }

        const lastDaily = new Date(userDB.lastDaily);
        const timeDiff = now.getTime() - lastDaily.getTime();
        
        if (timeDiff < DAILY_COOLDOWN) {
                const timeLeft = DAILY_COOLDOWN - timeDiff;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const secondsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                return {
                        onCooldown: true,
                        timeLeft: { hours: hoursLeft, minutes: minutesLeft, seconds: secondsLeft },
                        totalTimeLeft: timeLeft
                };
        }
        
        return { onCooldown: false };
}

async function showCooldownMessage(interaction, cooldownCheck, userDB) {
        const { hours, minutes, seconds } = cooldownCheck.timeLeft;
        const nextResetTime = Math.floor((Date.now() + cooldownCheck.totalTimeLeft) / 1000);
        const streakCount = userDB?.dailyStreak || 0;
        
        const cooldownEmbed = new EmbedBuilder()
                .setTitle(`⏰ ${gemEmoji} Daily Cooldown ${streakEmoji}`)
                .setColor("#FF6B9D")
                .setDescription(`**${sparkleEmoji} Bạn đã nhận phần thưởng daily hôm nay rồi!**\n\n🎯 Hãy quay lại sau để duy trì streak ${streakCount >= 7 ? crownEmoji : streakEmoji}`)
                .addFields(
                        {
                                name: `⏳ ${sparkleEmoji} Thời gian còn lại`,
                                value: `\`\`\`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s\`\`\``,
                                inline: true
                        },
                        {
                                name: `🔄 ${rocketEmoji} Reset lúc`,
                                value: `<t:${nextResetTime}:t>\n<t:${nextResetTime}:R>`,
                                inline: true
                        },
                        {
                                name: `${streakEmoji} Streak hiện tại`,
                                value: `**${streakCount} ngày** ${streakCount >= 7 ? `\n${crownEmoji} Streak Master!` : streakCount >= 3 ? `\n${starEmoji} Tốt lắm!` : "\n💪 Tiếp tục!"}`,
                                inline: true
                        }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                        text: `${streakEmoji} Duy trì streak để nhận thêm bonus! • ZiBot Daily System`,
                        iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

        return await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
}

function calculateStreak(userDB, now) {
        const lastDaily = userDB?.lastDaily ? new Date(userDB.lastDaily) : null;
        const currentStreak = userDB?.dailyStreak || 0;
        
        if (!lastDaily) {
                // First time claiming
                return { newStreak: 1, streakBroken: false, isFirstTime: true };
        }
        
        const daysDiff = Math.floor((now.getTime() - lastDaily.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff === 1) {
                // Perfect! Next day claim
                return { newStreak: currentStreak + 1, streakBroken: false, isFirstTime: false };
        } else if (daysDiff > 1) {
                // Streak broken
                return { newStreak: 1, streakBroken: true, isFirstTime: false, daysMissed: daysDiff - 1 };
        } else {
                // Same day (shouldn't happen due to cooldown check)
                return { newStreak: currentStreak, streakBroken: false, isFirstTime: false };
        }
}

function calculateAdvancedRewards(userDB, streakData, guildId) {
        const userLevel = userDB?.level || 1;
        const baseReward = BASE_DAILY_REWARD;
        
        // Level bonus (50 per level)
        const levelBonus = (userLevel - 1) * 50;
        
        // Streak bonus (capped at MAX_STREAK_BONUS days)
        const streakDays = Math.min(streakData.newStreak, MAX_STREAK_BONUS);
        const streakMultiplier = 1 + ((streakDays - 1) * (STREAK_BONUS_MULTIPLIER - 1) / (MAX_STREAK_BONUS - 1));
        const streakBonus = Math.floor(baseReward * (streakMultiplier - 1));
        
        // Guild bonus (if in server)
        const guildBonus = guildId ? Math.floor(baseReward * 0.1) : 0;
        
        // Weekend bonus (Saturday & Sunday)
        const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
        const weekendBonus = isWeekend ? Math.floor(baseReward * 0.15) : 0;
        
        // Total calculation
        const totalZiGold = baseReward + levelBonus + streakBonus + guildBonus + weekendBonus;
        
        // XP reward scales with level and streak
        const baseXP = 25;
        const xpStreakBonus = Math.floor(streakData.newStreak * 2);
        const xpLevelBonus = Math.floor(userLevel * 1.5);
        const totalXP = baseXP + xpStreakBonus + xpLevelBonus;
        
        return {
                baseReward,
                levelBonus,
                streakBonus,
                guildBonus,
                weekendBonus,
                totalZiGold,
                xpReward: totalXP,
                breakdown: {
                        streakMultiplier,
                        isWeekend
                }
        };
}

async function updateUserDaily(DataBase, userId, now, rewardData, streakData) {
        try {
                // Use findOneAndUpdate with specific conditions to prevent race conditions
                const result = await DataBase.ZiUser.findOneAndUpdate(
                        {
                                userID: userId,
                                $or: [
                                        { lastDaily: { $exists: false } },
                                        { lastDaily: { $lte: new Date(now.getTime() - DAILY_COOLDOWN) } }
                                ]
                        },
                        {
                                $set: { 
                                        lastDaily: now,
                                        dailyStreak: streakData.newStreak,
                                        name: userId // Ensure name is set for ranking
                                },
                                $inc: { 
                                        coin: rewardData.totalZiGold
                                },
                                $setOnInsert: {
                                        level: 1,
                                        xp: 1,
                                        volume: 100,
                                        color: "Random"
                                }
                        },
                        { 
                                new: true, 
                                upsert: true,
                                setDefaultsOnInsert: true
                        }
                );
                
                return { success: !!result, userData: result };
        } catch (error) {
                console.error("Database update error:", error);
                return { success: false, error };
        }
}

async function showAlreadyClaimedMessage(interaction) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Đã nhận rồi!`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Bạn đã nhận phần thưởng daily hoặc có lỗi xảy ra.\n\n🔄 Vui lòng thử lại sau vài giây!`)
                .setFooter({ 
                        text: "Nếu vấn đề vẫn tiếp tục, hãy liên hệ admin!", 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
                
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
}

function checkLevelUp(oldUserData, newUserData) {
        if (!oldUserData || !newUserData) return { leveledUp: false };
        
        const oldLevel = oldUserData.level || 1;
        const newLevel = newUserData.level || 1;
        
        if (newLevel > oldLevel) {
                return {
                        leveledUp: true,
                        oldLevel,
                        newLevel,
                        levelUpReward: newLevel * 100 // ZiRank gives this as bonus
                };
        }
        
        return { leveledUp: false };
}

async function getServerRanking(DataBase, userId, guildId) {
        try {
                // Get top 10 users in server by coins (simplified ranking)
                const topUsers = await DataBase.ZiUser.find({})
                        .sort({ coin: -1, level: -1, xp: -1 })
                        .limit(10)
                        .lean();
                
                // Find user's rank
                const userRank = topUsers.findIndex(user => user.userID === userId) + 1;
                
                return {
                        userRank: userRank || "Chưa xếp hạng",
                        totalInTop10: userRank > 0 && userRank <= 10,
                        topUsers: topUsers.slice(0, 3) // Top 3 for display
                };
        } catch (error) {
                console.error("Ranking calculation error:", error);
                return null;
        }
}

async function sendDailySuccessMessage(interaction, rewardData, streakData, userData, levelUpInfo, rankingInfo, lang) {
        const userName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
        
        // Determine embed color based on rewards
        let embedColor = userData?.color || "#00FF7F";
        if (levelUpInfo.leveledUp) embedColor = "#FFD700"; // Gold for level up
        else if (rewardData.totalZiGold >= 1000) embedColor = "#FF6B9D"; // Pink for high rewards
        else if (streakData.newStreak >= 7) embedColor = "#9B59B6"; // Purple for streak master
        
        // Main embed
        const successEmbed = new EmbedBuilder()
                .setTitle(`${zigoldEmoji} ${gemEmoji} Daily Reward Claimed! ${streakEmoji} ${sparkleEmoji}`)
                .setColor(embedColor)
                .setDescription(`**${crownEmoji} ${userName}** đã nhận phần thưởng daily thành công!

${rocketEmoji} *Chúc mừng bạn đã hoàn thành nhiệm vụ hàng ngày!*`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

        // Reward breakdown with beautiful formatting
        let rewardText = `\`\`\`💰 TỔNG ZIGOLD: ${rewardData.totalZiGold.toLocaleString()}\`\`\`\n`;
        rewardText += `${gemEmoji} **Phần thưởng cơ bản:** \`${rewardData.baseReward.toLocaleString()}\`\n`;
        if (rewardData.levelBonus > 0) rewardText += `${starEmoji} **Level bonus:** \`+${rewardData.levelBonus.toLocaleString()}\`\n`;
        if (rewardData.streakBonus > 0) rewardText += `${streakEmoji} **Streak bonus:** \`+${rewardData.streakBonus.toLocaleString()}\`\n`;
        if (rewardData.guildBonus > 0) rewardText += `🏰 **Server bonus:** \`+${rewardData.guildBonus.toLocaleString()}\`\n`;
        if (rewardData.weekendBonus > 0) rewardText += `🎉 **Weekend bonus:** \`+${rewardData.weekendBonus.toLocaleString()}\`\n`;
        
        successEmbed.addFields({
                name: `${gemEmoji} ${sparkleEmoji} Chi tiết phần thưởng`,
                value: rewardText,
                inline: false
        });

        // User stats with better formatting
        const statsText = `${zigoldEmoji} **Số dư:** \`${userData.coin?.toLocaleString() || 0}\` ZiGold\n${starEmoji} **Level:** \`${userData.level || 1}\`\n${sparkleEmoji} **XP:** \`${userData.xp?.toLocaleString() || 1}\``;
        successEmbed.addFields({
                name: `📊 ${crownEmoji} Thống kê của bạn`, 
                value: statsText,
                inline: true
        });

        // Streak info with dynamic emojis and encouragement
        let streakText = "";
        if (streakData.isFirstTime) {
                streakText = `🎉 **Lần đầu tiên!**\n${sparkleEmoji} Chào mừng đến với daily system!`;
        } else if (streakData.streakBroken) {
                streakText = `💔 **Streak bị reset!**\n${rocketEmoji} **Mới:** \`${streakData.newStreak}\` ngày\n💪 Bắt đầu lại nào!`;
        } else {
                const streakIcon = streakData.newStreak >= 30 ? "🏆" : streakData.newStreak >= 14 ? "👑" : streakData.newStreak >= 7 ? "🔥" : "⚡";
                const encouragement = streakData.newStreak >= 30 ? "Huyền thoại!" : streakData.newStreak >= 14 ? "Siêu sao!" : streakData.newStreak >= 7 ? "Streak tuyệt vời!" : "Tiếp tục phát huy!";
                streakText = `${streakIcon} **\`${streakData.newStreak}\` ngày**\n${sparkleEmoji} ${encouragement}`;
        }
                
        successEmbed.addFields({
                name: `${streakEmoji} ${gemEmoji} Daily Streak`,
                value: streakText,
                inline: true
        });

        // Level up notification with celebration
        if (levelUpInfo.leveledUp) {
                successEmbed.addFields({
                        name: `🎆 ${crownEmoji} LEVEL UP! ${sparkleEmoji} 🎆`,
                        value: `${rocketEmoji} **Level ${levelUpInfo.oldLevel}** ➜ **Level ${levelUpInfo.newLevel}** ${starEmoji}\n${zigoldEmoji} **Bonus:** \`+${levelUpInfo.levelUpReward.toLocaleString()}\` ZiGold!\n${gemEmoji} *Bạn đã mạnh hơn rồi!*`,
                        inline: false
                });
        }

        // Server ranking (if available) with better formatting
        if (rankingInfo && interaction.guild) {
                let rankText = "";
                if (rankingInfo.userRank === "Chưa xếp hạng") {
                        rankText = `📊 Chưa có trong **Top 10**\n${rocketEmoji} Hãy tiếp tục cố gắng!`;
                } else {
                        const rankIcon = rankingInfo.userRank <= 3 ? "🏆" : rankingInfo.userRank <= 5 ? "🥈" : rankingInfo.userRank <= 10 ? "🥉" : "💪";
                        rankText = `${rankIcon} **Hạng #${rankingInfo.userRank}**${rankingInfo.totalInTop10 ? `\n${crownEmoji} Top 10 Server!` : ""}`;
                }
                        
                successEmbed.addFields({
                        name: `${rankEmoji} ${gemEmoji} Xếp hạng server`,
                        value: rankText,
                        inline: true
                });
        }

        // XP gained with better presentation
        successEmbed.addFields({
                name: `${sparkleEmoji} ${rocketEmoji} XP nhận được`,
                value: `**\`+${rewardData.xpReward}\`** XP\n${starEmoji} *Phát triển nhân vật!*`,
                inline: true
        });

        // Footer with next claim time and motivation
        const nextClaimTime = Math.floor((Date.now() + DAILY_COOLDOWN) / 1000);
        const motivationalMessages = [
                "Hãy tiếp tục duy trì streak nhé!",
                "Mỗi ngày là một cơ hội mới!",
                "Bạn đang làm rất tốt!",
                "Streak cao = phần thưởng lớn!",
                "Chúc bạn một ngày tuyệt vời!"
        ];
        const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        
        successEmbed.setFooter({
                text: `${streakEmoji} ${randomMessage} • Hẹn gặp lại lúc ${new Date(Date.now() + DAILY_COOLDOWN).toLocaleTimeString("vi-VN")} ngày mai • ZiBot`,
                iconURL: interaction.client.user.displayAvatarURL()
        });
        
        successEmbed.setTimestamp();

        // Action buttons with better styling
        const row = new ActionRowBuilder()
                .addComponents(
                        new ButtonBuilder()
                                .setCustomId('B_refProfile')
                                .setLabel('Xem Profile')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('👤'),
                        new ButtonBuilder()
                                .setCustomId('B_refLeaderboard')
                                .setLabel('Bảng xếp hạng')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('🏆'),
                        new ButtonBuilder()
                                .setCustomId('B_refDaily')
                                .setLabel('Streak Info')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(`${streakEmoji}`)
                );

        await interaction.reply({ embeds: [successEmbed], components: [row] });
}

async function handleCommandError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${gemEmoji} Lỗi hệ thống`)
                .setColor("#FF4757")
                .setDescription(`**Oops!** ${sparkleEmoji} Đã xảy ra lỗi khi xử lý lệnh daily.\n\n🔄 **Vui lòng thử lại sau** hoặc liên hệ admin nếu vấn đề vẫn tiếp tục!\n\n${rocketEmoji} *Chúng tôi đang làm việc để khắc phục sự cố.*`)
                .addFields({
                        name: "🛠️ Hướng dẫn khắc phục",
                        value: `• Đợi vài giây rồi thử lại\n• Kiểm tra kết nối mạng\n• Liên hệ admin nếu cần hỗ trợ`,
                        inline: false
                })
                .setFooter({ 
                        text: `${sparkleEmoji} ZiBot luôn cố gắng mang đến trải nghiệm tốt nhất!`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
        
        const errorResponse = { embeds: [errorEmbed], ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse).catch(() => {});
        } else {
                await interaction.reply(errorResponse).catch(() => {});
        }
}