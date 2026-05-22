const { Schema, model } = require("mongoose");

const ZiUser = Schema({
        userID: { type: String },
        name: { type: String },
        xp: { type: Number },
        level: { type: Number, default: 1 },
        coin: { type: Number, default: 0 },
        lang: { type: String },
        volume: { type: Number, default: 100 },
        color: { type: String, default: "Random" },
        lastDaily: { type: Date },
        dailyStreak: { type: Number, default: 0 },
        lastHunt: { type: Date },
        totalAnimals: { type: Number, default: 0 },
        huntStats: { type: Schema.Types.Mixed, default: {} },
        lootboxes: { type: Number, default: 0 },
        fabledLootboxes: { type: Number, default: 0 },
        cookiesGiven: { type: Number, default: 0 },
        cookiesReceived: { type: Number, default: 0 },
        lastCookie: { type: Date },
        thankedCookies: { type: [String], default: [] },
        // Pet care system
        petCare: {
                lastFeed: { type: Date },
                lastPlay: { type: Date },
                happiness: { type: Number, default: 100 },
                totalFeedings: { type: Number, default: 0 },
                totalPlays: { type: Number, default: 0 },
                favoriteAnimal: { type: String, default: null }
        },
        // Animal trading system
        lastGive: { type: Date },
        dailyGives: { type: Number, default: 0 },
        // Quest system
        dailyQuests: { type: Array, default: [] },
        lastQuestReset: { type: Date },
        // AI system
        polarisHistory: { type: Array, default: [] },
        promptHistory: { type: String, default: "" },
        CurrentAI: { type: String, default: "" },
        CurrentUser: { type: String, default: "" },
        // AI usage stats and rate limiting
        usageStats: {
                dailyQuota: { type: Number, default: 50 },
                dailyUsed: { type: Number, default: 0 },
                lastResetDate: { type: Date, default: Date.now },
                totalTokensUsed: { type: Number, default: 0 },
                totalRequests: { type: Number, default: 0 },
        },
        // AI preferences
        aiPreferences: {
                preferredLanguage: { type: String, default: "auto" },
                activeThreadId: { type: String, default: null },
        },
});

const ZiAutoresponder = Schema(
        {
                guildId: { type: String, required: true },
                trigger: { type: String, required: true },
                response: { type: String, required: true },
                options: {
                        matchMode: { type: String, enum: ["exactly", "startswith", "endswith", "includes"], default: "exactly" },
                },
        },
        {
                timestamps: true,
        },
);

const ZiWelcome = Schema(
        {
                guildId: { type: String, required: true },
                channel: { type: String, required: true },
                content: { type: String, required: true },
                Bchannel: { type: String, required: true },
                Bcontent: { type: String }, // Corrected duplicate
        },
        {
                timestamps: true,
        },
);

const ZiGuild = Schema({
        guildId: { type: String, required: true },
        voice: {
                logMode: { type: Boolean, default: false },
        },
        joinToCreate: {
                enabled: { type: Boolean, default: false },
                voiceChannelId: { type: String, default: null },
                categoryId: { type: String, default: null },
                defaultUserLimit: { type: Number, default: 0 },
                tempChannels: [
                        {
                                channelId: String,
                                ownerId: String,
                                locked: { type: Boolean, default: false },
                        },
                ],
                blockedUser: [String],
        },
});

const ZiConfess = Schema({
        enabled: { type: Boolean, default: false },
        guildId: { type: String, required: true },
        channelId: { type: String, required: true },
        reviewSystem: { type: Boolean, default: false },
        reviewChannelId: { type: String, required: false, default: null },
        currentId: { type: Number, default: 0 },
        confessions: [
                {
                        id: { type: Number },
                        content: { type: String },
                        author: { type: Object },
                        type: { type: String, enum: ["anonymous", "public"] },
                        status: { type: String, enum: ["pending", "rejected", "approved"], default: "approved" },
                        messageId: { type: String, default: null },
                        threadId: { type: String, default: null },
                        reviewMessageId: { type: String, default: null },
                },
        ],
});

const ZiGoldPrice = Schema(
        {
                guildId: { type: String, required: true, unique: true },
                channelId: { type: String, required: true },
                enabled: { type: Boolean, default: true },
                lastMessageId: { type: String, default: null },
                lastFetchedAt: { type: Date, default: null },
                lastPrices: { type: Schema.Types.Mixed, default: {} },
        },
        {
                timestamps: true,
        },
);

const ZiPolarisThread = Schema(
        {
                threadId: { type: String, required: true, unique: true },
                userID: { type: String, required: true },
                name: { type: String, default: "Untitled Conversation" },
                messages: { type: Array, default: [] },
                summary: { type: String, default: "" },
                lastUsed: { type: Date, default: Date.now },
                isActive: { type: Boolean, default: true },
                metadata: {
                        totalMessages: { type: Number, default: 0 },
                        totalTokens: { type: Number, default: 0 },
                        createdAt: { type: Date, default: Date.now },
                },
        },
        {
                timestamps: true,
        },
);

const ZiFeedback = Schema(
        {
                userID: { type: String, required: true },
                messageId: { type: String, required: true },
                threadId: { type: String, default: null },
                rating: { type: String, enum: ["positive", "negative"], required: true },
                prompt: { type: String, required: true },
                response: { type: String, required: true },
                notes: { type: String, default: "" },
                timestamp: { type: Date, default: Date.now },
        },
        {
                timestamps: true,
        },
);

const ZiAnswerCache = Schema(
        {
                promptHash: { type: String, required: true, unique: true },
                prompt: { type: String, required: true },
                response: { type: String, required: true },
                language: { type: String, default: "auto" },
                model: { type: String, default: "openrouter/polaris-alpha" },
                hitCount: { type: Number, default: 0 },
                lastHit: { type: Date, default: Date.now },
                expiresAt: { type: Date, required: true },
                metadata: {
                        averageRating: { type: Number, default: 0 },
                        totalFeedback: { type: Number, default: 0 },
                },
        },
        {
                timestamps: true,
        },
);

const ZiLog = Schema(
        {
                guildId: { type: String, required: true },
                channelId: { type: String, required: true },
                enabled: { type: Boolean, default: true },
                logTypes: {
                        commands: { type: Boolean, default: true },
                        moderation: { type: Boolean, default: true },
                        errors: { type: Boolean, default: true },
                        voice: { type: Boolean, default: false },
                        join_leave: { type: Boolean, default: false },
                },
        },
        {
                timestamps: true,
        },
);

module.exports = {
        ZiUser: model("ZiUser", ZiUser),
        ZiAutoresponder: model("ZiAutoresponder", ZiAutoresponder),
        ZiWelcome: model("ZiWelcome", ZiWelcome),
        ZiGuild: model("ZiGuild", ZiGuild),
        ZiConfess: model("ZiConfess", ZiConfess),
        ZiGoldPrice: model("ZiGoldPrice", ZiGoldPrice),
        ZiPolarisThread: model("ZiPolarisThread", ZiPolarisThread),
        ZiFeedback: model("ZiFeedback", ZiFeedback),
        ZiAnswerCache: model("ZiAnswerCache", ZiAnswerCache),
        ZiLog: model("ZiLog", ZiLog),
};
