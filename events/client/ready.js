const { Events, Client, ActivityType } = require("discord.js");
const config = require("../../config");
const deploy = require("../../startup/deploy");
const mongoose = require("mongoose");
const { useDB, useLogger } = require("@zibot/zihooks");
const { Database, createModel } = require("@zibot/db");

module.exports = {
        name: Events.ClientReady,
        type: "events",
        once: true,
        /**
         * @param { Client } client
         */
        execute: async (client) => {
                /**
                 * @param { String } messenger
                 */
                client.errorLog = async (messenger) => {
                        if (!config?.botConfig?.ErrorLog) return;
                        try {
                                const channel = await client.channels.fetch(config?.botConfig?.ErrorLog).catch(() => null);
                                if (channel) {
                                        const text = `[<t:${Math.floor(Date.now() / 1000)}:R>] ${messenger}`;
                                        for (let i = 0; i < text.length; i += 1000) {
                                                await channel.send(text.slice(i, i + 1000)).catch(() => {});
                                        }
                                }
                        } catch (error) {
                                useLogger().error("Lỗi khi gửi tin nhắn lỗi:", error);
                        }
                };

                if (config?.deploy) {
                        await deploy(client).catch(() => null);
                }
                
                const { startGoldPriceCron } = require("../../cron/goldPriceCron");
                await startGoldPriceCron();

                const aiRoomCleanup = require("../../cron/aiRoomCleanup");
                aiRoomCleanup.start();

                const AIRoomManager = require("../../services/ai/AIRoomManager");
                await AIRoomManager.bootstrapTimers();

                client.user.setStatus(config?.botConfig?.Status || "online");
                client.user.setActivity({
                        name: config?.botConfig?.ActivityName || "ziji",
                        type: ActivityType[config?.botConfig?.ActivityType] || ActivityType.Playing,
                        timestamps: {
                                start: Date.now(),
                        },
                });

                useLogger().info(`Ready! Logged in as ${client.user.tag}`);
                client.errorLog(`Ready! Logged in as ${client.user.tag}`);
        },
};
