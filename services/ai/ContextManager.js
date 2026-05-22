const { useDB } = require("@zibot/zihooks");
const crypto = require("crypto");

class ContextManager {
        constructor() {
                this.maxMessagesPerThread = 999999;
                this.summarizationThreshold = 999999;
        }

        async getOrCreateThread(userID, threadId = null) {
                const DataBase = useDB();
                
                if (threadId) {
                        const thread = await DataBase.ZiPolarisThread.findOne({ threadId });
                        if (thread) {
                                await DataBase.ZiPolarisThread.updateOne(
                                        { threadId },
                                        { $set: { lastUsed: Date.now() } }
                                );
                                return thread;
                        }
                }

                const userData = await DataBase.ZiUser.findOne({ userID });
                const activeThreadId = userData?.aiPreferences?.activeThreadId;

                if (activeThreadId) {
                        const activeThread = await DataBase.ZiPolarisThread.findOne({ 
                                threadId: activeThreadId,
                                userID 
                        });
                        if (activeThread) {
                                await DataBase.ZiPolarisThread.updateOne(
                                        { threadId: activeThreadId },
                                        { $set: { lastUsed: Date.now() } }
                                );
                                return activeThread;
                        }
                }

                const newThreadId = this.generateThreadId();
                const newThread = {
                        threadId: newThreadId,
                        userID,
                        name: "New Conversation",
                        messages: [],
                        summary: "",
                        lastUsed: Date.now(),
                        isActive: true,
                        metadata: {
                                totalMessages: 0,
                                totalTokens: 0,
                                createdAt: Date.now(),
                        },
                };

                await DataBase.ZiPolarisThread.create(newThread);
                await DataBase.ZiUser.updateOne(
                        { userID },
                        { $set: { "aiPreferences.activeThreadId": newThreadId } },
                        { upsert: true }
                );

                return newThread;
        }

        async addMessage(threadId, role, content, tokens = 0) {
                const DataBase = useDB();
                
                const message = {
                        role,
                        content,
                        timestamp: Date.now(),
                        tokens,
                };

                await DataBase.ZiPolarisThread.updateOne(
                        { threadId },
                        { 
                                $push: { messages: message },
                                $inc: { 
                                        "metadata.totalMessages": 1,
                                        "metadata.totalTokens": tokens 
                                },
                                $set: { lastUsed: Date.now() }
                        }
                );

                const thread = await DataBase.ZiPolarisThread.findOne({ threadId });
                
                if (thread.messages.length >= this.summarizationThreshold) {
                        await this.summarizeOldMessages(threadId);
                }

                return thread;
        }

        async getMessages(threadId, limit = null) {
                const DataBase = useDB();
                const thread = await DataBase.ZiPolarisThread.findOne({ threadId });
                
                if (!thread) return [];

                const messages = thread.messages || [];
                
                if (limit && messages.length > limit) {
                        return messages.slice(-limit);
                }

                return messages;
        }

        async summarizeOldMessages(threadId) {
                const DataBase = useDB();
                const thread = await DataBase.ZiPolarisThread.findOne({ threadId });
                
                if (!thread || thread.messages.length < this.summarizationThreshold) {
                        return;
                }

                const oldMessages = thread.messages.slice(0, -this.maxMessagesPerThread);
                const recentMessages = thread.messages.slice(-this.maxMessagesPerThread);

                const summary = this.createSummary(oldMessages, thread.summary);

                await DataBase.ZiPolarisThread.updateOne(
                        { threadId },
                        { 
                                $set: { 
                                        messages: recentMessages,
                                        summary 
                                } 
                        }
                );
        }

        createSummary(messages, existingSummary = "") {
                const topics = new Set();
                const keyPoints = [];

                messages.forEach(msg => {
                        if (msg.role === "user") {
                                const firstWords = msg.content.split(" ").slice(0, 10).join(" ");
                                keyPoints.push(`User asked: ${firstWords}...`);
                        }
                });

                let summary = existingSummary ? `${existingSummary}\n\n` : "";
                summary += `Previous conversation (${messages.length} messages):\n`;
                summary += keyPoints.slice(-5).join("\n");

                return summary;
        }

        async listThreads(userID, limit = 10) {
                const DataBase = useDB();
                const threads = await DataBase.ZiPolarisThread.find({ userID })
                        .sort({ lastUsed: -1 })
                        .limit(limit);
                
                return threads;
        }

        async switchThread(userID, threadId) {
                const DataBase = useDB();
                
                const thread = await DataBase.ZiPolarisThread.findOne({ threadId, userID });
                if (!thread) {
                        throw new Error("Thread not found");
                }

                await DataBase.ZiUser.updateOne(
                        { userID },
                        { $set: { "aiPreferences.activeThreadId": threadId } },
                        { upsert: true }
                );

                return thread;
        }

        async deleteThread(threadId, userID) {
                const DataBase = useDB();
                
                const result = await DataBase.ZiPolarisThread.deleteOne({ threadId, userID });
                
                const userData = await DataBase.ZiUser.findOne({ userID });
                if (userData?.aiPreferences?.activeThreadId === threadId) {
                        await DataBase.ZiUser.updateOne(
                                { userID },
                                { $set: { "aiPreferences.activeThreadId": null } }
                        );
                }

                return result.deletedCount > 0;
        }

        async renameThread(threadId, userID, newName) {
                const DataBase = useDB();
                
                await DataBase.ZiPolarisThread.updateOne(
                        { threadId, userID },
                        { $set: { name: newName } }
                );

                return true;
        }

        generateThreadId() {
                return crypto.randomBytes(16).toString("hex");
        }
}

module.exports = new ContextManager();
