const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { useDB, useClient, useLogger } = require('@zibot/zihooks');
const goldScraper = require('../lib/giavang-scraper');

const goldPriceConfigs = new Map();

async function loadGoldPriceConfigs() {
        try {
                const database = useDB();
                if (!database) {
                        useLogger().warn('[GOLD CRON] Database not available, skipping config load');
                        return;
                }

                const configs = await database.ZiGoldPrice.find({ enabled: true });
                
                goldPriceConfigs.clear();
                configs.forEach((config) => {
                        goldPriceConfigs.set(config.guildId, {
                                channelId: config.channelId,
                                lastMessageIds: config.lastMessageIds || [],
                                lastMessageId: config.lastMessageId,
                                lastPrices: config.lastPrices || {},
                        });
                });

                useLogger().info(`[GOLD CRON] ✅ Loaded ${goldPriceConfigs.size} gold price configs`);
        } catch (error) {
                useLogger().error('[GOLD CRON] ❌ Failed to load configs:', error);
        }
}

function extractDateFromUpdate(lastUpdate) {
        if (!lastUpdate) return 'HÔM NAY';
        
        const dateMatch = lastUpdate.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
                return dateMatch[1];
        }
        
        const timeMatch = lastUpdate.match(/(\d{2}:\d{2})/);
        if (timeMatch) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                return `${day}/${month}/${year}`;
        }
        
        return 'HÔM NAY';
}

function formatSystemEmbeds(systemKey, systemData, goldData) {
        if (!systemData || !systemData.types || systemData.types.length === 0) {
                return [];
        }

        const dateStr = extractDateFromUpdate(goldData.lastUpdate);
        const systemName = systemData.name;
        const systemIcon = systemData.icon;
        const systemUrl = systemData.url;
        const color = getSystemColor(systemKey);

        const embeds = [];
        const maxFieldsPerEmbed = 25;
        const validTypes = systemData.types.filter(
                (goldType) => goldType && goldType.buy && goldType.sell && !isNaN(goldType.buy) && !isNaN(goldType.sell)
        );

        if (validTypes.length === 0) {
                return [];
        }

        const totalTypes = validTypes.length;
        const totalEmbeds = Math.ceil(totalTypes / maxFieldsPerEmbed);

        for (let embedIndex = 0; embedIndex < totalEmbeds; embedIndex++) {
                const start = embedIndex * maxFieldsPerEmbed;
                const end = Math.min(start + maxFieldsPerEmbed, totalTypes);
                const currentTypes = validTypes.slice(start, end);

                const titleSuffix = totalEmbeds > 1 ? ` (${embedIndex + 1}/${totalEmbeds})` : '';
                const embed = new EmbedBuilder()
                        .setTitle(`${systemIcon} GIÁ VÀNG ${systemName.toUpperCase()} - NGÀY ${dateStr}${titleSuffix}`)
                        .setDescription(`📊 Bảng giá vàng tại ${systemName}${totalEmbeds > 1 ? ` - Phần ${embedIndex + 1}/${totalEmbeds}` : ''}`)
                        .setColor(color)
                        .setTimestamp()
                        .setURL(systemUrl);

                currentTypes.forEach((goldType) => {
                        const fieldName = goldType.region 
                                ? `📌 ${goldType.label} - 📍 ${goldType.region}`
                                : `📌 ${goldType.label}`;
                        
                        embed.addFields({
                                name: fieldName,
                                value: 
                                        `💵 Mua vào: \`${goldScraper.formatPrice(goldType.buy)}\`\n` +
                                        `💰 Bán ra: \`${goldScraper.formatPrice(goldType.sell)}\`\n` +
                                        `📊 Chênh lệch: \`${goldScraper.formatPrice(goldType.sell - goldType.buy)}\``,
                                inline: false
                        });
                });

                embed.setFooter({ 
                        text: `📅 ${goldData.lastUpdate || 'Cập nhật liên tục'} • Nguồn: giavang.org • Hiển thị ${start + 1}-${end}/${totalTypes}`
                });

                embeds.push(embed);
        }

        return embeds;
}

function getSystemColor(systemKey) {
        const colors = {
                sjc: '#FFD700',
                pnj: '#E91E63',
                doji: '#9C27B0',
                btmc: '#3F51B5',
                btmh: '#2196F3',
                miHong: '#FF5722',
                ngocTham: '#00BCD4',
                phuQuy: '#4CAF50'
        };
        return colors[systemKey] || '#FFD700';
}

