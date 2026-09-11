const { useDB, useConfig } = require("@zibot/zihooks");
const config = useConfig();

module.exports.data = {
        name: "ZiRank",
        type: "ranksys",
};

/**
 * @param { import ("discord.js").User } user
 * @param { Number } XpADD
 * @param { Number } CoinADD
 */

module.exports.execute = async ({ user, XpADD = 1, CoinADD = 0 }) => {
        const DataBase = useDB();
        if (DataBase && user) {
                // Bảo vệ chống các thao tác coin âm sẽ gây số dư âm
                if (CoinADD < 0) {
                        throw new Error('ZiRank should not be used for negative coin operations. Use atomic operations with balance validation instead.');
                }

                // Sử dụng luồng tổng hợp nguyên tử để tính toán giá trị mới tại máy chủ
                const result = await DataBase.ZiUser.findOneAndUpdate(
                        { userID: user.id },
                        [
                                {
                                        $set: {
                                                // Ensure defaults for missing fields
                                                xp: { $ifNull: ["$xp", 1] },
                                                level: { $ifNull: ["$level", 1] },
                                                coin: { $ifNull: ["$coin", 0] },
                                                lang: { $ifNull: ["$lang", null] },
                                                color: { $ifNull: ["$color", null] },
                                                name: user.username,
                                                userID: user.id
                                        }
                                }
                        ],
                        { 
                                upsert: true,
                                new: true,
                                setDefaultsOnInsert: true
                        }
                );

                // Bây giờ thực hiện cập nhật thực tế với logic tăng cấp
                const updatedResult = await DataBase.ZiUser.findOneAndUpdate(
                        { userID: user.id },
                        [
                                {
                                        $set: {
                                                // Calculate new XP
                                                newXp: { $add: ["$xp", XpADD] },
                                                // Keep current level for threshold calculation
                                                currentLevel: "$level",
                                                // Add coins (safe since we guard against negative)
                                                coin: { $add: ["$coin", CoinADD] }
                                        }
                                },
                                {
                                        $set: {
                                                // Calculate XP threshold for current level
                                                xpThreshold: { $add: [{ $multiply: ["$currentLevel", 50] }, 1] },
                                                // Determine if level up occurs
                                                shouldLevelUp: { $gt: ["$newXp", { $add: [{ $multiply: ["$currentLevel", 50] }, 1] }] }
                                        }
                                },
                                {
                                        $set: {
                                                // Final calculations with level up logic
                                                level: {
                                                        $cond: {
                                                                if: "$shouldLevelUp",
                                                                then: { $add: ["$currentLevel", 1] },
                                                                else: "$currentLevel"
                                                        }
                                                },
                                                xp: {
                                                        $cond: {
                                                                if: "$shouldLevelUp",
                                                                then: 1,
                                                                else: "$newXp"
                                                        }
                                                },
                                                coin: {
                                                        $cond: {
                                                                if: "$shouldLevelUp",
                                                                then: { $add: ["$coin", { $multiply: [{ $add: ["$currentLevel", 1] }, 100] }] },
                                                                else: "$coin"
                                                        }
                                                },
                                                // Preserve existing fields
                                                userID: "$userID",
                                                name: "$name",
                                                lang: "$lang",
                                                color: "$color",
                                                createdAt: { $ifNull: ["$createdAt", new Date()] }
                                        }
                                },
                                {
                                        // Clean up temporary fields
                                        $unset: ["newXp", "currentLevel", "xpThreshold", "shouldLevelUp"]
                                }
                        ],
                        { 
                                new: true
                        }
                );

                const langdef = require(`./../../lang/${updatedResult.lang || config?.DefaultLang}`);
                langdef.color = updatedResult.color;
                return langdef;
        } else {
                // If the database is not available, just return default language
                const langdef = require(`./../../lang/${config?.DefaultLang}`);
                return langdef;
        }
};
