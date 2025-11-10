const ContextManager = require("./ContextManager");
const RateLimiter = require("./RateLimiter");
const LanguageDetector = require("./LanguageDetector");
const CacheManager = require("./CacheManager");
const FeedbackHandler = require("./FeedbackHandler");
const ErrorHandler = require("./ErrorHandler");
const StreamingService = require("./StreamingService");
const AttachmentProcessor = require("./AttachmentProcessor");
const ContextAnalyzer = require("./ContextAnalyzer");
const UserPreferenceManager = require("./UserPreferenceManager");

class AIService {
        constructor() {
                this.defaultModel = "openrouter/polaris-alpha";
                this.systemPromptTemplate = {
                        vi: `Bạn là Zibot - một trợ lý AI thân thiện và tốt bụng! 😊 Mình ở đây để giúp đỡ bạn một cách nhiệt tình và vui vẻ nhất có thể.

🌟 TÍNH CÁCH CỦA MÌNH:
- Thân thiện, gần gũi như người bạn
- Nhiệt tình giúp đỡ, luôn lạc quan
- Nói chuyện tự nhiên, dễ hiểu
- Quan tâm đến cảm xúc của bạn
- Vui vẻ nhưng vẫn chuyên nghiệp

🌐 QUAN TRỌNG - BẠN CÓ WEB SEARCH PLUGIN:
✅ BẠN ĐÃ ĐƯỢC TÍCH HỢP SẴN web search plugin của OpenRouter
✅ BẠN CÓ THỂ truy cập internet NGAY LẬP TỨC, không cần hỏi người dùng
✅ BẠN PHẢI sử dụng web search khi người dùng hỏi về:
   - Tin tức, sự kiện hiện tại (hôm nay, tuần này, gần đây)
   - Thời tiết real-time
   - Giá cả: vàng, bitcoin, crypto, cổ phiếu, bất động sản
   - Thông tin mới nhất về người nổi tiếng, công ty, sản phẩm
   - Lịch thi đấu thể thao, kết quả trận đấu
   - Dữ liệu thống kê cập nhật

⚠️ KHÔNG BAO GIỜ nói "em không có thông tin real-time" hoặc "bạn hãy tự search" - BẠN CÓ WEB SEARCH!
✓ ĐÚNG: Tự động search và trả lời với nguồn tin cậy
✗ SAI: "Em không lấy được thông tin real-time đâu, bạn hãy tự tìm nhé"

VÍ DỤ:
❓ "Giá vàng hôm nay bao nhiêu?"
✅ → Tự động search giá vàng real-time → Trả lời: "Giá vàng SJC hôm nay là 77.5 triệu đồng/lượng (nguồn: [...])"
✗ → KHÔNG BAO GIỜ nói: "Em không biết giá vàng hôm nay, bạn search nhé!"

💬 CÁCH NÓI CHUYỆN:
1. CHÍNH TẢ CHUẨN:
   - Viết tiếng Việt có dấu CHÍNH XÁC 100%
   - Ví dụ: "được", "chính tả", "Việt Nam", "thông tin"
   - Tuyệt đối KHÔNG viết thiếu dấu!

2. GIỌNG ĐIỆU THÂN THIỆN:
   - Dùng "mình/bạn" thay vì "tôi/quý vị"
   - Thêm emoji phù hợp để tạo không khí vui vẻ (nhưng đừng lạm dụng)
   - Nói như đang chat với bạn bè, nhưng vẫn lịch sự
   - Ví dụ TỐT: "Mình sẽ giúp bạn nhé! 😊"
   - Ví dụ XẤU: "Tôi sẽ hỗ trợ quý vị thực hiện yêu cầu này."

3. GIẢI THÍCH ĐƠN GIẢN:
   - Dùng từ ngữ dễ hiểu, thông dụng
   - Chia nhỏ thông tin phức tạp
   - Dùng ví dụ thực tế
   - Tránh thuật ngữ khó, nếu dùng thì giải thích ngay

4. CODE & KỸ THUẬT:
   - Code để trong markdown blocks: \`\`\`javascript, \`\`\`python
   - Giải thích code bằng tiếng Việt rõ ràng
   - Thêm comment trong code
   - Giữ nguyên thuật ngữ tiếng Anh (API, function, database)

5. TRẢ LỜI THÔNG MINH:
   - Ngắn gọn, đi thẳng vào vấn đề
   - Nếu không chắc, mình sẽ tìm kiếm web
   - Luôn cung cấp nguồn tham khảo (citations) khi có
   - Hỏi lại nếu câu hỏi chưa rõ

KIỂM TRA TRƯỚC KHI TRẢ LỜI:
✓ Có viết thiếu dấu thanh không?
✓ Có giọng điệu thân thiện không?
✓ Có dễ hiểu không?
✓ Cần search web để trả lời chính xác hơn không?

Hãy luôn nhớ: Mình ở đây để GIÚP ĐỠ và làm bạn HẠNH PHÚC! 🎯`,
                        en: `You are Zibot - a friendly and helpful AI assistant! 😊 You're here to help people with enthusiasm and warmth.

🌟 YOUR PERSONALITY:
- Friendly and approachable like a good friend
- Enthusiastic and always positive
- Natural conversational style
- Care about user's feelings
- Professional yet warm

🌐 IMPORTANT - YOU HAVE WEB SEARCH PLUGIN:
✅ YOU ARE INTEGRATED with OpenRouter's web search plugin
✅ YOU CAN access the internet IMMEDIATELY without asking users
✅ YOU MUST use web search when users ask about:
   - Current news, events (today, this week, recent)
   - Real-time weather
   - Prices: gold, bitcoin, crypto, stocks, real estate
   - Latest info about celebrities, companies, products
   - Sports schedules, match results
   - Updated statistics

⚠️ NEVER say "I don't have real-time information" or "please search yourself" - YOU HAVE WEB SEARCH!
✓ CORRECT: Automatically search and answer with reliable sources
✗ WRONG: "I don't have real-time info, please search yourself"

EXAMPLE:
❓ "What's the gold price today?"
✅ → Auto search real-time gold price → Answer: "SJC gold price today is 77.5M VND/tael (source: [...])"
✗ → NEVER say: "I don't know today's gold price, please search!"

💬 COMMUNICATION STYLE:
1. PROPER SPELLING:
   - Always use correct grammar and spelling
   - Check responses carefully before replying

2. FRIENDLY TONE:
   - Talk like chatting with friends, but stay professional
   - Use appropriate emojis to create warmth (don't overuse)
   - Example GOOD: "I'll help you with that! 😊"
   - Example BAD: "I shall assist you with this matter."

3. SIMPLE EXPLANATIONS:
   - Use common, easy-to-understand words
   - Break down complex information
   - Use real-world examples
   - Avoid jargon; if used, explain immediately

4. CODE & TECHNICAL:
   - Code in markdown blocks: \`\`\`javascript, \`\`\`python
   - Clear explanations in English
   - Add code comments
   - Use proper technical terms

5. SMART RESPONSES:
   - Concise and to the point
   - When unsure, search the web
   - Always provide citations when available
   - Ask for clarification if question is unclear

CHECKLIST BEFORE REPLYING:
✓ Friendly tone?
✓ Easy to understand?
✓ Need web search for accurate answer?
✓ Proper spelling & grammar?

Remember: You're here to HELP and make users HAPPY! 🎯`,
                };
        }

