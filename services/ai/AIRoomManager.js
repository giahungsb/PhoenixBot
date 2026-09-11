const { useDB } = require("@zibot/zihooks");
const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { getChannelLabel, getDisplayName } = require("../../config/aiModels");
const ContextManager = require("./ContextManager");

class AIRoomManager {
        constructor() {
                this.cleanupTimers = new Map();
                this.defaultInactivityTimeout = 900000;
                this.channelNameChangeCooldown = new Map();
                this.nameChangeCooldownMs = 600000;
        }

        async getOrCreateRoom(guild, user, threadId = null, aiModel = "groq") {
                const DataBase = useDB();
                
                try {
                        const existingRoom = await DataBase.ZiAIRoom.findOne({
                                guildId: guild.id,
                                userId: user.id,
                                aiModel: aiModel,
                                status: "active",
                        });

                        if (existingRoom) {
                                await this.updateActivity(existingRoom.channelId);
                                
                                return {
                                        room: existingRoom,
                                        channel: await guild.channels.fetch(existingRoom.channelId).catch(() => null),
                                        isNew: false,
                                };
                        }

                        const guildSettings = await DataBase.ZiGuild.findOne({ guildId: guild.id});
                        if (!guildSettings?.aiRooms?.enabled) {
                                return {
                                        error: true,
                                        message: "AI Rooms chưa được bật trên server này. Admin có thể bật bằng lệnh `/ai setup`.",
                                };
                        }

                        const activeRoomCount = await DataBase.ZiAIRoom.countDocuments({
                                guildId: guild.id,
                                status: "active",
                        });

                        const maxRooms = guildSettings.aiRooms.maxRoomsPerGuild || 10;
                        if (activeRoomCount >= maxRooms) {
                                return {
                                        error: true,
                                        message: `Server đã đạt giới hạn ${maxRooms} AI rooms đang hoạt động. Vui lòng đợi các rooms khác được dọn dẹp.`,
                                };
                        }

                        const category = await this.ensureCategory(guild, guildSettings);
                        if (!category) {
                                return {
                                        error: true,
                                        message: "❌ Bot không có quyền tạo category hoặc channels. Vui lòng kiểm tra quyền MANAGE_CHANNELS.",
                                };
                        }

                        const allowPublicView = guildSettings.aiRooms.allowPublicView || false;
                        const permissions = [
                                {
                                        id: user.id,
                                        allow: [
                                                PermissionFlagsBits.ViewChannel,
                                                PermissionFlagsBits.SendMessages,
                                                PermissionFlagsBits.ReadMessageHistory,
                                        ],
                                },
                                {
                                        id: guild.client.user.id,
                                        allow: [
                                                PermissionFlagsBits.ViewChannel,
                                                PermissionFlagsBits.SendMessages,
                                                PermissionFlagsBits.ManageChannels,
                                                PermissionFlagsBits.ManageMessages,
                                                PermissionFlagsBits.ReadMessageHistory,
                                        ],
                                },
                        ];

                        if (!allowPublicView) {
                                permissions.push({
                                        id: guild.id,
                                        deny: [PermissionFlagsBits.ViewChannel],
                                });
                        }

                        const username = (user.username || user.tag || user.id).replace(/[^a-z0-9-_]/gi, '');
                        if (!username || username.length === 0) {
                                console.error("[AIRoomManager] Invalid username for user:", user.id);
                                return {
                                        error: true,
                                        message: "❌ Không thể tạo tên channel hợp lệ. Vui lòng thử lại.",
                                };
                        }
                        
                        const modelLabel = getChannelLabel(aiModel);
                        const channelName = `ai-${modelLabel}-${username.substring(0, 20)}`.toLowerCase().substring(0, 100);
                        
                        if (channelName.length < 1 || channelName.length > 100) {
                                console.error("[AIRoomManager] Invalid channel name length:", channelName.length);
                                return {
                                        error: true,
                                        message: "❌ Tên channel không hợp lệ. Vui lòng thử lại.",
                                };
                        }
                        
                        let newThreadCreated = false;
                        if (!threadId) {
                                const thread = await ContextManager.createRoomThread(user.id);
                                threadId = thread.threadId;
                                newThreadCreated = true;
                        } else {
                                const { useDB: useDBContext } = require("@zibot/zihooks");
                                const DB = useDBContext();
                                const existingThread = await DB.ZiGroqThread.findOne({ threadId, userID: user.id });
                                
                                if (!existingThread) {
                                        console.warn(`[AIRoomManager] Provided threadId ${threadId.substring(0, 8)} not found, creating new room thread`);
                                        const thread = await ContextManager.createRoomThread(user.id);
                                        threadId = thread.threadId;
                                        newThreadCreated = true;
                                }
                        }
                        
                        let channel;
                        try {
                                const modelName = getDisplayName(aiModel);
                                channel = await guild.channels.create({
                                        name: channelName,
                                        type: ChannelType.GuildText,
                                        parent: category.id,
                                        topic: `AI Chat Room riêng của ${user.username || user.tag} (AI ${modelName}). Thread: ${threadId.substring(0, 8)}`,
                                        permissionOverwrites: permissions,
                                });
                        } catch (discordError) {
                                console.error("[AIRoomManager] Discord API error creating channel:", {
                                        status: discordError.status || discordError.code,
                                        message: discordError.message,
                                        channelName,
                                        userId: user.id,
                                        guildId: guild.id,
                                });
                                
                                if (newThreadCreated && threadId) {
                                        await ContextManager.deleteThread(threadId, user.id).catch((err) => {
                                                console.error("[AIRoomManager] Failed to cleanup thread after channel creation error:", err);
                                        });
                                }
                                
                                if (discordError.status === 400 || discordError.code === 50035) {
                                        return {
                                                error: true,
                                                message: "❌ Không thể tạo channel. Tên người dùng có thể chứa ký tự đặc biệt không được phép.",
                                        };
                                }
                                
                                throw discordError;
                        }

                        const room = await DataBase.ZiAIRoom.create({
                                guildId: guild.id,
                                userId: user.id,
                                channelId: channel.id,
                                threadId: threadId,
                                aiModel: aiModel,
                                createdAt: Date.now(),
                                lastActivity: Date.now(),
                                status: "active",
                                cleanupScheduledAt: null,
                                roomSettings: {
                                        timeoutMs: null,
                                },
                        });

                        this.scheduleCleanup(room, guildSettings);

                        return {
                                room,
                                channel,
                                isNew: true,
                        };
                } catch (error) {
                        console.error("[AIRoomManager] Error in getOrCreateRoom:", error);
                        
                        if (error.code === 11000) {
                                const existingRoom = await DataBase.ZiAIRoom.findOne({
                                        guildId: guild.id,
                                        userId: user.id,
                                        aiModel: aiModel,
                                        status: "active",
                                });
                                
                                if (existingRoom) {
                                        return {
                                                room: existingRoom,
                                                channel: await guild.channels.fetch(existingRoom.channelId).catch(() => null),
                                                isNew: false,
                                        };
                                }
                        }

                        return {
                                error: true,
                                message: `Không thể tạo AI room: ${error.message}`,
                        };
                }
        }

