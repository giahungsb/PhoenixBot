const { useFunctions, useConfig, useDB } = require("@zibot/zihooks");
const { useQueue } = require("discord-player");
const config = useConfig();

module.exports.data = {
        name: "ai",
        description: "Tính năng AI",
        type: 1, // lệnh slash
        options: [
                {
                        name: "ask",
                        description: "Hỏi AI",
                        type: 1,
                        options: [
                                {
                                        name: "prompt",
                                        description: "Tin nhắn để gửi",
                                        type: 3,
                                        required: true,
                                },
                        ],
                },
                {
                        name: "polaris",
                        description: "Hỏi Polaris-Alpha AI với các tính năng nâng cao",
                        type: 1,
                        options: [
                                {
                                        name: "prompt",
                                        description: "Tin nhắn để gửi",
                                        type: 3,
                                        required: true,
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
                        description: "Xóa lịch sử hội thoại Polaris (thread hiện tại)",
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
        await interaction.deferReply();

        const { client, guild, options, member } = interaction;
        const subcommand = options.getSubcommand();
        const prompt = options.getString("prompt") || "Hello";
        const queue = guild?.id ? useQueue(guild.id) : null;

        if (subcommand === "polaris") {
                return this.polaris(interaction, prompt, lang);
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

        //discord-player v7 chua ho tro voice rec
        return this.ask(interaction, prompt, lang);
        /**
         * Nếu có voice, ưu tiên vào voice trả lời.
         * Nếu Không có thì trả lời messenger
         */

        if (subcommand === "assistant") {
                // Handle assistant functionality
                return this.assistant(interaction, lang, { query: prompt });
        }

        if (!queue) return this.ask(interaction, prompt, lang);

        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
                return this.ask(interaction, prompt, lang);
        }

        // Check if bot is in the same voice channel
        const botVoiceChannel = guild.members.cache.get(client.user.id)?.voice.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
                return this.ask(interaction, prompt, lang);
        }

        // Check permissions in the voice channel
        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions?.has("Connect") || !permissions.has("Speak")) {
                return this.ask(interaction, prompt, lang);
        }

        // Handle assistant functionality
        return this.assistant(interaction, lang, { query: prompt });
};

module.exports.ask = async (interaction, prompt, lang) => {
        const runAI = useFunctions().get("runAI");
        await runAI.execute(interaction, prompt, lang);
};

module.exports.assistant = async (interaction, lang, { query: prompt }) => {
        const focus = interaction.options.getBoolean("focus") ? interaction.user.id : null;
        const runVoiceAI = useFunctions().get("runVoiceAI");
        await runVoiceAI.execute(interaction, lang, { query: prompt, focus });
};

module.exports.polaris = async (interaction, prompt, lang) => {
        const runPolaris = useFunctions().get("runPolaris");
        await runPolaris.execute(interaction, prompt, lang);
};

module.exports.reset = async (interaction, lang) => {
        const AIService = require("../../services/ai/AIService");
        const DataBase = useDB();
        const user = interaction.user;

        const userData = await DataBase.ZiUser.findOne({ userID: user.id });
        const activeThreadId = userData?.aiPreferences?.activeThreadId;

        if (activeThreadId) {
                await AIService.deleteThread(activeThreadId, user.id);
        }

        await DataBase.ZiUser.updateOne(
                { userID: user.id },
                {
                        $set: {
                                polarisHistory: [],
                                "aiPreferences.activeThreadId": null,
                        },
                },
                { upsert: true },
        );

        await interaction.editReply({
                content: "✅ Đã xóa lịch sử hội thoại Polaris. Bạn có thể bắt đầu cuộc trò chuyện mới!",
        });
};

module.exports.stats = async (interaction, lang) => {
        const AIService = require("../../services/ai/AIService");
        const user = interaction.user;

        const usageStats = await AIService.getUsageStats(user.id);
        const feedbackStats = await AIService.getFeedbackStats(user.id);

        const statsMessage = `
### 📊 Thống kê sử dụng AI Polaris

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
                                content: "📋 Bạn chưa có cuộc trò chuyện nào. Hãy bắt đầu với `/ai polaris`!",
                        });
                }

                const threadList = threads.map((thread, index) => {
                        const date = new Date(thread.lastUsed).toLocaleDateString("vi-VN");
                        const isActive = thread.isActive ? "🟢" : "⚪";
                        const id = thread.threadId.substring(0, 8);
                        return `${isActive} **${index + 1}.** ${thread.name}\n   ID: \`${id}...\` | ${thread.metadata.totalMessages} tin | ${date}`;
                }).join("\n\n");

                await interaction.editReply({
                        content: `### 🧵 Danh sách cuộc trò chuyện\n\n${threadList}\n\n*Sử dụng \`/ai threads action:delete thread_id:[ID]\` để xóa*`,
                });
        } else if (action === "new") {
                await interaction.editReply({
                        content: "✅ Thread mới sẽ được tự động tạo khi bạn gửi tin nhắn tiếp theo với `/ai polaris`!",
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