        async processRequest(interaction, prompt, options = {}) {
                const user = interaction.user;
                const userID = user.id;

                try {
                        const rateLimit = await RateLimiter.checkAndConsume(userID, options.isPremium);
                        if (!rateLimit.allowed) {
                                return {
                                        error: true,
                                        message: `⏰ Bạn đã dùng hết quota hôm nay (${rateLimit.quota} lượt).\nQuota sẽ được reset sau ${rateLimit.resetIn} giờ.`,
                                };
                        }

                        const detectedLang = options.language || LanguageDetector.detect(prompt);
                        const language = detectedLang === "auto" ? "vi" : detectedLang;

                        if (!options.attachments || options.attachments.length === 0) {
                                const cached = await CacheManager.get(prompt, language, options.model || this.defaultModel);
                                if (cached && !options.skipCache) {
                                        return {
                                                response: cached.response,
                                                fromCache: true,
                                                language,
                                                remaining: rateLimit.remaining,
                                        };
                                }
                        }

                        const thread = await ContextManager.getOrCreateThread(userID, options.threadId);

                        const messages = await this.buildMessages(thread, prompt, language, interaction, options);

                        let response;
                        let usedFallback = false;
                        let fallbackModel = null;

                        if (options.streaming) {
                                const header = this.buildHeader(interaction, prompt);
                                response = await StreamingService.streamResponse(
                                        interaction,
                                        options.model || this.defaultModel,
                                        messages,
                                        options.apiKey,
                                        header
                                );
                        } else {
                                const result = await ErrorHandler.executeWithRetry(
                                        async () => {
                                                return await ErrorHandler.callOpenRouterAPI(
                                                        options.model || this.defaultModel,
                                                        messages,
                                                        options.apiKey
                                                );
                                        },
                                        {
                                                maxRetries: 3,
                                                useFallback: true,
                                                apiCall: async (model, key) => {
                                                        return await ErrorHandler.callOpenRouterAPI(model, messages, key);
                                                },
                                                apiKey: options.apiKey,
                                        }
                                );

                                response = result.data?.choices?.[0]?.message?.content;
                                usedFallback = result.usedFallback || false;
                                fallbackModel = result.fallbackModel || null;
                        }

                        if (!response) {
                                throw new Error("Empty response from API");
                        }

                        await ContextManager.addMessage(thread.threadId, "user", prompt, 0);
                        await ContextManager.addMessage(thread.threadId, "assistant", response, 0);

                        await UserPreferenceManager.learnFromInteraction(interaction.user.id, prompt, response);

                        if (!options.skipCache && !usedFallback && (!options.attachments || options.attachments.length === 0)) {
                                await CacheManager.set(prompt, response, language, options.model || this.defaultModel);
                        }

                        return {
                                response,
                                fromCache: false,
                                language,
                                remaining: rateLimit.remaining,
                                threadId: thread.threadId,
                                usedFallback,
                                fallbackModel,
                        };
                } catch (error) {
                        console.error("AIService Error:", error);
                        return {
                                error: true,
                                message: ErrorHandler.getUserFriendlyError(error),
                                technicalError: error.message,
                        };
                }
        }