        async ensureCategory(guild, guildSettings) {
                try {
                        const categoryId = guildSettings?.aiRooms?.categoryId;
                        
                        if (categoryId) {
                                const existingCategory = await guild.channels.fetch(categoryId).catch(() => null);
                                if (existingCategory && existingCategory.type === ChannelType.GuildCategory) {
                                        return existingCategory;
                                }
                        }

                        const category = await guild.channels.create({
                                name: "🤖 AI Rooms",
                                type: ChannelType.GuildCategory,
                                position: 0,
                        });

                        const DataBase = useDB();
                        await DataBase.ZiGuild.updateOne(
                                { guildId: guild.id },
                                { $set: { "aiRooms.categoryId": category.id } },
                                { upsert: true }
                        );

                        return category;
                } catch (error) {
                        console.error("[AIRoomManager] Error ensuring category:", error);
                        return null;
                }
        }

        async closeRoom(channelId, userId) {
                const DataBase = useDB();
                
                try {
                        const room = await DataBase.ZiAIRoom.findOne({
                                channelId,
                                userId,
                                status: "active",
                        });

                        if (!room) {
                                return { success: false, message: "Room không tồn tại hoặc đã bị đóng." };
                        }

                        await DataBase.ZiAIRoom.updateOne(
                                { channelId },
                                {
                                        $set: {
                                                status: "closing",
                                                cleanupScheduledAt: new Date(Date.now() + 5000),
                                        },
                                }
                        );

                        setTimeout(() => {
                                this.deleteRoom(channelId).catch(console.error);
                        }, 5000);

                        return { success: true, room };
                } catch (error) {
                        console.error("[AIRoomManager] Error closing room:", error);
                        return { success: false, message: error.message };
                }
        }

