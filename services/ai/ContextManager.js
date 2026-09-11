const { useDB } = require("@zibot/zihooks");
const crypto = require("crypto");

class ContextManager {
        constructor() {
                this.maxMessagesPerThread = 999999;
                this.summarizationThreshold = 50;
        }

        async createNewThread(userID, updateUserPreferences = false) {
                const DataBase = useDB();
                
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

                await DataBase.ZiGroqThread.create(newThread);
                
                if (updateUserPreferences) {
                        await DataBase.ZiUser.updateOne(
                                { userID },
                                { $set: { "aiPreferences.activeThreadId": newThreadId } },
                                { upsert: true }
                        );
                }

                return newThread;
        }

        async createSharedThread(userID) {
                return await this.createNewThread(userID, true);
        }

        async createRoomThread(userID) {
                return await this.createNewThread(userID, false);
        }

        async getOrCreateThread(userID, threadId = null, isRoomContext = false) {
                const DataBase = useDB();
                
                if (threadId) {
                        const thread = await DataBase.ZiGroqThread.findOne({ threadId, userID });
                        if (thread) {
                                await DataBase.ZiGroqThread.updateOne(
                                        { threadId },
                                        { $set: { lastUsed: Date.now() } }
                                );
                                return thread;
                        }
                        
                        if (isRoomContext) {
                                console.warn(`[ContextManager] Room thread ${threadId.substring(0, 8)} not found for user ${userID}, creating new room thread`);
                                return await this.createRoomThread(userID);
                        }
                        
                        console.warn(`[ContextManager] Thread ${threadId.substring(0, 8)} not found for user ${userID}, falling back to shared thread`);
                }

                const userData = await DataBase.ZiUser.findOne({ userID });
                const activeThreadId = userData?.aiPreferences?.activeThreadId;

                if (activeThreadId) {
                        const activeThread = await DataBase.ZiGroqThread.findOne({ 
                                threadId: activeThreadId,
                                userID 
                        });
                        if (activeThread) {
                                await DataBase.ZiGroqThread.updateOne(
                                        { threadId: activeThreadId },
                                        { $set: { lastUsed: Date.now() } }
                                );
                                return activeThread;
                        }
                }

                return await this.createNewThread(userID, true);
        }

        async addMessage(threadId, role, content, tokens = 0, source = "huggingface") {
                const DataBase = useDB();
                
                const message = {
                        role,
                        content,
                        timestamp: Date.now(),
                        tokens,
                        source,
                };

                await DataBase.ZiGroqThread.updateOne(
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

                const thread = await DataBase.ZiGroqThread.findOne({ threadId });
                
                if (thread.messages.length >= this.summarizationThreshold) {
                        await this.summarizeOldMessages(threadId);
                }

                return thread;
        }

        async getMessages(threadId, limit = null) {
                const DataBase = useDB();
                const thread = await DataBase.ZiGroqThread.findOne({ threadId });
                
                if (!thread) return [];

                const messages = thread.messages || [];
                
                if (limit && messages.length > limit) {
                        return messages.slice(-limit);
                }

                return messages;
        }

        async summarizeOldMessages(threadId) {
                const DataBase = useDB();
                const thread = await DataBase.ZiGroqThread.findOne({ threadId });
                
                if (!thread || thread.messages.length < this.summarizationThreshold) {
                        return;
                }

                const oldMessages = thread.messages.slice(0, -this.maxMessagesPerThread);
                const recentMessages = thread.messages.slice(-this.maxMessagesPerThread);

                const summary = this.createSummary(oldMessages, thread.summary);

                await DataBase.ZiGroqThread.updateOne(
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
                const themes = [];

                messages.forEach(msg => {
                        if (msg.role === "user") {
                                const words = msg.content.toLowerCase().split(" ");
                                
                                if (words.some(w => ["code", "program", "function", "debug"].includes(w))) {
                                        topics.add("programming");
                                } else if (words.some(w => ["search", "find", "lookup", "tìm", "tra"].includes(w))) {
                                        topics.add("information_search");
                                } else if (words.some(w => ["image", "picture", "draw", "ảnh", "vẽ"].includes(w))) {
                                        topics.add("image_related");
                                } else if (words.some(w => ["explain", "what", "how", "why", "giải thích"].includes(w))) {
                                        topics.add("explanation");
                                }
                        }
                });

                if (topics.size > 0) {
                        return `This conversation has previously discussed: ${Array.from(topics).join(", ")}. Continue the conversation naturally without repeating previous questions.`;
                }

                return existingSummary || "New conversation starting.";
        }

        async listThreads(userID, limit = 10) {
                const DataBase = useDB();
                const threads = await DataBase.ZiGroqThread.find({ userID })
                        .sort({ lastUsed: -1 })
                        .limit(limit);
                
                return threads;
        }

        async switchThread(userID, threadId) {
                const DataBase = useDB();
                
                const thread = await DataBase.ZiGroqThread.findOne({ threadId, userID });
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
                
                const result = await DataBase.ZiGroqThread.deleteOne({ threadId, userID });
                
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
                
                await DataBase.ZiGroqThread.updateOne(
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
