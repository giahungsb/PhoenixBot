const { Events, Message } = require("discord.js");
const { useResponder, useConfig, useFunctions, useCommands, useLogger, modinteraction, useAI } = require("@zibot/zihooks");
const config = useConfig();
const { useQueue } = require("discord-player");
const mentionRegex = /@(everyone|here|ping)/;
const ziicon = require("./../../utility/icon");

const Commands = useCommands();
const Functions = useFunctions();

module.exports = {
        name: Events.MessageCreate,
        type: "events",
        enable: config?.DevConfig?.AutoResponder,
};

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
        if (!message.client.isReady()) return;
        if (message.author.bot) return;
        
        if (message.guild && message.channel.name?.startsWith("ai-")) {
                const { useDB } = require("@zibot/zihooks");
                const DataBase = useDB();
                
                if (!DataBase) {
                        return;
                }
                
                const AIRoomManager = require("../../services/ai/AIRoomManager");
                await AIRoomManager.updateActivity(message.channel.id);
                
                const room = await AIRoomManager.getRoomByChannelId(message.channel.id);
                if (room && room.userId === message.author.id) {
                        const langfunc = Functions.get("ZiRank");
                        const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
                        
                        return await handleAIRoomMessage(message, room, lang);
                }
        }
        
        // Lấy thiết lập ngôn ngữ của người dùng
        const langfunc = Functions.get("ZiRank");
        const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
        // tts
        if (message.channel.isThread() && message.channel.name.startsWith(`${message?.client?.user?.username} TTS |`)) {
                return await reqTTS(message, lang);
        }
        // Tự động trả lời
        if (config?.DevConfig?.AutoResponder && message?.guild && (await reqreponser(message))) return; // Auto Responder

        // Tin nhắn riêng tự động trả lời = AI
        if (!message.guild || message.mentions.has(message.client.user)) {
                await reqai(message, lang);
        }
};

/**
 * @param { Message } message
 */

const reqai = async (message, lang) => {
        const content = typeof message.content === 'string' ? message.content : '';
        if (mentionRegex.test(content.toLowerCase())) return;
        const prompt = content.replace(`<@${message.client.user.id}>`, "").trim();
        if (!prompt) {
                const commsnd = Commands.get("help");
                if (commsnd) {
                        modinteraction(message);
                        await commsnd.execute({ interaction: message, lang });
                }
                return;
        }
        await message.channel.sendTyping().catch(() => {
                return;
        });

        try {
                const ContextManager = require("../../services/ai/ContextManager");
                const thread = await ContextManager.getOrCreateThread(message.author.id);
                
                const result = await useAI().run(prompt, message.author, lang, thread);
                
                await ContextManager.addMessage(thread.threadId, "user", prompt, 0, "gemini");
                await ContextManager.addMessage(thread.threadId, "assistant", result, 0, "gemini");
                
                await message.reply(result);
        } catch (err) {
                useLogger().error(`Error in generating content: ${err}`);
                const replies = await message.reply("❌ | Không thể tạo nội dung! Xin hãy chờ ít phút");
                setTimeout(() => {
                        replies.delete();
                }, 5000);
        }
};

/**
 * @param { Message } message
 */

const reqreponser = async (message) => {
        const parseVar = useFunctions().get("getVariable");
        const guildResponders = useResponder().get(message.guild.id) ?? [];

        const trigger = guildResponders.find((responder) => {
                const msgContent = typeof message.content === 'string' ? message.content.toLowerCase() : '';
                const triggerContent = responder.trigger.toLowerCase();

                switch (responder.matchMode) {
                        case "exactly":
                                return msgContent === triggerContent;
                        case "startswith":
                                return msgContent.startsWith(triggerContent);
                        case "endswith":
                                return msgContent.endsWith(triggerContent);
                        case "includes":
                                return msgContent.includes(triggerContent);
                        default:
                                return msgContent === triggerContent;
                }
        });

        if (trigger) {
                try {
                        await message.reply(parseVar.execute(trigger.response, message));
                        return true;
                } catch (error) {
                        console.error(`Failed to send response: ${error.message}`);
                        return false;
                }
        }
        return false;
};

/**
 * @param { Message } message
 */

const reqTTS = async (message, lang) => {
        const queue = useQueue(message.guild.id);
        modinteraction(message);
        const tts = await Functions.get("TextToSpeech");
        if (queue?.metadata) await message.react(ziicon.yess);
        const context = message.content.replace(`<@${message.client.user.id}>`, "").trim();

        await tts.execute(message, context, lang, { queue });
};