        async deleteRoom(channelId) {
                const DataBase = useDB();
                const { useClient } = require("@zibot/zihooks");
                
                try {
                        const room = await DataBase.ZiAIRoom.findOne({ channelId });
                        if (!room) {
                                return { success: false, message: "Room not found" };
                        }

                        const client = useClient();
                        const guildObj = await client.guilds.fetch(room.guildId).catch(() => null);
                        
                        let channelDeleted = false;
                        
                        if (guildObj) {
                                const channel = await guildObj.channels.fetch(channelId).catch(() => null);
                                if (channel) {
                                        try {
                                                await channel.delete("AI Room cleanup");
                                                channelDeleted = true;
                                        } catch (err) {
                                                if (err.code === 50013) {
                                                        console.error(`[AIRoomManager] Missing permissions to delete channel`);
                                                }
                                                throw new Error(`Cannot delete channel: ${err.message}`);
                                        }
                                } else {
                                        channelDeleted = true;
                                }
                        } else {
                                channelDeleted = true;
                        }

                        if (channelDeleted) {
                                if (room.threadId) {
                                        await ContextManager.deleteThread(room.threadId, room.userId).catch((err) => {
                                                console.error("[AIRoomManager] Failed to delete room thread:", err);
                                        });
                                }
                                await DataBase.ZiAIRoom.deleteOne({ channelId });
                        } else {
                                throw new Error("Channel deletion failed, keeping room record in database");
                        }

                        if (this.cleanupTimers.has(channelId)) {
                                clearTimeout(this.cleanupTimers.get(channelId));
                                this.cleanupTimers.delete(channelId);
                        }

                        return { success: true };
                } catch (error) {
                        console.error("[AIRoomManager] Error deleting room:", error);
                        return { success: false, message: error.message };
                }
        }

        async updateActivity(channelId) {
                const DataBase = useDB();
                const { useClient } = require("@zibot/zihooks");
                
                try {
                        const room = await DataBase.ZiAIRoom.findOneAndUpdate(
                                { channelId, status: "active" },
                                { $set: { lastActivity: Date.now() } },
                                { new: true }
                        );

                        if (room) {
                                const client = useClient();
                                const guild = await client.guilds.fetch(room.guildId).catch(() => null);
                                
                                if (guild) {
                                        const member = await guild.members.fetch(room.userId).catch(() => null);
                                        
                                        if (!member) {
                                                await this.closeRoom(channelId, room.userId);
                                                return null;
                                        }
                                }
                                
                                if (this.cleanupTimers.has(channelId)) {
                                        clearTimeout(this.cleanupTimers.get(channelId));
                                }

                                const guildSettings = await DataBase.ZiGuild.findOne({ guildId: room.guildId });
                                this.scheduleCleanup(room, guildSettings);
                        }

                        return room;
                } catch (error) {
                        console.error("[AIRoomManager] Error updating activity:", error);
                        return null;
                }
        }

        scheduleCleanup(room, guildSettings) {
                if (this.cleanupTimers.has(room.channelId)) {
                        clearTimeout(this.cleanupTimers.get(room.channelId));
                }

                const timeout = room.roomSettings?.timeoutMs || 
                                guildSettings?.aiRooms?.inactivityTimeout || 
                                this.defaultInactivityTimeout;

                const timer = setTimeout(async () => {
                        await this.closeRoom(room.channelId, room.userId);
                }, timeout);

                this.cleanupTimers.set(room.channelId, timer);
        }

