const { useDB } = require("@zibot/zihooks");
const CacheManager = require("./CacheManager");

class FeedbackHandler {
        async recordFeedback(userID, messageId, threadId, rating, prompt, response, notes = "") {
                const DataBase = useDB();

                const feedback = {
                        userID,
                        messageId,
                        threadId,
                        rating,
                        prompt,
                        response,
                        notes,
                        timestamp: new Date(),
                };

                await DataBase.ZiFeedback.create(feedback);

                const promptHash = CacheManager.generateHash(prompt);
                await CacheManager.updateFeedback(promptHash, rating);

                return feedback;
        }

        async getFeedbackStats(userID = null) {
                const DataBase = useDB();
                
                const query = userID ? { userID } : {};
                
                const total = await DataBase.ZiFeedback.countDocuments(query);
                const positive = await DataBase.ZiFeedback.countDocuments({ ...query, rating: "positive" });
                const negative = await DataBase.ZiFeedback.countDocuments({ ...query, rating: "negative" });

                return {
                        total,
                        positive,
                        negative,
                        positiveRate: total > 0 ? (positive / total) * 100 : 0,
                };
        }

        async getRecentFeedback(limit = 10, userID = null) {
                const DataBase = useDB();
                
                const query = userID ? { userID } : {};
                
                const feedback = await DataBase.ZiFeedback.find(query)
                        .sort({ timestamp: -1 })
                        .limit(limit);

                return feedback;
        }

        async getNegativeFeedbackPatterns() {
                const DataBase = useDB();
                
                const negativeFeedback = await DataBase.ZiFeedback.find({ rating: "negative" })
                        .sort({ timestamp: -1 })
                        .limit(50);

                const patterns = {
                        commonIssues: [],
                        frequentPrompts: {},
                };

                negativeFeedback.forEach((feedback) => {
                        if (feedback.notes) {
                                patterns.commonIssues.push(feedback.notes);
                        }
                        
                        const promptKey = feedback.prompt.slice(0, 50);
                        patterns.frequentPrompts[promptKey] = (patterns.frequentPrompts[promptKey] || 0) + 1;
                });

                return patterns;
        }
}

module.exports = new FeedbackHandler();
