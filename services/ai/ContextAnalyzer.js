const { PermissionFlagsBits } = require("discord.js");

class ContextAnalyzer {
        constructor() {
                this.maxChannelMessages = 10;
                this.contextWindow = 5 * 60 * 1000;
                this.cache = new Map();
                this.cacheDuration = 60 * 1000;
        }

        async analyzeChannelContext(interaction) {
                try {
                        if (!interaction.channel) {
                                return null;
                        }

                        const channel = interaction.channel;
                        
                        const cacheKey = `${channel.id}_${interaction.user.id}`;
                        const cached = this.cache.get(cacheKey);
                        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                                return cached.context;
                        }
                        
                        const botMember = interaction.guild?.members?.cache?.get(interaction.client.user.id);
                        if (!botMember || !channel.permissionsFor(botMember).has(PermissionFlagsBits.ReadMessageHistory)) {
                                return null;
                        }

                        const messages = await channel.messages.fetch({ 
                                limit: this.maxChannelMessages,
                                before: interaction.id 
                        });

                        const recentMessages = [...messages
                                .filter(msg => {
                                        const age = Date.now() - msg.createdTimestamp;
                                        return age < this.contextWindow && !msg.author.bot;
                                })
                                .values()]
                                .reverse()
                                .slice(0, 5);

                        if (recentMessages.length === 0) {
                                return null;
                        }

                        const context = {
                                channelName: channel.name,
                                channelType: channel.type,
                                recentTopics: this.extractTopics(recentMessages),
                                participants: [...new Set(recentMessages.map(m => m.author.username))],
                                messageCount: recentMessages.length,
                                summary: this.summarizeMessages(recentMessages),
                        };

                        this.cache.set(cacheKey, {
                                context,
                                timestamp: Date.now(),
                        });

                        setTimeout(() => this.cache.delete(cacheKey), this.cacheDuration);

                        return context;
                } catch (error) {
                        console.error("Error analyzing channel context:", error);
                        return null;
                }
        }

        extractTopics(messages) {
                const topics = [];
                const keywords = new Set();

                messages.forEach(msg => {
                        const content = msg.content.toLowerCase();
                        
                        if (content.includes("code") || content.includes("lập trình") || content.includes("bug")) {
                                topics.push("programming");
                        }
                        if (content.includes("game") || content.includes("chơi")) {
                                topics.push("gaming");
                        }
                        if (content.includes("help") || content.includes("giúp") || content.includes("hỏi")) {
                                topics.push("help");
                        }
                        if (content.includes("music") || content.includes("nhạc") || content.includes("bài hát")) {
                                topics.push("music");
                        }

                        const words = content.split(/\s+/).filter(w => w.length > 4);
                        words.forEach(w => keywords.add(w));
                });

                return {
                        categories: [...new Set(topics)],
                        keywords: Array.from(keywords).slice(0, 10),
                };
        }

        summarizeMessages(messages) {
                if (messages.length === 0) return "";

                const summary = messages.map(msg => {
                        const content = msg.content.length > 100 
                                ? msg.content.substring(0, 100) + "..." 
                                : msg.content;
                        return `${msg.author.username}: ${content}`;
                }).join("\n");

                return summary;
        }

        buildContextPrompt(context) {
                if (!context) return "";

                let prompt = "\n\n📍 Channel Context:";
                prompt += `\n- Channel: #${context.channelName}`;
                
                if (context.participants.length > 0) {
                        prompt += `\n- Recent participants: ${context.participants.join(", ")}`;
                }

                if (context.recentTopics.categories.length > 0) {
                        prompt += `\n- Topics being discussed: ${context.recentTopics.categories.join(", ")}`;
                }

                if (context.summary) {
                        prompt += `\n\nRecent messages in channel:\n${context.summary}`;
                }

                prompt += `\n\nNote: The user's question may relate to the above conversation. Provide context-aware responses when relevant.`;

                return prompt;
        }

        async analyzeUserBehavior(userID, messages) {
                const behavior = {
                        messageCount: messages.length,
                        avgMessageLength: 0,
                        topicsOfInterest: [],
                        commonQuestions: [],
                        preferredLanguage: "vi",
                };

                if (messages.length === 0) return behavior;

                let totalLength = 0;
                const topicCounts = {};
                const questions = [];

                messages.forEach(msg => {
                        totalLength += msg.content.length;

                        if (msg.content.includes("?")) {
                                questions.push(msg.content);
                        }

                        const englishWords = (msg.content.match(/[a-zA-Z]+/g) || []).length;
                        const vietnameseChars = (msg.content.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []).length;
                        
                        if (englishWords > vietnameseChars) {
                                behavior.preferredLanguage = "en";
                        }
                });

                behavior.avgMessageLength = Math.round(totalLength / messages.length);
                behavior.commonQuestions = questions.slice(-3);

                return behavior;
        }
}

module.exports = new ContextAnalyzer();