        async getActiveRooms(guildId = null) {
                const DataBase = useDB();
                const query = { status: "active" };
                if (guildId) {
                        query.guildId = guildId;
                }
                
                return await DataBase.ZiAIRoom.find(query);
        }

        async getRoomByChannelId(channelId) {
                const DataBase = useDB();
                
                try {
                        const room = await DataBase.ZiAIRoom.findOne({
                                channelId,
                                status: "active",
                        });
                        
                        return room;
                } catch (error) {
                        console.error("[AIRoomManager] Error getting room by channelId:", error);
                        return null;
                }
        }

        async cleanupInactiveRooms() {
                const DataBase = useDB();
                const { useClient } = require("@zibot/zihooks");
                const now = Date.now();
                
                try {
                        const client = useClient();
                        const allActiveRooms = await DataBase.ZiAIRoom.find({ status: "active" });
                        
                        for (const room of allActiveRooms) {
                                const guild = await client.guilds.fetch(room.guildId).catch(() => null);
                                if (guild) {
                                        const member = await guild.members.fetch(room.userId).catch(() => null);
                                        if (!member) {
                                                await this.closeRoom(room.channelId, room.userId);
                                        }
                                }
                        }
                        
                        const inactiveRooms = await DataBase.ZiAIRoom.find({
                                status: "active",
                                lastActivity: { $lt: new Date(now - this.defaultInactivityTimeout) },
                        });

                        for (const room of inactiveRooms) {
                                await this.closeRoom(room.channelId, room.userId);
                        }

                        const orphanedRooms = await DataBase.ZiAIRoom.find({
                                status: { $in: ["closing", "closed"] },
                                updatedAt: { $lt: new Date(now - 86400000) },
                        });

                        if (orphanedRooms.length > 0) {
                                await DataBase.ZiAIRoom.deleteMany({
                                        _id: { $in: orphanedRooms.map(r => r._id) },
                                });
                        }

                        return { success: true, cleaned: inactiveRooms.length + orphanedRooms.length };
                } catch (error) {
                        console.error("[AIRoomManager] Error in cleanup job:", error);
                        return { success: false, error: error.message };
                }
        }

        async extendTimeout(channelId, userId, additionalMs) {
                const DataBase = useDB();
                
                try {
                        const room = await DataBase.ZiAIRoom.findOne({
                                channelId,
                                userId,
                                status: "active",
                        });

                        if (!room) {
                                return { success: false, message: "Room không tồn tại" };
                        }

                        const currentTimeout = room.roomSettings?.timeoutMs || this.defaultInactivityTimeout;
                        const newTimeout = currentTimeout + additionalMs;

                        await DataBase.ZiAIRoom.updateOne(
                                { channelId },
                                { $set: { "roomSettings.timeoutMs": newTimeout } }
                        );

                        const guildSettings = await DataBase.ZiGuild.findOne({ guildId: room.guildId });
                        this.scheduleCleanup({ ...room, roomSettings: { timeoutMs: newTimeout } }, guildSettings);

                        return { success: true, newTimeout };
                } catch (error) {
                        console.error("[AIRoomManager] Error extending timeout:", error);
                        return { success: false, message: error.message };
                }
        }

        async bootstrapTimers() {
                const DataBase = useDB();
                
                try {
                        const activeRooms = await DataBase.ZiAIRoom.find({ status: "active" });
                        
                        for (const room of activeRooms) {
                                const guildSettings = await DataBase.ZiGuild.findOne({ guildId: room.guildId });
                                this.scheduleCleanup(room, guildSettings);
                        }
                } catch (error) {
                        console.error("[AIRoomManager] Error bootstrapping timers:", error);
                }
        }

        canChangeChannelName(channelId) {
                const lastChange = this.channelNameChangeCooldown.get(channelId);
                if (!lastChange) {
                        return true;
                }
                
                const timeSinceLastChange = Date.now() - lastChange;
                return timeSinceLastChange >= this.nameChangeCooldownMs;
        }

        recordChannelNameChange(channelId) {
                this.channelNameChangeCooldown.set(channelId, Date.now());
        }
}

module.exports = new AIRoomManager();
