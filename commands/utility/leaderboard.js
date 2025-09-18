const { AttachmentBuilder } = require("discord.js");
const { useDB, useConfig } = require("@zibot/zihooks");
const { Worker } = require("worker_threads");

async function buildImageInWorker(workerData) {
        return new Promise((resolve, reject) => {
                const worker = new Worker("./utility/LeaderboardCard.js", {
                        workerData,
                });

                worker.on("message", (arrayBuffer) => {
                        try {
                                const buffer = Buffer.from(arrayBuffer);
                                if (!Buffer.isBuffer(buffer)) {
                                        throw new Error("Received data is not a buffer");
                                }
                                const attachment = new AttachmentBuilder(buffer, { name: "Leaderboard.png" });
                                resolve(attachment);
                        } catch (error) {
                                reject(error);
                        } finally {
                                worker.postMessage("terminate");
                        }
                });

                worker.on("error", reject);

                worker.on("exit", (code) => {
                        if (code !== 0) {
                                reject(new Error(`Worker stopped with exit code ${code}`));
                        }
                });
        });
}

module.exports.data = {
        name: "leaderboard",
        description: "View leaderboard với nhiều danh mục khác nhau!",
        options: [
                {
                        type: 3,
                        name: "type",
                        description: "Loại leaderboard muốn xem",
                        required: false,
                        choices: [
                                { name: "🏆 Level & XP", value: "level" },
                                { name: "🪙 ZiGold", value: "zigold" },
                                { name: "🦁 Total Animals", value: "animals" },
                                { name: "🏹 Hunt Count", value: "hunts" },
                                { name: "🔥 Daily Streak", value: "streak" },
                                { name: "💖 Pet Care", value: "petcare" }
                        ]
                }
        ],
        integration_types: [0, 1],
        contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
        await interaction.deferReply();

        const db = useDB();
        if (!db) return interaction.editReply({ content: lang?.until?.noDB, ephemeral: true }).catch(() => {});

        const leaderboardType = interaction.options?.getString("type") || "level";
        
        try {
                // Get all users with proper error handling
                const allUsers = await db.ZiUser.find({}).lean();
                
                if (!allUsers || allUsers.length === 0) {
                        return interaction.editReply({ 
                                content: "Chưa có dữ liệu leaderboard. Hãy sử dụng các lệnh game để tạo dữ liệu!", 
                                ephemeral: true 
                        });
                }

                let sortedUsers = [];
                let leaderboardTitle = "";
                let leaderboardSubtitle = "";

                // Sort users based on leaderboard type
                switch (leaderboardType) {
                        case "zigold":
                                sortedUsers = allUsers
                                        .filter(user => user.coin > 0)
                                        .sort((a, b) => (b.coin || 0) - (a.coin || 0));
                                leaderboardTitle = "🪙 ZiGold Leaderboard";
                                leaderboardSubtitle = "Top richest players";
                                break;
                                
                        case "animals":
                                sortedUsers = allUsers
                                        .filter(user => user.totalAnimals > 0)
                                        .sort((a, b) => (b.totalAnimals || 0) - (a.totalAnimals || 0));
                                leaderboardTitle = "🦁 Animal Collection Leaderboard";
                                leaderboardSubtitle = "Top animal collectors";
                                break;
                                
                        case "hunts":
                                sortedUsers = allUsers
                                        .filter(user => user.huntStats && Object.keys(user.huntStats).length > 0)
                                        .sort((a, b) => calculateTotalHunts(b.huntStats) - calculateTotalHunts(a.huntStats));
                                leaderboardTitle = "🏹 Hunt Count Leaderboard";
                                leaderboardSubtitle = "Most active hunters";
                                break;
                                
                        case "streak":
                                sortedUsers = allUsers
                                        .filter(user => (user.dailyStreak || 0) > 0)
                                        .sort((a, b) => (b.dailyStreak || 0) - (a.dailyStreak || 0));
                                leaderboardTitle = "🔥 Daily Streak Leaderboard";
                                leaderboardSubtitle = "Most consistent players";
                                break;
                                
                        case "petcare":
                                sortedUsers = allUsers
                                        .filter(user => user.petCare && ((user.petCare.totalFeedings || 0) + (user.petCare.totalPlays || 0)) > 0)
                                        .sort((a, b) => {
                                                const aTotal = (a.petCare?.totalFeedings || 0) + (a.petCare?.totalPlays || 0);
                                                const bTotal = (b.petCare?.totalFeedings || 0) + (b.petCare?.totalPlays || 0);
                                                return bTotal - aTotal;
                                        });
                                leaderboardTitle = "💖 Pet Care Leaderboard";
                                leaderboardSubtitle = "Best pet caretakers";
                                break;
                                
                        default: // level
                                sortedUsers = allUsers
                                        .filter(user => (user.level || 1) >= 1)
                                        .sort((a, b) => {
                                                if ((b.level || 1) !== (a.level || 1)) {
                                                        return (b.level || 1) - (a.level || 1);
                                                }
                                                return (b.xp || 1) - (a.xp || 1);
                                        });
                                leaderboardTitle = "🏆 Level & XP Leaderboard";
                                leaderboardSubtitle = "Highest level players";
                                break;
                }

                // Build leaderboard entries
                const leaderboardEntries = [];
                let rankNum = 1;
                
                for (const userData of sortedUsers.slice(0, 15)) {
                        try {
                                const member = await interaction.client.users.fetch(userData.userID).catch(() => null);
                                if (!member) continue;

                                const avatar = member.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" });
                                const username = "xxxxx" + member.username.slice(-4);
                                const displayName = member.displayName || member.globalName || member.username;
                                
                                // Get the appropriate value for this leaderboard type
                                let value1, value2;
                                switch (leaderboardType) {
                                        case "zigold":
                                                value1 = userData.coin || 0;
                                                value2 = `${userData.level || 1}`;
                                                break;
                                        case "animals":
                                                value1 = userData.totalAnimals || 0;
                                                value2 = `Lv.${userData.level || 1}`;
                                                break;
                                        case "hunts":
                                                value1 = calculateTotalHunts(userData.huntStats);
                                                value2 = `${userData.totalAnimals || 0} animals`;
                                                break;
                                        case "streak":
                                                value1 = userData.dailyStreak || 0;
                                                value2 = `Lv.${userData.level || 1}`;
                                                break;
                                        case "petcare":
                                                const totalCare = (userData.petCare?.totalFeedings || 0) + (userData.petCare?.totalPlays || 0);
                                                value1 = totalCare;
                                                value2 = `${userData.petCare?.happiness || 100}💖`;
                                                break;
                                        default:
                                                value1 = userData.level || 1;
                                                value2 = userData.xp || 1;
                                                break;
                                }

                                leaderboardEntries.push({ 
                                        avatar, 
                                        username, 
                                        displayName, 
                                        level: value1, 
                                        xp: value2, 
                                        rank: rankNum 
                                });
                                rankNum++;
                        } catch (error) {
                                console.error(`Error processing user ${userData.userID}:`, error);
                                continue;
                        }
                }

                if (leaderboardEntries.length === 0) {
                        return interaction.editReply({ 
                                content: `Chưa có dữ liệu cho leaderboard ${leaderboardTitle}. Hãy sử dụng các lệnh game để tạo dữ liệu!`, 
                                ephemeral: true 
                        });
                }

                const totalMembers = interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

                const Leaderboard_data = {
                        Header: {
                                title: leaderboardTitle,
                                image: interaction.client.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
                                subtitle: `${leaderboardSubtitle} • ${totalMembers} members`,
                        },
                        Players: leaderboardEntries.slice(0, 10),
                };

                const attachment = await buildImageInWorker({ Leaderboard_data });

                const response = { content: "", files: [attachment], components: [] };
                if (!interaction.guild) response.components = [];

                if (!interaction.isButton()) {
                        interaction.editReply(response).catch(() => {
                                interaction?.channel?.send(response);
                        });
                } else {
                        interaction.message.edit(response).catch(console.error);
                        interaction.deleteReply();
                }
        } catch (error) {
                console.error("Leaderboard error:", error);
                await interaction.editReply({ 
                        content: "Có lỗi xảy ra khi tạo leaderboard. Vui lòng thử lại!", 
                        ephemeral: true 
                });
        }
};

function calculateTotalHunts(huntStats) {
        if (!huntStats || typeof huntStats !== 'object') return 0;
        
        let total = 0;
        for (const rarity of Object.values(huntStats)) {
                if (rarity && typeof rarity === 'object') {
                        for (const animalData of Object.values(rarity)) {
                                if (animalData && animalData.count) {
                                        total += animalData.count;
                                }
                        }
                }
        }
        return total;
}
