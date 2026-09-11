const { useFunctions, useConfig, useDB } = require("@zibot/zihooks");
const { useQueue } = require("discord-player");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getDisplayName } = require("../../config/aiModels");
const config = useConfig();

module.exports.data = {
        name: "ai",
        description: "Tính năng AI",
        type: 1, // lệnh slash
        options: [
                {
                        name: "ask",
                        description: "Hỏi AI hoặc tạo phòng chat AI",
                        type: 1,
                        options: [
                                {
                                        name: "prompt",
                                        description: "Tin nhắn để gửi (bỏ trống để tạo phòng chat AI)",
                                        type: 3,
                                        required: false,
                                },
                        ],
                },
                {
                        name: "groq",
                        description: "Hỏi Groq AI hoặc tạo phòng chat AI",
                        type: 1,
                        options: [
                                {
                                        name: "prompt",
                                        description: "Tin nhắn để gửi (bỏ trống để tạo phòng chat AI)",
                                        type: 3,
                                        required: false,
                                },
                                {
                                        name: "image",
                                        description: "Upload ảnh để AI phân tích (hỗ trợ vision)",
                                        type: 11,
                                        required: false,
                                },
                        ],
                },
                {
                        name: "gpt5",
                        description: "Hỏi GPT-5 hoặc tạo phòng chat AI",
                        type: 1,
                        options: [
                                {
                                        name: "prompt",
                                        description: "Tin nhắn để gửi (bỏ trống để tạo phòng chat AI)",
                                        type: 3,
                                        required: false,
                                },
                                {
                                        name: "image",
                                        description: "Upload ảnh để AI phân tích (hỗ trợ vision)",
                                        type: 11,
                                        required: false,
                                },
                        ],
                },
                {
                        name: "reset",
                        description: "Xóa lịch sử hội thoại AI (thread hiện tại)",
                        type: 1,
                },
                {
                        name: "stats",
                        description: "Xem thống kê sử dụng AI",
                        type: 1,
                },
                {
                        name: "threads",
                        description: "Quản lý các cuộc trò chuyện (threads)",
                        type: 1,
                        options: [
                                {
                                        name: "action",
                                        description: "Hành động",
                                        type: 3,
                                        required: true,
                                        choices: [
                                                {
                                                        name: "Danh sách threads",
                                                        value: "list",
                                                },
                                                {
                                                        name: "Tạo thread mới",
                                                        value: "new",
                                                },
                                                {
                                                        name: "Xóa thread",
                                                        value: "delete",
                                                },
                                        ],
                                },
                                {
                                        name: "thread_id",
                                        description: "ID của thread (cho action delete/switch)",
                                        type: 3,
                                        required: false,
                                },
                        ],
                },
                {
                        name: "context",
                        description: "Bật/tắt chế độ Context-Aware (AI hiểu ngữ cảnh channel)",
                        type: 1,
                        options: [
                                {
                                        name: "enabled",
                                        description: "Bật (true) hoặc tắt (false)",
                                        type: 5,
                                        required: true,
                                },
                        ],
                },
                {
                        name: "preferences",
                        description: "Xem và cập nhật sở thích AI cá nhân",
                        type: 1,
                        options: [
                                {
                                        name: "action",
                                        description: "Hành động",
                                        type: 3,
                                        required: true,
                                        choices: [
                                                {
                                                        name: "Xem sở thích hiện tại",
                                                        value: "view",
                                                },
                                                {
                                                        name: "Đặt style trả lời",
                                                        value: "style",
                                                },
                                                {
                                                        name: "Thêm ghi chú sở thích",
                                                        value: "note",
                                                },
                                        ],
                                },
                                {
                                        name: "value",
                                        description: "Giá trị (cho action style: concise/balanced/detailed, hoặc note: text)",
                                        type: 3,
                                        required: false,
                                },
                        ],
                },
                {
                        name: "setup",
                        description: "Thiết lập AI Rooms cho server (Admin only)",
                        type: 1,
                        options: [
                                {
                                        name: "enabled",
                                        description: "Bật/tắt AI Rooms",
                                        type: 5,
                                        required: true,
                                },
                        ],
                },
                {
                        name: "cleanup",
                        description: "Xóa tất cả AI Rooms cũ (Admin only)",
                        type: 1,
                },
                //discord-player v7 chua ho tro voice rec
                // {
                //      name: "assistant",
                //      description: "Kích hoạt AI trong phòng voice",
                //      type: 1,
                //      options: [
                //              {
                //                      name: "focus",
                //                      description: "Chỉ nghe lệnh người yêu cầu.",
                //                      type: 5, //BOOLEAN
                //              },
                //      ],
                // },
        ],
        integration_types: [0, 1],
        contexts: [0, 1],
        enable: config.DevConfig.ai,
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */
module.exports.execute = async ({ interaction, lang }) => {
        const { client, guild, options, member } = interaction;
        const subcommand = options.getSubcommand();
        const prompt = options.getString("prompt");
        const queue = guild?.id ? useQueue(guild.id) : null;

        const isRoomCreation = guild && !prompt && ['ask', 'groq', 'gpt5'].includes(subcommand);
        await interaction.deferReply({ ephemeral: isRoomCreation });

        if (subcommand === "groq") {
                return this.groq(interaction, prompt, lang);
        }

        if (subcommand === "gpt5") {
                return this.gpt5(interaction, prompt, lang);
        }

        if (subcommand === "reset") {
                return this.reset(interaction, lang);
        }

        if (subcommand === "stats") {
                return this.stats(interaction, lang);
        }

        if (subcommand === "threads") {
                return this.threads(interaction, lang);
        }

        if (subcommand === "context") {
                return this.context(interaction, lang);
        }

        if (subcommand === "preferences") {
                return this.preferences(interaction, lang);
        }

        if (subcommand === "setup") {
                return this.setup(interaction, lang);
        }

        if (subcommand === "cleanup") {
                return this.cleanup(interaction, lang);
        }

        return this.ask(interaction, prompt, lang);
};

module.exports.ask = async (interaction, prompt, lang) => {
        const aiRoomHandler = useFunctions().get("aiRoomHandler");
        const runAI = useFunctions().get("runAI");
        
        if (!prompt) {
                if (interaction.guild && aiRoomHandler) {
                        return await this.createAIRoomOnly(interaction, "ask", lang);
                }
                return await interaction.editReply({
                        content: "❌ Vui lòng nhập câu hỏi hoặc sử dụng lệnh này trong server để tạo phòng chat AI!",
                });
        }
        
        if (interaction.guild && aiRoomHandler) {
                return await aiRoomHandler.handleAIRequest(interaction, runAI.execute.bind(runAI), "ask", interaction, prompt, lang);
        }
        
        await runAI.execute(interaction, prompt, lang);
};

module.exports.groq = async (interaction, prompt, lang) => {
        const aiRoomHandler = useFunctions().get("aiRoomHandler");
        const runGroq = useFunctions().get("runGroq");
        
        if (!prompt) {
                if (interaction.guild && aiRoomHandler) {
                        return await this.createAIRoomOnly(interaction, "groq", lang);
                }
                return await interaction.editReply({
                        content: "❌ Vui lòng nhập câu hỏi hoặc sử dụng lệnh này trong server để tạo phòng chat AI!",
                });
        }
        
        if (interaction.guild && aiRoomHandler) {
                return await aiRoomHandler.handleAIRequest(interaction, runGroq.execute.bind(runGroq), "groq", interaction, prompt, lang);
        }
        
        await runGroq.execute(interaction, prompt, lang);
};

module.exports.gpt5 = async (interaction, prompt, lang) => {
        const aiRoomHandler = useFunctions().get("aiRoomHandler");
        const runGPT5 = useFunctions().get("runGPT5");
        
        if (!prompt) {
                if (interaction.guild && aiRoomHandler) {
                        return await this.createAIRoomOnly(interaction, "gpt5", lang);
                }
                return await interaction.editReply({
                        content: "❌ Vui lòng nhập câu hỏi hoặc sử dụng lệnh này trong server để tạo phòng chat AI!",
                });
        }
        
        if (interaction.guild && aiRoomHandler) {
                return await aiRoomHandler.handleAIRequest(interaction, runGPT5.execute.bind(runGPT5), "gpt5", interaction, prompt, lang);
        }
        
        await runGPT5.execute(interaction, prompt, lang);
};

module.exports.reset = async (interaction, lang) => {
        const AIService = require("../../services/ai/AIService");
        const ContextManager = require("../../services/ai/ContextManager");
        const DataBase = useDB();
        const user = interaction.user;

        const userData = await DataBase.ZiUser.findOne({ userID: user.id });
        const activeThreadId = userData?.aiPreferences?.activeThreadId;

        let aiModelName = "AI";
        let hasRoom = false;
        
        if (activeThreadId) {
                const aiRoom = await DataBase.ZiAIRoom.findOne({ 
                        threadId: activeThreadId,
                        userId: user.id,
                        status: "active"
                });
                
                if (aiRoom) {
                        hasRoom = true;
                        if (aiRoom.aiModel) {
                                aiModelName = getDisplayName(aiRoom.aiModel);
                        }
                        
                        await AIService.deleteThread(activeThreadId, user.id);
                        
                        const newThread = await ContextManager.createRoomThread(user.id);
                        
                        await DataBase.ZiAIRoom.updateOne(
                                { channelId: aiRoom.channelId },
                                { $set: { threadId: newThread.threadId } }
                        );
                        
                        await DataBase.ZiUser.updateOne(
                                { userID: user.id },
                                {
                                        $set: {
                                                groqHistory: [],
                                                "aiPreferences.activeThreadId": newThread.threadId,
                                        },
                                },
                                { upsert: true },
                        );
                } else {
                        await AIService.deleteThread(activeThreadId, user.id);
                        
                        await DataBase.ZiUser.updateOne(
                                { userID: user.id },
                                {
                                        $set: {
                                                groqHistory: [],
                                                "aiPreferences.activeThreadId": null,
                                        },
                                },
                                { upsert: true },
                        );
                }
        } else {
                await DataBase.ZiUser.updateOne(
                        { userID: user.id },
                        {
                                $set: {
                                        groqHistory: [],
                                        "aiPreferences.activeThreadId": null,
                                },
                        },
                        { upsert: true },
                );
        }

        await interaction.editReply({
                content: `✅ Đã xóa lịch sử hội thoại ${aiModelName}. Bạn có thể bắt đầu cuộc trò chuyện mới!`,
        });
};

module.exports.stats = async (interaction, lang) => {
        const AIService = require("../../services/ai/AIService");
        const user = interaction.user;

        const usageStats = await AIService.getUsageStats(user.id);
        const feedbackStats = await AIService.getFeedbackStats(user.id);

        const statsMessage = `
### 📊 Thống kê sử dụng Groq AI

**Quota hôm nay:**
📈 Đã dùng: ${usageStats.dailyUsed}/${usageStats.dailyQuota} lượt
📉 Còn lại: ${usageStats.remaining} lượt

**Tổng quan:**
🔢 Tổng requests: ${usageStats.totalRequests}
🎯 Tổng tokens: ${usageStats.totalTokensUsed.toLocaleString()}

**Feedback:**
👍 Positive: ${feedbackStats.positive}
👎 Negative: ${feedbackStats.negative}
📊 Tỉ lệ hài lòng: ${feedbackStats.positiveRate.toFixed(1)}%

*Quota sẽ được reset mỗi ngày vào 00:00*
        `.trim();

        await interaction.editReply({
                content: statsMessage,
        });
};

module.exports.threads = async (interaction, lang) => {
        const AIService = require("../../services/ai/AIService");
        const user = interaction.user;
        const action = interaction.options.getString("action");
        const threadId = interaction.options.getString("thread_id");

        if (action === "list") {
                const threads = await AIService.listThreads(user.id, 10);

                if (threads.length === 0) {
                        return await interaction.editReply({
                                content: "📋 Bạn chưa có cuộc trò chuyện nào. Hãy bắt đầu với `/ai groq`!",
                        });
                }

                const threadList = threads.map((thread, index) => {
                        const date = new Date(thread.lastUsed).toLocaleDateString("vi-VN");
                        const isActive = thread.isActive ? "🟢" : "⚪";
                        const id = thread.threadId.substring(0, 5);
                        return `${isActive} **${index + 1}.** ${thread.name}\n   ID: \`${id}...\` | ${thread.metadata.totalMessages} tin | ${date}`;
                }).join("\n\n");

                await interaction.editReply({
                        content: `### 🧵 Danh sách cuộc trò chuyện\n\n${threadList}\n\n*Sử dụng \`/ai threads action:delete thread_id:[ID]\` để xóa*`,
                });
        } else if (action === "new") {
                await interaction.editReply({
                        content: "✅ Thread mới sẽ được tự động tạo khi bạn gửi tin nhắn tiếp theo với `/ai groq`!",
                });
        } else if (action === "delete") {
                if (!threadId) {
                        return await interaction.editReply({
                                content: "❌ Vui lòng cung cấp thread_id để xóa!",
                        });
                }

                const deleted = await AIService.deleteThread(threadId, user.id);

                if (deleted) {
                        await interaction.editReply({
                                content: "✅ Đã xóa thread thành công!",
                        });
                } else {
                        await interaction.editReply({
                                content: "❌ Không tìm thấy thread hoặc bạn không có quyền xóa thread này!",
                        });
                }
        }
};

module.exports.context = async (interaction, lang) => {
        try {
                const UserPreferenceManager = require("../../services/ai/UserPreferenceManager");
                const user = interaction.user;
                const enabled = interaction.options.getBoolean("enabled");

                await UserPreferenceManager.updatePreference(user.id, "contextAware", enabled);

                const status = enabled ? "BẬT" : "TẮT";
                const emoji = enabled ? "✅" : "❌";
                const description = enabled 
                        ? "AI giờ sẽ đọc tin nhắn gần đây trong channel và hiểu ngữ cảnh cuộc trò chuyện tốt hơn."
                        : "AI sẽ không đọc tin nhắn khác trong channel nữa.";

                await interaction.editReply({
                        content: `${emoji} Đã **${status}** chế độ Context-Aware!\n\n${description}`,
                });
        } catch (error) {
                console.error("[AI Context] Error:", error);
                await interaction.editReply({
                        content: "❌ Đã xảy ra lỗi khi cập nhật cài đặt Context-Aware. Vui lòng thử lại sau!",
                }).catch(console.error);
        }
};

module.exports.preferences = async (interaction, lang) => {
        const UserPreferenceManager = require("../../services/ai/UserPreferenceManager");
        const user = interaction.user;
        const action = interaction.options.getString("action");
        const value = interaction.options.getString("value");

        if (action === "view") {
                const prefs = await UserPreferenceManager.getUserPreferences(user.id);

                const styleMap = {
                        concise: "Ngắn gọn",
                        balanced: "Cân bằng",
                        detailed: "Chi tiết",
                };

                let message = `### 👤 Sở thích AI của bạn\n\n`;
                message += `**Ngôn ngữ:** ${prefs.language === "vi" ? "Tiếng Việt" : "English"}\n`;
                message += `**Context-Aware:** ${prefs.contextAware ? "✅ Bật" : "❌ Tắt"}\n`;
                message += `**Style trả lời:** ${styleMap[prefs.responseStyle] || "Cân bằng"}\n`;

                if (prefs.topicsOfInterest && prefs.topicsOfInterest.length > 0) {
                        message += `**Chủ đề quan tâm:** ${prefs.topicsOfInterest.join(", ")}\n`;
                }

                if (prefs.notedPreferences && prefs.notedPreferences.length > 0) {
                        const notes = prefs.notedPreferences.slice(-3).map(p => `• ${p.note}`).join("\n");
                        message += `\n**Ghi chú sở thích:**\n${notes}\n`;
                }

                message += `\n*AI sẽ tự động học từ cách bạn tương tác!*`;

                await interaction.editReply({ content: message });
        } else if (action === "style") {
                if (!value) {
                        return await interaction.editReply({
                                content: "❌ Vui lòng cung cấp style!\nVí dụ: `/ai preferences action:style value:concise`\n\n**Các option:**\n• `concise` - Ngắn gọn\n• `balanced` - Cân bằng\n• `detailed` - Chi tiết",
                        });
                }

                if (!["concise", "balanced", "detailed"].includes(value)) {
                        return await interaction.editReply({
                                content: "❌ Style không hợp lệ!\n\n**Các option:**\n• `concise` - Ngắn gọn\n• `balanced` - Cân bằng\n• `detailed` - Chi tiết",
                        });
                }

                await UserPreferenceManager.updatePreference(user.id, "responseStyle", value);

                const styleMap = {
                        concise: "ngắn gọn",
                        balanced: "cân bằng",
                        detailed: "chi tiết",
                };

                await interaction.editReply({
                        content: `✅ Đã đặt style trả lời thành **${styleMap[value]}**!\n\nAI sẽ điều chỉnh độ dài câu trả lời theo sở thích này.`,
                });
        } else if (action === "note") {
                if (!value) {
                        return await interaction.editReply({
                                content: "❌ Vui lòng cung cấp ghi chú sở thích!\nVí dụ: `/ai preferences action:note value:Tôi thích code Python`",
                        });
                }

                await UserPreferenceManager.addPreferenceNote(user.id, value);

                await interaction.editReply({
                        content: `✅ Đã thêm ghi chú sở thích!\n\n"${value}"\n\nAI sẽ ghi nhớ điều này trong các cuộc trò chuyện sau.`,
                });
        }
};

module.exports.createAIRoomOnly = async (interaction, aiModel, lang) => {
        try {
                const DataBase = useDB();
                const AIRoomManager = require("../../services/ai/AIRoomManager");
                const ContextManager = require("../../services/ai/ContextManager");
                const { guild, user } = interaction;

                const guildSettings = await DataBase.ZiGuild.findOne({ guildId: guild.id });

                if (!guildSettings?.aiRooms?.enabled) {
                        return await interaction.editReply({
                                content: `❌ **AI Rooms chưa được bật!**

Admin cần bật tính năng này bằng lệnh:
\`/ai setup enabled:true\`

Sau đó bạn có thể sử dụng \`/ai ${aiModel}\` để tạo phòng chat AI riêng!`,
                        });
                }

                const roomResult = await AIRoomManager.getOrCreateRoom(guild, user, null, aiModel);

                if (roomResult.error) {
                        return await interaction.editReply({
                                content: `❌ ${roomResult.message}`,
                        });
                }

                const { channel, isNew } = roomResult;
                const modelName = `🤖 ${getDisplayName(aiModel)} AI`;
                
                if (isNew) {
                        const aiRoomHandler = useFunctions().get("aiRoomHandler");
                        if (aiRoomHandler && aiRoomHandler.sendWelcomeMessage) {
                                await aiRoomHandler.sendWelcomeMessage(channel, user, roomResult.room, aiModel);
                        }
                } else {
                        await channel.send({
                                content: `👋 ${user}, bạn đã quay lại phòng **${modelName}**!\n\n💬 Tiếp tục gõ tin nhắn để chat với AI nhé!`
                        });
                }

                await interaction.editReply({
                        content: `✅ Phòng AI của bạn đã sẵn sàng!`
                });
        } catch (error) {
                console.error("[AI CreateRoomOnly] Error:", error);
                await interaction.editReply({
                        content: "❌ Đã xảy ra lỗi khi tạo phòng AI. Vui lòng thử lại sau!",
                }).catch(console.error);
        }
};

module.exports.setup = async (interaction, lang) => {
        try {
                const DataBase = useDB();
                const { guild, member } = interaction;

                if (!member.permissions.has("Administrator")) {
                        return await interaction.editReply({
                                content: "❌ Bạn cần quyền Administrator để sử dụng lệnh này!",
                        });
                }

                const enabled = interaction.options.getBoolean("enabled");

                await DataBase.ZiGuild.updateOne(
                        { guildId: guild.id },
                        { 
                                $set: { 
                                        "aiRooms.enabled": enabled,
                                        "aiRooms.maxRoomsPerGuild": 10,
                                        "aiRooms.inactivityTimeout": 900000,
                                        "aiRooms.allowPublicView": false,
                                } 
                        },
                        { upsert: true }
                );

                if (enabled) {
                        await interaction.editReply({
                                content: `✅ **AI Rooms đã được BẬT!**

🎉 Từ giờ, khi người dùng sử dụng \`/ai groq\` hoặc \`/ai ask\`, bot sẽ tự động tạo phòng chat AI riêng cho họ!

**Cài đặt mặc định:**
• Tối đa: 10 rooms đang hoạt động
• Tự động đóng sau: 15 phút không hoạt động
• Quyền: Chỉ người dùng và bot có thể xem

**Lưu ý:** Bot cần quyền \`MANAGE_CHANNELS\` để tạo phòng AI.`,
                        });
                } else {
                        await interaction.editReply({
                                content: `✅ **AI Rooms đã được TẮT!**

Người dùng sẽ chat với AI trực tiếp trong channel hiện tại như bình thường.

Các AI rooms đang hoạt động sẽ vẫn tồn tại cho đến khi hết thời gian.`,
                        });
                }
        } catch (error) {
                console.error("[AI Setup] Error:", error);
                await interaction.editReply({
                        content: "❌ Đã xảy ra lỗi khi cập nhật cài đặt AI Rooms. Vui lòng kiểm tra:\n• Bot có kết nối database không?\n• Bot có đủ quyền không?",
                }).catch(console.error);
        }
};

module.exports.cleanup = async (interaction, lang) => {
        try {
                const DataBase = useDB();
                const { guild, member, client } = interaction;

                if (!member.permissions.has("Administrator")) {
                        return await interaction.editReply({
                                content: "❌ Bạn cần quyền Administrator để sử dụng lệnh này!",
                        });
                }

                await interaction.editReply({
                        content: "🔄 **Đang xóa tất cả AI Rooms cũ...**\n\nVui lòng đợi...",
                });

                const rooms = await DataBase.ZiAIRoom.find({
                        guildId: guild.id,
                        status: "active",
                });

                let deletedChannels = 0;
                let deletedRooms = 0;

                for (const room of rooms) {
                        try {
                                const channel = await guild.channels.fetch(room.channelId).catch(() => null);
                                if (channel) {
                                        await channel.delete("Admin cleanup - Resetting AI Rooms");
                                        deletedChannels++;
                                }
                        } catch (err) {
                                console.error(`[AI Cleanup] Error deleting channel ${room.channelId}:`, err);
                        }

                        await DataBase.ZiAIRoom.deleteOne({ _id: room._id });
                        deletedRooms++;
                }

                await interaction.editReply({
                        content: `✅ **Đã xóa thành công!**

📊 **Thống kê:**
• Xóa ${deletedRooms} rooms từ database
• Xóa ${deletedChannels} channels từ Discord

🎉 **Bây giờ bạn có thể tạo lại AI Rooms mới:**
• \`/ai ask\` - Tạo room với Gemini 2.5
• \`/ai groq\` - Tạo room với GROQ (openai/gpt-oss-120b)
• \`/ai gpt5\` - Tạo room với GPT-5.1

Mỗi room sẽ sử dụng đúng AI model tương ứng!`,
                });
        } catch (error) {
                console.error("[AI Cleanup] Error:", error);
                await interaction.editReply({
                        content: `❌ Đã xảy ra lỗi khi xóa AI Rooms: ${error.message}`,
                }).catch(console.error);
        }
};
