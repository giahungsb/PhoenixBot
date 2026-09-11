const { useConfig, useWelcome, useFunctions } = require("@zibot/zihooks");
const { Events, GuildMember, AttachmentBuilder } = require("discord.js");
const config = useConfig();
const { Worker } = require("worker_threads");
const BotLogger = require("../../services/logger");

async function buildImageInWorker(workerData) {
        return new Promise((resolve, reject) => {
                const worker = new Worker("./utility/welcomeImage.js", {
                        workerData, //: { ZDisplayName, ZType, ZAvatar, ZMessage, ZImage },
                });

                worker.on("message", (arrayBuffer) => {
                        try {
                                const buffer = Buffer.from(arrayBuffer);
                                if (!Buffer.isBuffer(buffer)) {
                                        throw new Error("Received data is not a buffer");
                                }
                                const attachment = new AttachmentBuilder(buffer, { name: "welcome.png" });
                                resolve(attachment);
                        } catch (error) {
                                reject(error);
                        } finally {
                                worker.postMessage("terminate");
                        }
                });

                worker.on("error", reject);

                worker.on("exit", (code) => {
                        if (code !== 0) {
                                reject(new Error(`Worker stopped with exit code ${code}`));
                        }
                });
        });
}

module.exports = {
        name: Events.GuildMemberRemove,
        type: "events",
        /**
         *
         * @param { GuildMember } member
         */
        execute: async (member) => {
                BotLogger.logJoinLeave(member.client, member.guild.id, member, "leave").catch(err => console.error("Error logging leave:", err));

                const { useDB } = require("@zibot/zihooks");
                const DataBase = useDB();
                const rooms = await DataBase.ZiAIRoom.find({
                        guildId: member.guild.id,
                        userId: member.user.id,
                        status: "active",
                });

                if (rooms.length > 0) {
                        console.log(`[AIRoom] User ${member.user.id} left server, closing ${rooms.length} AI room(s)`);
                        const AIRoomManager = require("../../services/ai/AIRoomManager");
                        for (const room of rooms) {
                                await AIRoomManager.closeRoom(room.channelId, member.user.id);
                        }
                }

                // create card
                const welcome = useWelcome().get(member.guild.id)?.at(0);
                if (!welcome) return;
                try {
                        const attachment = await buildImageInWorker({
                                ZDisplayName: member.user.username,
                                ZType: "Goodbye",
                                ZAvatar: member.user.displayAvatarURL({ size: 1024, forceStatic: true, extension: "png" }),
                                ZMessage: `See you again in ${member.guild.name}!`,
                        });
                        const channel = await member.client.channels.fetch(welcome.Bchannel);
                        const parseVar = useFunctions().get("getVariable");
                        await channel.send({
                                files: [
                                        {
                                                attachment,
                                                description:
                                                        parseVar?.execute(welcome.Bcontent, member) ||
                                                        `Tạm biệt ${member.user.name}! Server hiện nay chỉ còn ${member.guild.memberCount} người.`,
                                        },
                                ],
                        });
                } catch (error) {
                        console.error("Error building image:", error);
                }
        },
};
