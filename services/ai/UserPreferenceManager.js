const { useDB } = require("@zibot/zihooks");

class UserPreferenceManager {
        constructor() {
                this.defaultPreferences = {
                        language: "vi",
                        contextAware: true,
                        responseStyle: "balanced",
                        topicsOfInterest: [],
                        notedPreferences: [],
                };
        }

        async getUserPreferences(userID) {
                const DataBase = useDB();
                
                let userData = await DataBase.ZiUser.findOne({ userID });
                
                if (!userData || !userData.aiPreferences) {
                        return { ...this.defaultPreferences };
                }

                return {
                        ...this.defaultPreferences,
                        ...userData.aiPreferences,
                };
        }

        async updatePreference(userID, key, value) {
                const DataBase = useDB();
                
                await DataBase.ZiUser.updateOne(
                        { userID },
                        { 
                                $set: { [`aiPreferences.${key}`]: value }
                        },
                        { upsert: true }
                );

                return true;
        }

        async addPreferenceNote(userID, note) {
                const DataBase = useDB();
                
                await DataBase.ZiUser.updateOne(
                        { userID },
                        { 
                                $push: { 
                                        "aiPreferences.notedPreferences": {
                                                note,
                                                timestamp: Date.now(),
                                        }
                                }
                        },
                        { upsert: true }
                );

                return true;
        }

        async addTopicOfInterest(userID, topic) {
                const DataBase = useDB();
                
                const userData = await DataBase.ZiUser.findOne({ userID });
                const currentTopics = userData?.aiPreferences?.topicsOfInterest || [];

                if (!currentTopics.includes(topic)) {
                        await DataBase.ZiUser.updateOne(
                                { userID },
                                { 
                                        $push: { "aiPreferences.topicsOfInterest": topic }
                                },
                                { upsert: true }
                        );
                }

                return true;
        }

        buildPreferencePrompt(preferences) {
                if (!preferences || Object.keys(preferences).length === 0) {
                        return "";
                }

                let prompt = "\n\n👤 User Profile & Preferences:";

                if (preferences.responseStyle) {
                        const styleMap = {
                                concise: "Keep responses brief and to the point",
                                detailed: "Provide detailed, comprehensive explanations",
                                balanced: "Balance between brevity and detail",
                        };
                        prompt += `\n- Response style: ${styleMap[preferences.responseStyle] || "balanced"}`;
                }

                if (preferences.topicsOfInterest && preferences.topicsOfInterest.length > 0) {
                        prompt += `\n- Topics of interest: ${preferences.topicsOfInterest.join(", ")}`;
                }

                if (preferences.notedPreferences && preferences.notedPreferences.length > 0) {
                        const recentNotes = preferences.notedPreferences.slice(-3).map(p => p.note);
                        if (recentNotes.length > 0) {
                                prompt += `\n- User preferences: ${recentNotes.join("; ")}`;
                        }
                }

                return prompt;
        }

        async learnFromInteraction(userID, prompt, response, feedback = null) {
                try {
                        const promptLower = prompt.toLowerCase();
                        
                        if (promptLower.includes("code") || promptLower.includes("lập trình")) {
                                await this.addTopicOfInterest(userID, "programming");
                        }
                        if (promptLower.includes("game")) {
                                await this.addTopicOfInterest(userID, "gaming");
                        }
                        if (promptLower.includes("music") || promptLower.includes("nhạc")) {
                                await this.addTopicOfInterest(userID, "music");
                        }
                        if (promptLower.includes("tiếng việt") || promptLower.includes("vietnamese")) {
                                await this.updatePreference(userID, "language", "vi");
                        }
                        if (promptLower.includes("english")) {
                                await this.updatePreference(userID, "language", "en");
                        }

                        if (prompt.length < 50) {
                                const prefs = await this.getUserPreferences(userID);
                                if (prefs.responseStyle !== "concise") {
                                }
                        } else if (prompt.length > 200) {
                                const prefs = await this.getUserPreferences(userID);
                                if (prefs.responseStyle !== "detailed") {
                                }
                        }

                        return true;
                } catch (error) {
                        console.error("Error learning from interaction:", error);
                        return false;
                }
        }
}

module.exports = new UserPreferenceManager();