const handleAIRoomMessage = async (message, room, lang) => {
        const aiModel = room.aiModel || "ask";
        const prompt = message.content.trim();
        
        if (!prompt && message.attachments.size === 0) return;
        
        await message.channel.sendTyping().catch(() => {});
        
        try {
                const ContextManager = require("../../services/ai/ContextManager");
                
                if (!room.threadId) {
                        console.error("[handleAIRoomMessage] Room missing threadId, creating new thread");
                        const newThread = await ContextManager.createRoomThread(message.author.id);
                        
                        const { useDB } = require("@zibot/zihooks");
                        const DataBase = useDB();
                        await DataBase.ZiAIRoom.updateOne(
                                { channelId: message.channel.id },
                                { $set: { threadId: newThread.threadId } }
                        );
                        room.threadId = newThread.threadId;
                } else {
                        const { useDB } = require("@zibot/zihooks");
                        const DataBase = useDB();
                        const threadExists = await DataBase.ZiGroqThread.findOne({ 
                                threadId: room.threadId, 
                                userID: message.author.id 
                        });
                        
                        if (!threadExists) {
                                console.warn(`[handleAIRoomMessage] Room thread ${room.threadId.substring(0, 8)} not found, creating new thread`);
                                const newThread = await ContextManager.createRoomThread(message.author.id);
                                
                                await DataBase.ZiAIRoom.updateOne(
                                        { channelId: message.channel.id },
                                        { $set: { threadId: newThread.threadId } }
                                );
                                room.threadId = newThread.threadId;
                        }
                }
                
                const { getDisplayName } = require("../../config/aiModels");
                const modelName = getDisplayName(aiModel);
                const thinkingMessage = await message.channel.send({
                        content: `🤔 **Đang suy nghĩ...**\n*${modelName} đang xử lý câu hỏi của bạn*`,
                });
                
                modinteraction(message);
                
                const wrappedMessage = new Proxy(message, {
                        get(target, prop) {
                                if (prop === 'editReply') {
                                        return async (options) => {
                                                try {
                                                        return await thinkingMessage.edit(options);
                                                } catch (error) {
                                                        console.error("[handleAIRoomMessage] Error editing thinking message:", error);
                                                        try {
                                                                return await message.channel.send(options);
                                                        } catch (sendError) {
                                                                console.error("[handleAIRoomMessage] Error sending to room:", sendError);
                                                                throw sendError;
                                                        }
                                                }
                                        };
                                }
                                if (prop === 'deferReply') {
                                        return async () => {
                                                return thinkingMessage;
                                        };
                                }
                                if (prop === 'reply') {
                                        return async (options) => {
                                                try {
                                                        return await thinkingMessage.edit(options);
                                                } catch (error) {
                                                        console.error("[handleAIRoomMessage] Error in reply:", error);
                                                        return await message.channel.send(options);
                                                }
                                        };
                                }
                                if (prop === 'followUp') {
                                        return async (options) => {
                                                return await message.channel.send(options);
                                        };
                                }
                                return target[prop];
                        }
                });
                
                const AttachmentProcessor = require("../../services/ai/AttachmentProcessor");
                let processedAttachments = null;
                
                const visionModels = ["ask", "groq", "gpt5", "gpt5-mini", "claude", "gemini-pro", "gemini-flash"];
                if (message.attachments.size > 0 && visionModels.includes(aiModel)) {
                        const attachmentArray = Array.from(message.attachments.values());
                        processedAttachments = [];
                        
                        for (const att of attachmentArray) {
                                const processed = await AttachmentProcessor.processAttachment(att);
                                if (!processed.error) {
                                        processedAttachments.push(processed);
                                }
                        }
                        
                        if (processedAttachments.length === 0) {
                                processedAttachments = null;
                        }
                }
                
                const originalThreadId = room.threadId;
                let aiExecutionResult = null;
                
                if (aiModel === "groq") {
                        const runGroq = Functions.get("runGroq");
                        if (runGroq) {
                                aiExecutionResult = await runGroq.execute(wrappedMessage, prompt || "Phân tích ảnh này", lang, { 
                                        attachments: processedAttachments,
                                        threadId: room.threadId,
                                        isRoomContext: true
                                });
                        }
                } else if (aiModel === "gpt5" || aiModel === "gpt5-mini" || aiModel === "claude" || aiModel === "gemini-pro" || aiModel === "gemini-flash") {
                        const runGPT5 = Functions.get("runGPT5");
                        if (runGPT5) {
                                aiExecutionResult = await runGPT5.execute(wrappedMessage, prompt || "Phân tích ảnh này", lang, { 
                                        attachments: processedAttachments, 
                                        modelKey: aiModel,
                                        threadId: room.threadId,
                                        isRoomContext: true
                                });
                        }
                } else if (aiModel === "ask") {
                        const runAI = Functions.get("runAI");
                        if (runAI) {
                                aiExecutionResult = await runAI.execute(wrappedMessage, prompt || "Phân tích ảnh này", lang, {
                                        attachments: processedAttachments,
                                        threadId: room.threadId,
                                        isRoomContext: true
                                });
                        }
                } else {
                        const runAI = Functions.get("runAI");
                        if (runAI) {
                                aiExecutionResult = await runAI.execute(wrappedMessage, prompt, lang, {
                                        threadId: room.threadId,
                                        isRoomContext: true
                                });
                        }
                }
                
                if (aiExecutionResult && aiExecutionResult.threadId && aiExecutionResult.threadId !== originalThreadId) {
                        console.warn(`[handleAIRoomMessage] Thread changed from ${originalThreadId.substring(0, 8)} to ${aiExecutionResult.threadId.substring(0, 8)}, updating room`);
                        const { useDB } = require("@zibot/zihooks");
                        const DataBase = useDB();
                        await DataBase.ZiAIRoom.updateOne(
                                { channelId: message.channel.id },
                                { $set: { threadId: aiExecutionResult.threadId } }
                        ).catch((err) => {
                                console.error("[handleAIRoomMessage] Failed to update room threadId:", err);
                        });
                }
        } catch (err) {
                useLogger().error(`Error in AI Room message handling: ${err}`);
                await message.reply("❌ | Không thể xử lý tin nhắn! Vui lòng thử lại sau.").catch(() => {});
        }
};
