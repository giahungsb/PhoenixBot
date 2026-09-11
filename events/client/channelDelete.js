const { Events, Channel } = require("discord.js");
const { useDB } = require("@zibot/zihooks");

module.exports = {
        name: Events.ChannelDelete,
        type: "events",
};

module.exports.execute = async (channel) => {
        if (!channel.guild) return;
        
        const DataBase = useDB();
        
        const room = await DataBase.ZiAIRoom.findOne({
                channelId: channel.id,
                status: "active",
        });

        if (room) {
                console.log(`[AIRoom] Channel ${channel.id} deleted manually, cleaning up DB record and thread`);
                
                const ContextManager = require("../../services/ai/ContextManager");
                if (room.threadId) {
                        await ContextManager.deleteThread(room.threadId, room.userId).catch((err) => {
                                console.error("[ChannelDelete] Failed to delete room thread:", err);
                        });
                }
                
                await DataBase.ZiAIRoom.deleteOne({ channelId: channel.id });
                
                const AIRoomManager = require("../../services/ai/AIRoomManager");
                if (AIRoomManager.cleanupTimers.has(channel.id)) {
                        clearTimeout(AIRoomManager.cleanupTimers.get(channel.id));
                        AIRoomManager.cleanupTimers.delete(channel.id);
                }
        }
};
