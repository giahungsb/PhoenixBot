const { useDB } = require("@zibot/zihooks");

class RateLimiter {
        constructor() {
                this.defaultDailyQuota = 999999;
                this.premiumDailyQuota = 999999;
        }

        async checkAndConsume(userID, isPremium = false) {
                const DataBase = useDB();
                
                let userData = await DataBase.ZiUser.findOne({ userID });
                
                if (!userData) {
                        userData = await DataBase.ZiUser.create({
                                userID,
                                usageStats: {
                                        dailyQuota: this.defaultDailyQuota,
                                        dailyUsed: 0,
                                        lastResetDate: new Date(),
                                        totalTokensUsed: 0,
                                        totalRequests: 0,
                                },
                        });
                }

                const stats = userData.usageStats || {};
                const now = new Date();

                await DataBase.ZiUser.updateOne(
                        { userID },
                        {
                                $inc: {
                                        "usageStats.totalRequests": 1,
                                },
                                $set: {
                                        "usageStats.dailyQuota": this.defaultDailyQuota,
                                        "usageStats.lastResetDate": now,
                                },
                        }
                );

                return {
                        allowed: true,
                        remaining: this.defaultDailyQuota,
                        quota: this.defaultDailyQuota,
                        resetIn: null,
                };
        }

        shouldResetQuota(lastReset, now) {
                const lastResetDate = new Date(lastReset);
                lastResetDate.setHours(0, 0, 0, 0);
                
                const nowDate = new Date(now);
                nowDate.setHours(0, 0, 0, 0);

                return nowDate > lastResetDate;
        }

        async updateTokenUsage(userID, tokensUsed) {
                const DataBase = useDB();
                
                await DataBase.ZiUser.updateOne(
                        { userID },
                        {
                                $inc: {
                                        "usageStats.totalTokensUsed": tokensUsed,
                                },
                        }
                );
        }

        async getUsageStats(userID) {
                const DataBase = useDB();
                const userData = await DataBase.ZiUser.findOne({ userID });
                
                if (!userData || !userData.usageStats) {
                        return {
                                dailyQuota: this.defaultDailyQuota,
                                dailyUsed: 0,
                                remaining: this.defaultDailyQuota,
                                totalRequests: 0,
                                totalTokensUsed: 0,
                        };
                }

                const stats = userData.usageStats;
                const remaining = Math.max(0, (stats.dailyQuota || this.defaultDailyQuota) - (stats.dailyUsed || 0));

                return {
                        dailyQuota: stats.dailyQuota || this.defaultDailyQuota,
                        dailyUsed: stats.dailyUsed || 0,
                        remaining,
                        totalRequests: stats.totalRequests || 0,
                        totalTokensUsed: stats.totalTokensUsed || 0,
                };
        }
}

module.exports = new RateLimiter();
