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
const GeminiSearch = require("./GeminiSearch");
const ImageGenerator = require("./ImageGenerator");
const GroqService = require("./GroqService");
const MegaLLMService = require("./MegaLLMService");

class AIService {
        constructor() {
                this.defaultModel = "groq";
                this.groqService = null;
                this.megaLLMService = null;
                this.tools = [
                        {
                                type: "function",
                                function: {
                                        name: "web_search",
                                        description: "Search the web using Google Search (powered by Gemini) to get real-time information about current events, news, prices, weather, and any up-to-date information. Use this when you need fresh data or when the user asks about current information.",
                                        parameters: {
                                                type: "object",
                                                properties: {
                                                        query: {
                                                                type: "string",
                                                                description: "The search query (in Vietnamese or English)",
                                                        },
                                                        max_results: {
                                                                type: "number",
                                                                description: "Maximum number of results to return (default: 5)",
                                                                default: 5,
                                                        },
                                                },
                                                required: ["query"],
                                        },
                                },
                        },
                        {
                                type: "function",
                                function: {
                                        name: "image_gen",
                                        description: "Generate AI images using Google Imagen 3 based on text descriptions. Use this when the user asks to create, generate, or make an image/picture/photo. Prompts must be in English for best results.",
                                        parameters: {
                                                type: "object",
                                                properties: {
                                                        prompt: {
                                                                type: "string",
                                                                description: "Detailed description of the image to generate (in English or Vietnamese). Be specific about subjects, style, mood, colors, composition, and details.",
                                                        },
                                                        size: {
                                                                type: "string",
                                                                description: "Image size. Options: '1024x1024' (square, default), '1024x1792' (portrait), '1792x1024' (landscape)",
                                                                enum: ["1024x1024", "1024x1792", "1792x1024"],
                                                                default: "1024x1024",
                                                        },
                                                        style: {
                                                                type: "string",
                                                                description: "Image style. 'vivid' (hyper-real, dramatic) or 'natural' (natural, less hyper-real)",
                                                                enum: ["vivid", "natural"],
                                                                default: "vivid",
                                                        },
                                                },
                                                required: ["prompt"],
                                        },
                                },
                        },
                ];
                this.systemPromptTemplate = {
                        vi: `Bạn là Zibot - trợ lý AI thân thiện, giúp đỡ người dùng trên Discord một cách nhiệt tình! 😊

**CÔNG CỤ CỦA BẠN:**
• web_search: Tìm kiếm real-time (tin tức, giá cả, thời tiết, thống kê)
• image_gen: Tạo ảnh AI với Google Imagen 3

**KHI NÀO GỌI WEB_SEARCH:**
Luôn gọi khi user hỏi về thông tin thời gian thực:
• Giá cả (vàng, crypto, cổ phiếu)
• Tin tức, sự kiện hiện tại
• Thời tiết hôm nay
• Thống kê, dữ liệu mới nhất

**KHI NÀO GỌI IMAGE_GEN:**
Khi user yêu cầu tạo/vẽ/thiết kế ảnh. Mô tả CHI TIẾT bằng tiếng Anh (chủ thể, style, màu sắc, cảm xúc).

**NGUYÊN TẮC TRẢ LỜI:**
• Ngắn gọn, đi thẳng vào vấn đề (3-5 điểm chính)
• Dùng bullet points (•) thay vì đánh số
• Dùng **bold** cho ý quan trọng
• Code blocks với syntax highlighting
• Hiểu ngữ cảnh hội thoại để trả lời đúng chủ đề
• Tránh lặp lại NGUYÊN VĂN câu trả lời cũ - hãy diễn đạt theo cách mới
• Viết tiếng Việt có dấu chuẩn, giọng thân thiện (mình/bạn)

**VÍ DỤ:**
User: "Giá vàng hôm nay?"
✅ Gọi web_search("giá vàng SJC hôm nay") → Trả lời với số liệu cụ thể
❌ "Em không biết, bạn tự search nhé"

Hãy giúp đỡ nhiệt tình và hiệu quả! 🎯`,
                        en: `You are Zibot - a friendly and helpful AI assistant! 😊 You're here to help people with enthusiasm and warmth.

🌟 YOUR PERSONALITY:
- Friendly and approachable like a good friend
- Enthusiastic and always positive
- Natural conversational style
- Care about user's feelings
- Professional yet warm

🌐 IMPORTANT - YOU HAVE SPECIAL TOOLS:

📡 **TOOL 1: WEB_SEARCH**
✅ YOU HAVE "web_search" function to get real-time information
✅ ALWAYS call web_search when users ask about:
   - Current news, events (today, this week, recent)
   - Real-time weather
   - Prices: gold, bitcoin, crypto, stocks, real estate
   - Latest info about celebrities, companies, products
   - Sports schedules, match results
   - Updated statistics

⚠️ NEVER say "I don't have real-time information" - CALL web_search!
✓ CORRECT: Call web_search("gold price today") → Answer with reliable sources
✗ WRONG: "I don't have real-time info, please search yourself"

🎨 **TOOL 2: IMAGE_GEN (GOOGLE IMAGEN 3)**
✅ YOU HAVE "image_gen" function to generate high-quality AI images with Google Imagen 3
✅ CALL image_gen when users request:
   - "Create an image", "draw for me", "generate picture"
   - "Make an illustration", "design an image"
   - Specific descriptions of scenes/characters/objects they want to see

⚠️ IMAGE GENERATION NOTES:
✓ Be DETAILED in ENGLISH: subject, style, colors, composition, mood
✓ Choose SIZE: 1024x1024 (square), 1024x1792 (portrait), 1792x1024 (landscape)
✓ Choose STYLE: "vivid" (hyper-real, dramatic) or "natural" (natural, less hyper-real)
✗ DON'T create images of real people (celebrities, politicians)
✗ DON'T create violent, adult content, or copyrighted material

EXAMPLE:
❓ "Draw me a cute cat"
✅ → Call image_gen("A cute fluffy orange cat with big eyes, sitting on a soft pillow, warm lighting, cozy home setting, digital art style") → Image will be attached to the response

🔴 IMPORTANT ABOUT CONVERSATION HISTORY & CHANNEL CONTEXT:
• Conversation history and recent channel messages are ONLY FOR REFERENCE to understand context
• NEVER repeat, quote, or copy content from old messages
• DO NOT refer to what others said (e.g., "As Alice said...", "According to Bob...")
• ONLY answer DIRECTLY to the user's current question

📌 WHEN YOU SEE REPLY/QUOTED MESSAGES:
✅ CORRECT: Understand the context to answer the right topic
✗ WRONG: "Alice asked about Python and you replied that..."
✗ WRONG: Quote the original message content

**REAL EXAMPLE:**
Context: [Reply to Alice: "Do you like Python?"] Bob: I love it!
Question: "Why?"

✅ CORRECT: "Python is easy to learn, simple syntax, rich libraries..."
✗ WRONG: "You asked 'Why?' about Bob's answer when Alice asked about Python..."

EXAMPLE:
❓ "What's the gold price today?"
✅ → Call web_search("SJC gold price today") → Read results → Answer: "SJC gold price today is... (source: [URL])"
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
                        this.currentRequestImages = [];
                        const rateLimit = await RateLimiter.checkAndConsume(userID, options.isPremium);
                        if (!rateLimit.allowed) {
                                return {
                                        error: true,
                                        message: `⏰ Bạn đã dùng hết quota hôm nay (${rateLimit.quota} lượt).\nQuota sẽ được reset sau ${rateLimit.resetIn} giờ.`,
                                };
                        }

                        const detectedLang = options.language || LanguageDetector.detect(prompt);
                        const language = detectedLang === "auto" ? "vi" : detectedLang;

                        const isRoomContext = options.isRoomContext || false;
                        let thread = await ContextManager.getOrCreateThread(userID, options.threadId, isRoomContext);
                        const initialThreadId = thread.threadId;
                        
                        const modelToUse = options.model || this.defaultModel;
                        const messageSource = modelToUse.startsWith("gpt-") || modelToUse.startsWith("claude-") || modelToUse.startsWith("gemini-2.5-") ? "megallm" : (modelToUse === "groq" || modelToUse.startsWith("openai/") || modelToUse.startsWith("llama") || modelToUse.startsWith("mixtral") || modelToUse.startsWith("qwen") || modelToUse.startsWith("gemma") ? "groq" : "huggingface");
                        
                        thread = await ContextManager.getOrCreateThread(userID, initialThreadId, isRoomContext);
                        
                        await ContextManager.addMessage(thread.threadId, "user", prompt, 0, messageSource);
                        
                        const isMegaLLMModel = modelToUse === "megallm" || modelToUse === "gpt-5" || modelToUse === "gpt-5-mini" || modelToUse.startsWith("claude-") || modelToUse.startsWith("gemini-2.5-");
                        const isGroqModel = !isMegaLLMModel && (modelToUse === "groq" || modelToUse.startsWith("llama-") || modelToUse.startsWith("openai/") || modelToUse.startsWith("meta-llama/") || modelToUse.startsWith("qwen/") || modelToUse.startsWith("mixtral-") || modelToUse.startsWith("gemma-"));
                        const isLLaVAModel = modelToUse.includes("llava");
                        const isHuggingFaceModel = !isGroqModel && !isMegaLLMModel && (modelToUse.includes("llama") || modelToUse.includes("mistral") || modelToUse.includes("phi") || modelToUse.includes("llava"));
                        const hasConversationHistory = (thread.messages && thread.messages.length > 0) || thread.summary;

                        if (!options.attachments || options.attachments.length === 0) {
                                if (!hasConversationHistory) {
                                        const cached = await CacheManager.get(prompt, language, modelToUse);
                                        if (cached && !options.skipCache) {
                                                console.log(`[AIService] ✅ Cache hit for prompt: ${prompt.substring(0, 50)}...`);
                                                return {
                                                        response: cached.response,
                                                        fromCache: true,
                                                        language,
                                                        remaining: rateLimit.remaining,
                                                };
                                        }
                                } else {
                                        const msgCount = thread.messages?.length || 0;
                                        const hasSummary = thread.summary ? " + summary" : "";
                                        console.log(`[AIService] ⏭️ Skipping cache due to conversation history (${msgCount} messages${hasSummary})`);
                                }
                        }

                        const messages = await this.buildMessages(thread, prompt, language, interaction, options);

                        let response;
                        let usedFallback = false;
                        let fallbackModel = null;

                        if (isMegaLLMModel) {
                                        console.log(`[AIService] 🚀 Calling MegaLLM model with ${messages.length} messages in context`);
                                        if (!this.megaLLMService) {
                                                throw new Error("MegaLLM service not initialized. Please check MEGALLM_API_KEY.");
                                        }
                                        
                                        let selectedModel = modelToUse;
                                        if (modelToUse === "megallm") {
                                                selectedModel = "gpt-5";
                                                console.log(`[AIService] 🔧 Using GPT-5 as default MegaLLM model: ${selectedModel}`);
                                        }
                                        
                                        const megaLLMResult = await this.callMegaLLMWithTools(messages, {
                                                model: selectedModel,
                                                temperature: 0.8,
                                                maxTokens: 4096,
                                        });
                                        
                                        response = megaLLMResult;
                                        console.log(`[AIService] ✅ MegaLLM response received (${response?.length || 0} chars)`);
                        } else if (isGroqModel) {
                                        console.log(`[AIService] 🚀 Calling Groq model with ${messages.length} messages in context`);
                                        if (!this.groqService) {
                                                throw new Error("Groq service not initialized. Please check GROQ_API_KEY.");
                                        }
                                        
                                        let selectedModel = modelToUse;
                                        if (modelToUse === "groq") {
                                                selectedModel = "openai/gpt-oss-120b";
                                                console.log(`[AIService] 🔧 Using OpenAI GPT-OSS 120B with built-in capabilities: ${selectedModel}`);
                                        }
                                        
                                        const groqResult = await this.callGroqWithTools(messages, {
                                                model: selectedModel,
                                                temperature: 0.8,
                                                maxTokens: 32768,
                                        });
                                        
                                        response = groqResult;
                                        console.log(`[AIService] ✅ Groq response received (${response?.length || 0} chars)`);
                        } else if (isHuggingFaceModel) {
                                        console.log(`[AIService] Calling Hugging Face model with ${messages.length} messages in context`);
                                        const toolResult = await this.callModelWithTools(
                                                messages,
                                                modelToUse,
                                                options.apiKey
                                        );
                                        response = toolResult.response;
                                        console.log(`[AIService] ✅ Received response (${response?.length || 0} chars)`);
                                        if (response) {
                                                console.log(`[AIService] Response preview: ${response.substring(0, 150)}...`);
                                        }
                        } else {
                                const result = await ErrorHandler.executeWithRetry(
                                        async () => {
                                                return await ErrorHandler.callHuggingFaceAPI(
                                                        modelToUse,
                                                        messages,
                                                        options.apiKey
                                                );
                                        },
                                        {
                                                maxRetries: 3,
                                                useFallback: true,
                                                apiCall: async (model, key) => {
                                                        return await ErrorHandler.callHuggingFaceAPI(model, messages, key);
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

                        console.log(`[AIService] Saving assistant response to thread ${thread.threadId.substring(0, 8)}`);
                        await ContextManager.addMessage(thread.threadId, "assistant", response, 0, messageSource);
                        console.log(`[AIService] ✅ Conversation saved. Thread now has ${(thread.messages?.length || 0) + 1} messages`);

                        await UserPreferenceManager.learnFromInteraction(interaction.user.id, prompt, response);

                        if (!options.skipCache && !usedFallback && (!options.attachments || options.attachments.length === 0)) {
                                if (!hasConversationHistory) {
                                        await CacheManager.set(prompt, response, language, modelToUse);
                                        console.log(`[AIService] ✅ Cached response for future use`);
                                } else {
                                        console.log(`[AIService] ⏭️ Skipping cache write due to conversation context`);
                                }
                        }

                        const result = {
                                response,
                                fromCache: false,
                                language,
                                remaining: rateLimit.remaining,
                                threadId: thread.threadId,
                                usedFallback,
                                fallbackModel,
                        };
                        
                        if (this.currentRequestImages && this.currentRequestImages.length > 0) {
                                result.generatedImage = this.currentRequestImages[0];
                        }
                        
                        this.currentRequestImages = [];
                        
                        return result;
                } catch (error) {
                        console.error("AIService Error:", error);
                        return {
                                error: true,
                                message: ErrorHandler.getUserFriendlyError(error),
                                technicalError: error.message,
                        };
                } finally {
                        this.currentRequestImages = [];
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

                const modelToUse = options.model || this.defaultModel;
                const isMegaLLMModel = modelToUse === "megallm" || modelToUse === "gpt-5" || modelToUse === "gpt-5-mini" || modelToUse.startsWith("claude-") || modelToUse.startsWith("gemini-2.5-");
                const isGroqModel = !isMegaLLMModel && (modelToUse === "groq" || modelToUse.startsWith("llama-") || modelToUse.startsWith("openai/") || modelToUse.startsWith("meta-llama/") || modelToUse.startsWith("qwen/") || modelToUse.startsWith("mixtral-") || modelToUse.startsWith("gemma-"));
                const isHuggingFaceModel = !isGroqModel && !isMegaLLMModel && (modelToUse.includes("llama") || modelToUse.includes("mistral") || modelToUse.includes("phi") || modelToUse.includes("llava"));
                
                const hasAttachments = options.attachments && options.attachments.length > 0;
                
                if ((isMegaLLMModel || isGroqModel || isHuggingFaceModel) && thread.messages && thread.messages.length > 0) {
                        const relevantMessages = thread.messages;
                        let selectedMessages = [];
                        let totalChars = 0;
                        
                        if (isGroqModel) {
                                const MAX_MESSAGES = hasAttachments ? 5 : 10;
                                selectedMessages = relevantMessages.slice(-MAX_MESSAGES);
                                totalChars = selectedMessages.reduce((sum, msg) => {
                                        const contentStr = this.normalizeMessageContent(msg.content);
                                        return sum + contentStr.length;
                                }, 0);
                                
                                if (thread.summary && relevantMessages.length > MAX_MESSAGES) {
                                        messages.push({
                                                role: "system",
                                                content: `📝 Context từ lịch sử cũ hơn: ${thread.summary}`
                                        });
                                        console.log(`[AIService] 📝 Added conversation summary for Groq context (${thread.summary.length} chars)`);
                                }
                                
                                console.log(`[AIService] 📚 Loading last ${selectedMessages.length}/${relevantMessages.length} messages for Groq (TPM limit protection)${hasAttachments ? ' (reduced for image)' : ''}`);
                        } else {
                                let MAX_CONTEXT_CHARS = hasAttachments ? 2000 : 400000;
                                
                                for (let i = relevantMessages.length - 1; i >= 0; i--) {
                                        const msg = relevantMessages[i];
                                        const contentStr = this.normalizeMessageContent(msg.content);
                                        const msgChars = contentStr.length;
                                        
                                        if (totalChars + msgChars <= MAX_CONTEXT_CHARS) {
                                                selectedMessages.unshift(msg);
                                                totalChars += msgChars;
                                        } else {
                                                break;
                                        }
                                }
                                
                                console.log(`[AIService] 📚 Loading ${selectedMessages.length}/${relevantMessages.length} messages from database thread ${thread.threadId.substring(0, 8)}${hasAttachments ? ' (reduced for image)' : ''}`);
                        }
                        
                        for (const msg of selectedMessages) {
                                messages.push({
                                        role: msg.role,
                                        content: this.normalizeMessageContent(msg.content),
                                });
                        }
                        
                        if (selectedMessages.length > 0) {
                                const avgChars = Math.round(totalChars / selectedMessages.length);
                                const skippedCount = relevantMessages.length - selectedMessages.length;
                                console.log(`[AIService] 📊 Context loaded from DB: ${selectedMessages.length} messages, ${totalChars.toLocaleString()} chars (avg ${avgChars}/msg)${skippedCount > 0 ? ` | ⚠️ Skipped ${skippedCount} oldest` : ''}${hasAttachments ? ' | 🖼️ With image attachment' : ''}`);
                        }
                }

                const lastThreadMessage = thread.messages && thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null;
                const currentPromptAlreadyInThread = lastThreadMessage && lastThreadMessage.role === "user" && lastThreadMessage.content === prompt;
                
                if (!currentPromptAlreadyInThread) {
                        if (options.attachments && options.attachments.length > 0) {
                                if (!AttachmentProcessor.hasVisionCapability(modelToUse)) {
                                        throw new Error(`Model ${modelToUse} không hỗ trợ phân tích ảnh. Vui lòng sử dụng model có vision capability (ví dụ: Groq vision models).`);
                                }
                                
                                const visionMessage = await AttachmentProcessor.createVisionMessage(prompt, options.attachments);
                                messages.push(visionMessage);
                        } else {
                                messages.push({
                                        role: "user",
                                        content: prompt,
                                });
                        }
                }

                console.log(`[AIService] ✅ Sending ${messages.length} messages to API (smart context window)`);
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
                
                const isAIRoom = interaction.channel?.name?.startsWith("ai-groq-") || interaction.channel?.name?.startsWith("ai-ask-") || interaction.channel?.name?.startsWith("ai-gpt5-");
                
                if (userPreferences.contextAware && !isAIRoom) {
                        const channelContext = await ContextAnalyzer.analyzeChannelContext(interaction);
                        if (channelContext) {
                                basePrompt += ContextAnalyzer.buildContextPrompt(channelContext);
                        }

                        basePrompt += UserPreferenceManager.buildPreferencePrompt(userPreferences);
                } else if (userPreferences.contextAware && isAIRoom) {
                        basePrompt += UserPreferenceManager.buildPreferencePrompt(userPreferences);
                }

                return basePrompt;
        }

        normalizeMessageContent(content) {
                if (typeof content === 'string') {
                        return content;
                }
                
                if (Array.isArray(content)) {
                        const textParts = content
                                .filter(item => item.type === 'text')
                                .map(item => item.text);
                        
                        const hasImage = content.some(item => item.type === 'image_url');
                        const text = textParts.join(' ').trim();
                        
                        return hasImage ? `${text} [đã gửi ảnh]` : text;
                }
                
                return String(content);
        }

        buildHeader(interaction, prompt) {
                return `### 🌟 Groq AI\n\n`;
        }

        initializeGroq(apiKey) {
                if (!apiKey) {
                        console.warn("[AIService] ⚠️ GROQ_API_KEY not provided, Groq service will not be available");
                        return;
                }
                try {
                        this.groqService = new GroqService(apiKey);
                        console.log("[AIService] ✅ Groq service initialized successfully");
                } catch (error) {
                        console.error("[AIService] ❌ Failed to initialize Groq service:", error.message);
                }
        }

        initializeMegaLLM(apiKey) {
                if (!apiKey) {
                        console.warn("[AIService] ⚠️ MEGALLM_API_KEY not provided, MegaLLM service will not be available");
                        return;
                }
                try {
                        this.megaLLMService = new MegaLLMService(apiKey);
                        console.log("[AIService] ✅ MegaLLM service initialized successfully");
                } catch (error) {
                        console.error("[AIService] ❌ Failed to initialize MegaLLM service:", error.message);
                }
        }

        async executeToolCall(toolCall) {
                try {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        if (functionName === "web_search") {
                                const query = args.query;
                                const maxResults = args.max_results || 5;
                                const searchData = await GeminiSearch.search(query, maxResults);
                                
                                if (!searchData.success) {
                                        return `Lỗi khi tìm kiếm: ${searchData.message}`;
                                }

                                return GeminiSearch.formatResultsForAI(searchData);
                        }

                        if (functionName === "image_gen") {
                                console.log("[AIService] image_gen tool called with args:", args);
                                const { prompt, size, style } = args;
                                
                                const validation = ImageGenerator.validatePrompt(prompt);
                                if (!validation.valid) {
                                        console.warn("[AIService] Image prompt validation failed:", validation.error);
                                        return `❌ Lỗi validate prompt: ${validation.error}`;
                                }

                                try {
                                        const imageResult = await ImageGenerator.generateImage(prompt, { size, style });
                                        
                                        if (!imageResult.success) {
                                                console.error("[AIService] Image generation failed but no exception thrown");
                                                return `❌ Không thể tạo ảnh. Vui lòng thử lại sau.`;
                                        }

                                        console.log("[AIService] ✅ Image generation successful with Imagen 3");
                                        
                                        if (!this.currentRequestImages) {
                                                this.currentRequestImages = [];
                                        }
                                        
                                        this.currentRequestImages.push({
                                                base64: imageResult.base64,
                                                mimeType: imageResult.mimeType,
                                                prompt: imageResult.originalPrompt,
                                        });
                                        
                                        return `✅ **Ảnh đã được tạo thành công bởi Google Imagen 3!**

**Mô tả:** ${imageResult.originalPrompt}

*Ảnh sẽ được gửi kèm theo phản hồi này.*`;
                                } catch (imageError) {
                                        console.error("[AIService] Image generation error:", imageError.message);
                                        return `❌ Không thể tạo ảnh: ${imageError.message}`;
                                }
                        }

                        return `Unknown tool: ${functionName}`;
                } catch (error) {
                        console.error("[executeToolCall Error]:", error.message);
                        return `Lỗi khi thực thi tool: ${error.message}`;
                }
        }

        async callGroqWithTools(messages, options = {}, maxToolCalls = 3) {
                let currentMessages = [...messages];
                let toolCallCount = 0;
                const toolFailures = {};

                while (true) {
                        const groqResult = await this.groqService.chat(currentMessages, {
                                ...options,
                                tools: this.tools,
                        });

                        if (typeof groqResult === 'string') {
                                return groqResult;
                        }

                        if (groqResult.toolCalls && groqResult.toolCalls.length > 0) {
                                if (toolCallCount >= maxToolCalls) {
                                        console.warn(`[Groq Tool Calling] Reached max tool calls (${maxToolCalls})`);
                                        return groqResult.message.content || "Đã đạt giới hạn số lần gọi công cụ. Vui lòng hỏi lại.";
                                }

                                currentMessages.push(groqResult.message);

                                for (const toolCall of groqResult.toolCalls) {
                                        if (toolCallCount >= maxToolCalls) {
                                                break;
                                        }

                                        const toolName = toolCall.function.name;
                                        
                                        if (toolFailures[toolName] >= 2) {
                                                console.warn(`[Circuit Breaker] Tool ${toolName} failed 2 times, returning error to user`);
                                                currentMessages.push({
                                                        role: "tool",
                                                        tool_call_id: toolCall.id,
                                                        name: toolName,
                                                        content: `❌ Không thể sử dụng công cụ ${toolName === 'web_search' ? 'tìm kiếm web' : toolName} lúc này. Vui lòng thử lại sau.`,
                                                });
                                                toolCallCount++;
                                                continue;
                                        }

                                        const toolResult = await this.executeToolCall(toolCall);
                                        
                                        if (toolResult.includes("❌") || toolResult.includes("Lỗi")) {
                                                toolFailures[toolName] = (toolFailures[toolName] || 0) + 1;
                                                console.log(`[Tool Failure Tracking] ${toolName} failed ${toolFailures[toolName]} times`);
                                        }

                                        currentMessages.push({
                                                role: "tool",
                                                tool_call_id: toolCall.id,
                                                name: toolName,
                                                content: toolResult,
                                        });

                                        toolCallCount++;
                                }
                        } else {
                                return groqResult;
                        }
                }
        }

        async callMegaLLMWithTools(messages, options = {}, maxToolCalls = 3) {
                let currentMessages = [...messages];
                let toolCallCount = 0;
                const toolFailures = {};

                while (true) {
                        const megaLLMResult = await this.megaLLMService.chat(currentMessages, {
                                ...options,
                                tools: this.tools,
                        });

                        if (megaLLMResult.content) {
                                return megaLLMResult.content;
                        }

                        if (megaLLMResult.toolCalls && megaLLMResult.toolCalls.length > 0) {
                                if (toolCallCount >= maxToolCalls) {
                                        console.warn(`[MegaLLM Tool Calling] Reached max tool calls (${maxToolCalls})`);
                                        return megaLLMResult.message.content || "Đã đạt giới hạn số lần gọi công cụ. Vui lòng hỏi lại.";
                                }

                                currentMessages.push(megaLLMResult.message);

                                for (const toolCall of megaLLMResult.toolCalls) {
                                        if (toolCallCount >= maxToolCalls) {
                                                break;
                                        }

                                        const toolName = toolCall.function.name;
                                        
                                        if (toolFailures[toolName] >= 2) {
                                                console.warn(`[Circuit Breaker] Tool ${toolName} failed 2 times, returning error to user`);
                                                currentMessages.push({
                                                        role: "tool",
                                                        tool_call_id: toolCall.id,
                                                        name: toolName,
                                                        content: `❌ Không thể sử dụng công cụ ${toolName === 'web_search' ? 'tìm kiếm web' : toolName} lúc này. Vui lòng thử lại sau.`,
                                                });
                                                toolCallCount++;
                                                continue;
                                        }

                                        const toolResult = await this.executeToolCall(toolCall);
                                        
                                        if (toolResult.includes("❌") || toolResult.includes("Lỗi")) {
                                                toolFailures[toolName] = (toolFailures[toolName] || 0) + 1;
                                                console.log(`[Tool Failure Tracking] ${toolName} failed ${toolFailures[toolName]} times`);
                                        }

                                        currentMessages.push({
                                                role: "tool",
                                                tool_call_id: toolCall.id,
                                                name: toolName,
                                                content: toolResult,
                                        });

                                        toolCallCount++;
                                }
                        } else {
                                throw new Error("Unexpected response format from MegaLLM service");
                        }
                }
        }

        async callModelWithTools(messages, model, apiKey, maxToolCalls = 5) {
                let currentMessages = [...messages];
                let toolCallCount = 0;

                while (true) {
                        let result;
                        try {
                                result = await ErrorHandler.executeWithRetry(
                                        async () => {
                                                return await ErrorHandler.callHuggingFaceAPI(
                                                        model,
                                                        currentMessages,
                                                        apiKey,
                                                        false,
                                                        this.tools
                                                );
                                        },
                                        {
                                                maxRetries: 3,
                                                useFallback: false,
                                                apiKey,
                                        }
                                );
                        } catch (error) {
                                console.error("[callModelWithTools Error]:", error.message);
                                throw error;
                        }

                        const assistantMessage = result.data?.choices?.[0]?.message;

                        if (!assistantMessage) {
                                throw new Error("No assistant message in response");
                        }

                        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
                                return {
                                        response: assistantMessage.content,
                                        messages: currentMessages,
                                };
                        }

                        if (toolCallCount >= maxToolCalls) {
                                console.warn(`[Tool Calling] Reached max tool calls (${maxToolCalls}), but LLaVA still wants to call tools. Returning partial response.`);
                                return {
                                        response: assistantMessage.content || "Đã đạt giới hạn số lần tìm kiếm. Vui lòng hỏi lại câu hỏi khác.",
                                        messages: currentMessages,
                                };
                        }

                        currentMessages.push(assistantMessage);

                        for (const toolCall of assistantMessage.tool_calls) {
                                if (toolCallCount >= maxToolCalls) {
                                        console.warn(`[Tool Calling] Stopping at ${toolCallCount} tool calls`);
                                        break;
                                }

                                const toolResult = await this.executeToolCall(toolCall);

                                currentMessages.push({
                                        role: "tool",
                                        tool_call_id: toolCall.id,
                                        name: toolCall.function.name,
                                        content: toolResult,
                                });

                                toolCallCount++;
                        }
                }
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