function formatGoldPriceEmbeds(goldData) {
        const embeds = [];

        if (!goldData.systems) {
                useLogger().error('[GOLD CRON] ❌ No systems data available');
                return embeds;
        }

        const priorityOrder = ['sjc', 'pnj', 'doji', 'btmc', 'btmh', 'miHong', 'ngocTham', 'phuQuy'];
        
        const allSystemKeys = Object.keys(goldData.systems);
        const sortedSystemKeys = allSystemKeys.sort((a, b) => {
                const indexA = priorityOrder.indexOf(a);
                const indexB = priorityOrder.indexOf(b);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.localeCompare(b);
        });

        sortedSystemKeys.forEach((systemKey) => {
                const systemData = goldData.systems[systemKey];
                if (systemData) {
                        const systemEmbeds = formatSystemEmbeds(systemKey, systemData, goldData);
                        if (systemEmbeds && systemEmbeds.length > 0) {
                                embeds.push(...systemEmbeds);
                        }
                }
        });

        useLogger().info(`[GOLD CRON] 📊 Generated ${embeds.length} embeds total for ${sortedSystemKeys.length} systems`);

        return embeds;
}

async function sendGoldPriceUpdate() {
        try {
                const client = useClient();
                const database = useDB();
                
                if (!client || !database || goldPriceConfigs.size === 0) {
                        return;
                }

                const goldData = await goldScraper.scrapeGoldPrices();

                if (!goldData || !goldData.sjcBars) {
                        useLogger().error('[GOLD CRON] ❌ Failed to scrape gold prices from giavang.org');
                        return;
                }

                for (const [guildId, config] of goldPriceConfigs.entries()) {
                        try {
                                const guild = client.guilds.cache.get(guildId);
                                if (!guild) {
                                        goldPriceConfigs.delete(guildId);
                                        await database.ZiGoldPrice.deleteOne({ guildId });
                                        continue;
                                }

                                const channel = guild.channels.cache.get(config.channelId);
                                if (!channel) {
                                        goldPriceConfigs.delete(guildId);
                                        await database.ZiGoldPrice.deleteOne({ guildId });
                                        useLogger().warn(`[GOLD CRON] ⚠️ Channel not found for guild ${guildId}, config deleted`);
                                        continue;
                                }

                                if (config.lastMessageIds && config.lastMessageIds.length > 0) {
                                        useLogger().info(`[GOLD CRON] 🗑️ Deleting ${config.lastMessageIds.length} old messages...`);
                                        for (const msgId of config.lastMessageIds) {
                                                try {
                                                        const oldMessage = await channel.messages.fetch(msgId).catch(() => null);
                                                        if (oldMessage) {
                                                                await oldMessage.delete();
                                                                await new Promise(resolve => setTimeout(resolve, 200));
                                                        }
                                                } catch (error) {
                                                        useLogger().warn(`[GOLD CRON] ⚠️ Could not delete message ${msgId}`);
                                                }
                                        }
                                        useLogger().info(`[GOLD CRON] ✅ Finished deleting old messages`);
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                }

                                const embeds = formatGoldPriceEmbeds(goldData);
                                useLogger().info(`[GOLD CRON] 📊 Created ${embeds.length} embeds to send`);
                                
                                const messageIds = [];
                                for (let i = 0; i < embeds.length; i++) {
                                        const embed = embeds[i];
                                        useLogger().info(`[GOLD CRON]   Sending Embed ${i + 1}/${embeds.length}: ${embed.data.title}`);
                                        
                                        const message = await channel.send({ embeds: [embed] }).catch((error) => {
                                                useLogger().error(`[GOLD CRON] ❌ Failed to send embed ${i + 1}:`, error.message);
                                                return null;
                                        });
                                        
                                        if (message) {
                                                messageIds.push(message.id);
                                        }
                                        
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                }

                                if (messageIds.length > 0) {
                                        useLogger().info(`[GOLD CRON] 📨 Successfully sent ${messageIds.length} separate messages`);
                                        await database.ZiGoldPrice.updateOne(
                                                { guildId },
                                                {
                                                        $set: {
                                                                lastMessageIds: messageIds,
                                                                lastMessageId: messageIds[messageIds.length - 1],
                                                                lastFetchedAt: new Date(),
                                                                lastPrices: goldData,
                                                        },
                                                }
                                        );
                                        
                                        goldPriceConfigs.set(guildId, {
                                                channelId: config.channelId,
                                                lastMessageIds: messageIds,
                                                lastPrices: goldData,
                                        });
                                }
                        } catch (error) {
                                useLogger().error(`[GOLD CRON] ❌ Error processing guild ${guildId}:`, error);
                        }
                }

                useLogger().info(`[GOLD CRON] ✅ Sent gold prices to ${goldPriceConfigs.size} guilds`);
        } catch (error) {
                useLogger().error('[GOLD CRON] ❌ Critical error in sendGoldPriceUpdate:', error);
        }
}

async function startGoldPriceCron() {
        try {
                useLogger().info('[GOLD CRON] 🌐 Using giavang.org scraper for gold prices');

                await loadGoldPriceConfigs();

                cron.schedule('*/15 * * * *', async () => {
                        await sendGoldPriceUpdate();
                });

                useLogger().info('[GOLD CRON] ✅ Gold price cron job started (runs every 15 minutes, scraping from giavang.org)');
        } catch (error) {
                useLogger().error('[GOLD CRON] ❌ Failed to start gold price cron:', error);
        }
}

module.exports = {
        startGoldPriceCron,
        loadGoldPriceConfigs,
};
