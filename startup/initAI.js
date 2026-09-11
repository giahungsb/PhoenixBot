const { GoogleGenerativeAI } = require("@google/generative-ai");
const { useDB, useAI, useLogger, useClient, useConfig } = require("@zibot/zihooks");
const AIService = require("../services/ai/AIService");
const config = useConfig();
const client = useClient();

module.exports = async () => {
        try {
                if (!config.DevConfig.ai) return;

                if (process.env?.GROQ_API_KEY?.length) {
                        console.log("[initAI] 🚀 Initializing Groq API...");
                        AIService.initializeGroq(process.env.GROQ_API_KEY);
                        useLogger().info("Successfully loaded Groq AI service.");
                }

                if (process.env?.MEGALLM_API_KEY?.length) {
                        console.log("[initAI] 🚀 Initializing MegaLLM API...");
                        AIService.initializeMegaLLM(process.env.MEGALLM_API_KEY);
                        useLogger().info("Successfully loaded MegaLLM AI service.");
                }

                if (!process.env?.GEMINI_API_KEY?.length) {
                        if (!process.env?.GROQ_API_KEY?.length && !process.env?.MEGALLM_API_KEY?.length) {
                                useLogger().warn("⚠️  [AI] No AI API keys configured!");
                                useLogger().warn("⚠️  [AI] Available features:");
                                useLogger().warn("⚠️  [AI] - /ai groq: Requires GROQ_API_KEY");
                                useLogger().warn("⚠️  [AI] - /ai gpt5: Requires MEGALLM_API_KEY");
                                useLogger().warn("⚠️  [AI] - /ai ask: Requires GEMINI_API_KEY");
                        } else {
                                console.log("[initAI] ℹ️  Gemini AI (ask) disabled - GEMINI_API_KEY not found");
                        }
                        return;
                }

                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const DataBase = useDB();

                useAI({
                        client,
                        genAI,
                        run: async (prompt, user, lang, thread, attachments = null) => {
                                const generationConfig = {
                                        temperature: 0.7,
                                        topP: 0.95,
                                        topK: 40,
                                        maxOutputTokens: 65536,
                                };
                                const model = genAI.getGenerativeModel({ 
                                        model: "gemini-2.5-flash", 
                                        generationConfig,
                                        tools: [{ googleSearch: {} }]
                                });
                                
                                const language = lang?.local_names || "vi_VN";
                                const systemPrompt = `You are a Discord bot powered by Google Gemini 2.5 Flash (gemini-2.5-flash) with 1M token context window, Google Search Grounding, and Vision capabilities. You can:
- Search the internet in real-time for up-to-date information (news, prices, weather, etc.)
- Analyze and understand images when provided by users
- Always use current data when answering questions about real-time information

You support slash commands including: avatar, help, language, ping, translate, disconnect, userinfo, ban, purge, volumec, cat, dog, weather, kick, timeout, unban, untimeout, lyrics, anime, statistics, play next, play assistant, play music, player, autoresponder new, autoresponder edit, welcomer setup, ai ask, ai assistant, decrypt, encrypt, variable, tts, voice log. With source code at: https://github.com/zijipia/Ziji-bot-discord

IMPORTANT: When answering follow-up questions, use the conversation history to understand context, but provide fresh answers without directly quoting or repeating previous responses.`;

                                const contents = [];
                                
                                if (thread && thread.messages && thread.messages.length > 0) {
                                        const MAX_HISTORY_MESSAGES = attachments && attachments.length > 0 ? 10 : 40;
                                        const allMessages = thread.messages.slice(-MAX_HISTORY_MESSAGES);
                                        
                                        const lastMessage = allMessages[allMessages.length - 1];
                                        const isLastMessageUser = lastMessage && lastMessage.role === "user";
                                        const isLastMessageCurrentPrompt = isLastMessageUser && lastMessage.content === prompt;
                                        
                                        const historyMessages = isLastMessageCurrentPrompt ? allMessages.slice(0, -1) : allMessages;
                                        
                                        for (const msg of historyMessages) {
                                                if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "model") {
                                                        console.warn(`[Gemini] Skipping message with invalid role: ${msg.role}`);
                                                        continue;
                                                }
                                                
                                                contents.push({
                                                        role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
                                                        parts: [{ text: msg.content }]
                                                });
                                        }
                                        
                                        if (contents.length > 0 && contents[0].role !== "user") {
                                                console.warn("[Gemini] First message is not 'user', filtering to ensure valid conversation");
                                                const firstUserIndex = contents.findIndex(m => m.role === "user");
                                                if (firstUserIndex > 0) {
                                                        contents.splice(0, firstUserIndex);
                                                } else if (firstUserIndex === -1) {
                                                        contents.length = 0;
                                                }
                                        }
                                }
                                
                                const chat = model.startChat({
                                        history: contents,
                                        systemInstruction: {
                                                parts: [{ text: systemPrompt }]
                                        },
                                });
                                
                                let messageContent;
                                if (attachments && attachments.length > 0) {
                                        console.log(`[Gemini] 🖼️ Processing ${attachments.length} image(s) with vision`);
                                        const axios = require("axios");
                                        const parts = [];
                                        
                                        if (prompt && prompt.trim()) {
                                                parts.push({ text: prompt });
                                        }
                                        
                                        for (const attachment of attachments) {
                                                try {
                                                        const response = await axios.get(attachment.url, { 
                                                                responseType: 'arraybuffer',
                                                                timeout: 30000
                                                        });
                                                        const imageData = Buffer.from(response.data).toString('base64');
                                                        
                                                        parts.push({
                                                                inlineData: {
                                                                        data: imageData,
                                                                        mimeType: attachment.contentType
                                                                }
                                                        });
                                                        console.log(`[Gemini] ✅ Added image to vision request: ${attachment.name}`);
                                                } catch (error) {
                                                        console.error(`[Gemini] ❌ Failed to fetch image ${attachment.url}:`, error.message);
                                                }
                                        }
                                        
                                        if (parts.length === 0) {
                                                throw new Error("Không thể tải ảnh. Vui lòng thử lại.");
                                        }
                                        
                                        messageContent = parts;
                                } else {
                                        messageContent = prompt;
                                }
                                
                                const result = await chat.sendMessage(messageContent);
                                const text = result?.response?.text();

                                if (!text) return "Lỗi khi gọi AI";

                                return text;
                        },
                });

                useLogger().info(`Successfully loaded Ai model.`);
        } catch (error) {
                useLogger().error("Lỗi khi tải Ai model:", error);
        }
};
