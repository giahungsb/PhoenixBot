const { useDB } = require("@zibot/zihooks");
const crypto = require("crypto");

class CacheManager {
        constructor() {
                this.defaultTTL = 7 * 24 * 60 * 60 * 1000;
        }

        generateHash(prompt, language = "auto", model = "openrouter/polaris-alpha") {
                const data = `${prompt}:${language}:${model}`;
                return crypto.createHash("sha256").update(data).digest("hex");
        }

        async get(prompt, language = "auto", model = "openrouter/polaris-alpha") {
                const DataBase = useDB();
                const promptHash = this.generateHash(prompt, language, model);

                const cached = await DataBase.ZiAnswerCache.findOne({
                        promptHash,
                        expiresAt: { $gt: new Date() },
                });

                if (cached) {
                        await DataBase.ZiAnswerCache.updateOne(
                                { promptHash },
                                {
                                        $inc: { hitCount: 1 },
                                        $set: { lastHit: new Date() },
                                }
                        );

                        return {
                                response: cached.response,
                                fromCache: true,
                                hitCount: cached.hitCount + 1,
                        };
                }

                return null;
        }

        async set(prompt, response, language = "auto", model = "openrouter/polaris-alpha", ttl = null) {
                const DataBase = useDB();
                const promptHash = this.generateHash(prompt, language, model);
                const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL));

                await DataBase.ZiAnswerCache.updateOne(
                        { promptHash },
                        {
                                $set: {
                                        prompt,
                                        response,
                                        language,
                                        model,
                                        expiresAt,
                                        lastHit: new Date(),
                                },
                                $setOnInsert: {
                                        hitCount: 0,
                                        metadata: {
                                                averageRating: 0,
                                                totalFeedback: 0,
                                        },
                                },
                        },
                        { upsert: true }
                );

                return true;
        }

        async invalidate(prompt, language = "auto", model = "openrouter/polaris-alpha") {
                const DataBase = useDB();
                const promptHash = this.generateHash(prompt, language, model);

                const result = await DataBase.ZiAnswerCache.deleteOne({ promptHash });
                return result.deletedCount > 0;
        }

        async updateFeedback(promptHash, rating) {
                const DataBase = useDB();
                const cached = await DataBase.ZiAnswerCache.findOne({ promptHash });

                if (!cached) return false;

                const totalFeedback = (cached.metadata?.totalFeedback || 0) + 1;
                const currentAvg = cached.metadata?.averageRating || 0;
                const ratingValue = rating === "positive" ? 1 : 0;
                const newAvg = ((currentAvg * (totalFeedback - 1)) + ratingValue) / totalFeedback;

                await DataBase.ZiAnswerCache.updateOne(
                        { promptHash },
                        {
                                $set: {
                                        "metadata.averageRating": newAvg,
                                        "metadata.totalFeedback": totalFeedback,
                                },
                        }
                );

                if (newAvg < 0.3 && totalFeedback >= 5) {
                        await this.invalidate(cached.prompt, cached.language, cached.model);
                        return { invalidated: true };
                }

                return { invalidated: false, newAvg, totalFeedback };
        }

        async cleanExpired() {
                const DataBase = useDB();
                const result = await DataBase.ZiAnswerCache.deleteMany({
                        expiresAt: { $lt: new Date() },
                });
                return result.deletedCount;
        }

        async getStats() {
                const DataBase = useDB();
                const totalCached = await DataBase.ZiAnswerCache.countDocuments();
                const totalHits = await DataBase.ZiAnswerCache.aggregate([
                        { $group: { _id: null, total: { $sum: "$hitCount" } } },
                ]);

                const topHits = await DataBase.ZiAnswerCache.find()
                        .sort({ hitCount: -1 })
                        .limit(10)
                        .select("prompt hitCount lastHit");

                return {
                        totalCached,
                        totalHits: totalHits[0]?.total || 0,
                        topHits,
                };
        }
}

module.exports = new CacheManager();