        async buildMessages(thread, prompt, language, interaction, options) {
                const systemPrompt = await this.buildSystemPrompt(language, interaction);
                
                const messages = [
                        {
                                role: "system",
                                content: systemPrompt,
                        },
                ];

                if (thread.summary) {
                        messages.push({
                                role: "system",
                                content: `Previous conversation summary:\n${thread.summary}`,
                        });
                }

                const conversationHistory = await ContextManager.getMessages(thread.threadId, null);
                messages.push(...conversationHistory.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                })));

                if (options.attachments && options.attachments.length > 0) {
                        const visionMessage = AttachmentProcessor.createVisionMessage(prompt, options.attachments);
                        messages.push(visionMessage);
                } else {
                        messages.push({
                                role: "user",
                                content: prompt,
                        });
                }

                return messages;
        }

        async buildSystemPrompt(language, interaction) {
                let basePrompt = this.systemPromptTemplate[language] || this.systemPromptTemplate.en;

                if (interaction.guild) {
                        const guildName = interaction.guild.name;
                        const memberCount = interaction.guild.memberCount;
                        basePrompt += `\n\nYou are currently in the Discord server "${guildName}" with ${memberCount} members.`;
                }

                if (interaction.member) {
                        const roles = interaction.member.roles.cache
                                .filter(role => role.name !== "@everyone")
                                .map(role => role.name)
                                .join(", ");
                        
                        if (roles) {
                                basePrompt += `\n\nThe user has the following roles: ${roles}.`;
                        }
                }

                const userPreferences = await UserPreferenceManager.getUserPreferences(interaction.user.id);
                
                if (userPreferences.contextAware) {
                        const channelContext = await ContextAnalyzer.analyzeChannelContext(interaction);
                        if (channelContext) {
                                basePrompt += ContextAnalyzer.buildContextPrompt(channelContext);
                        }

                        basePrompt += UserPreferenceManager.buildPreferencePrompt(userPreferences);
                }

                return basePrompt;
        }

        buildHeader(interaction, prompt) {
                return `### 🌟 Kết quả từ Polaris-Alpha\n**Prompt:** ${prompt}\n**Hỏi bởi:** ${interaction.user.username}\n\n`;
        }

        async recordFeedback(userID, messageId, threadId, rating, prompt, response) {
                return await FeedbackHandler.recordFeedback(userID, messageId, threadId, rating, prompt, response);
        }

        async getUsageStats(userID) {
                return await RateLimiter.getUsageStats(userID);
        }

        async getCacheStats() {
                return await CacheManager.getStats();
        }

        async getFeedbackStats(userID = null) {
                return await FeedbackHandler.getFeedbackStats(userID);
        }

        async listThreads(userID, limit = 10) {
                return await ContextManager.listThreads(userID, limit);
        }

        async switchThread(userID, threadId) {
                return await ContextManager.switchThread(userID, threadId);
        }

        async deleteThread(threadId, userID) {
                return await ContextManager.deleteThread(threadId, userID);
        }

        async renameThread(threadId, userID, newName) {
                return await ContextManager.renameThread(threadId, userID, newName);
        }
}

module.exports = new AIService();
