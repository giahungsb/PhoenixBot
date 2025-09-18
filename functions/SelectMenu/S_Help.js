const { EmbedBuilder, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const ZiIcons = require("../../utility/icon.js");
const config = require("@zibot/zihooks").useConfig();

module.exports.data = {
        name: "S_Help",
        type: "SelectMenu",
};

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
        const selection = interaction.values?.at(0);
        
        // Trích xuất trang từ token trạng thái nếu có
        let currentPage = 1;
        const footerText = interaction.message?.embeds?.[0]?.footer?.text;
        if (footerText && footerText.includes('SHELP|')) {
                const match = footerText.match(/SHELP\|[^|]+\|(\d+)\/(\d+)\|uid=(\d+)/);
                if (match && match[3] === interaction.user.id) {
                        currentPage = parseInt(match[1]);
                }
        }
        
        const embed = new EmbedBuilder()
                .setAuthor({
                        name: `${interaction.client.user.username} Help:`,
                        iconURL: interaction.client.user.displayAvatarURL({ size: 1024 }),
                })
                .setDescription(lang.Help.Placeholder)
                .setColor(lang?.color || "Random")
                .setImage(config.botConfig?.Banner || null)
                .setTimestamp();

        // Luôn giữ lại menu chọn và các nút hỗ trợ gốc
        const originalComponents = module.exports.buildOriginalComponents(lang);
        let paginationComponents = [];
        
        switch (selection) {
                case "guild_commands":
                        const { guildCommands } = await module.exports.commands(interaction);
                        const guildResult = module.exports.paginateCommands(guildCommands, currentPage, lang, 'guild_commands', interaction.user.id);
                        embed.setDescription(guildResult.description);
                        embed.setFooter(guildResult.footer);
                        if (guildResult.components.length > 0) {
                                paginationComponents = guildResult.components;
                        }
                        break;
                case "context_commands":
                        const { contextCommands } = await module.exports.commands(interaction);
                        const contextResult = module.exports.paginateContextCommands(contextCommands, currentPage, lang, interaction.user.id);
                        embed.setDescription(contextResult.description);
                        embed.setFooter(contextResult.footer);
                        if (contextResult.components.length > 0) {
                                paginationComponents = contextResult.components;
                        }
                        break;
                case "player_buttons":
                        const playerButtons = module.exports.playerButtons(lang);
                        embed.setDescription(
                                `# ${lang.Help.PlayerButtons}:\n\n` +
                                        playerButtons.map((btn) => `** ${btn.icon} ${btn.name}**\n` + `* ${btn.description}`).join("\n\n"),
                        );
                        break;
                case "voice_commands":
                        const voiceCommands = module.exports.voiceCommands(lang);
                        embed.setDescription(
                                `# ${lang.Help.VoiceCommands}:\n\n` +
                                        voiceCommands
                                                .map((cmd) => `- **${cmd.name}**\n` + ` - ${cmd.description}\n` + ` - **Ví dụ:** \`${cmd.example}\``)
                                                .join("\n\n") +
                                        `\n\n## ❗ ${lang.Help.Attention}\n` +
                                        `- ${lang?.voiceCommands?.Note}\n\n` +
                                        `## 💡 ${lang.Help.Note}\n` +
                                        `- ${lang?.voiceCommands?.LanguageNote}`,
                        );
                        break;
                default:
                        embed.setFooter({
                                text: `${lang.until.requestBy} ${interaction.user?.username}`,
                                iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                        });
                        break;
        }
        
        // Always include original components, add pagination if needed
        const allComponents = [...originalComponents];
        if (paginationComponents.length > 0) {
                allComponents.push(...paginationComponents);
        }
        
        const updateOptions = { embeds: [embed], components: allComponents };
        
        await interaction.update(updateOptions);
};

module.exports.buildOriginalComponents = (lang) => {
        // Recreate the original select menu from the help command
        const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("S_Help")
                .setPlaceholder(lang.Help.Placeholder)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions([
                        {
                                emoji: "<:section:1254203682686373938>",
                                label: lang.Help.GuildCommands,
                                value: "guild_commands",
                                description: lang.Help.GuildCommandsDescription || "Xem danh sách các lệnh có thể sử dụng trong server",
                        },
                        {
                                emoji: "<:zi_user:1253090627923611709>",
                                label: lang.Help.ContextCommands,
                                value: "context_commands",
                                description: lang.Help.ContextCommandsDescription || "Xem danh sách các lệnh có thể sử dụng trong context menu",
                        },
                        {
                                emoji: "<:zi_music:1253090631668994132>",
                                label: lang.Help.PlayerButtons,
                                value: "player_buttons",
                                description: lang.Help.PlayerButtonsDescription || "Xem danh sách các button có thể sử dụng trong music player",
                        },
                        {
                                emoji: "<:zi_voice:1253090469328453733>",
                                label: lang.Help.VoiceCommands,
                                value: "voice_commands",
                                description: lang.Help.VoiceCommandsDescription || "Xem danh sách các lệnh có thể sử dụng bằng giọng nói",
                        },
                ]);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Recreate the support buttons row from the help command
        const supportRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                        .setLabel("Support Server")
                        .setStyle(ButtonStyle.Link)
                        .setEmoji(ZiIcons.fillter)
                        .setURL(config.botConfig?.SupportServer || "https://discord.gg/bkBejRNcR3"),
                new ButtonBuilder()
                        .setLabel("Invite Bot")
                        .setStyle(ButtonStyle.Link)
                        .setEmoji(ZiIcons.fillter)
                        .setURL(config.botConfig?.InviteBot || `https://discord.com/oauth2/authorize?client_id=${config.botConfig?.ClientId}`)
        );

        return [selectRow, supportRow];
};

module.exports.playerButtons = (lang) => [
        {
                name: lang?.playerButtons?.Refresh || "Làm mới",
                id: "B_player_refresh",
                description: lang?.playerFunc?.Fields?.Refresh || "Làm mới trình phát nhạc",
                icon: ZiIcons.refesh,
        },
        {
                name: lang?.playerButtons?.Previous || "Bài trước",
                id: "B_player_previous",
                description: lang?.playerFunc?.Fields?.Previous || "Phát bài hát trước đó",
                icon: ZiIcons.prev,
        },
        {
                name: lang?.playerButtons?.PausePlay || "Tạm dừng/Phát",
                id: "B_player_pause",
                description: lang?.playerFunc?.Fields?.PausePlay || "Tạm dừng hoặc tiếp tục phát nhạc",
                icon: ZiIcons.pause,
        },
        {
                name: lang?.playerButtons?.Next || "Bài tiếp",
                id: "B_player_next",
                description: lang?.playerFunc?.Fields?.Next || "Phát bài hát tiếp theo",
                icon: ZiIcons.next,
        },
        {
                name: lang?.playerButtons?.Stop || "Dừng",
                id: "B_player_stop",
                description: lang?.playerFunc?.Fields?.Stop || "Dừng phát nhạc và xóa hàng đợi",
                icon: ZiIcons.stop,
        },
        {
                name: lang?.playerButtons?.Search || "Tìm kiếm",
                id: "B_player_search",
                description: lang?.playerFunc?.Fields?.Search || "Tìm kiếm bài hát",
                icon: ZiIcons.search,
        },
        {
                name: lang?.playerButtons?.AutoPlay || "Tự động phát",
                id: "B_player_autoPlay",
                description: lang?.playerFunc?.Fields?.AutoPlay || "Bật/tắt chế độ tự động phát",
                icon: ZiIcons.loopA,
        },
        {
                name: lang?.playerButtons?.SelectTrack || "Chọn bài hát",
                id: "S_player_Track",
                description: lang?.playerFunc?.RowRel || "Chọn bài hát từ danh sách đề xuất",
                icon: ZiIcons.Playbutton,
        },
        {
                name: lang?.playerButtons?.SelectFunc || "Chức năng",
                id: "S_player_Func",
                description: lang?.playerFunc?.RowFunc || "Chọn các chức năng khác của trình phát",
                icon: ZiIcons.fillter,
        },
];

module.exports.voiceCommands = (lang) => [
        {
                name: lang?.voiceCommands?.Play || "Phát nhạc",
                description: lang?.voiceFunc?.Play || "Phát một bài hát hoặc thêm vào hàng đợi",
                example: '"play Sơn Tùng MTP Chúng ta của hiện tại"',
        },
        {
                name: lang?.voiceCommands?.Skip || "Bỏ qua",
                description: lang?.voiceFunc?.Skip || "Bỏ qua bài hát hiện tại",
                example: '"skip" hoặc "bỏ qua" hoặc "next"',
        },
        {
                name: lang?.voiceCommands?.Volume || "Âm lượng",
                description: lang?.voiceFunc?.Volume || "Điều chỉnh âm lượng (0-100)",
                example: '"volume 50" hoặc "âm lượng 75"',
        },
        {
                name: lang?.voiceCommands?.Pause || "Tạm dừng",
                description: lang?.voiceFunc?.Pause || "Tạm dừng phát nhạc",
                example: '"pause" hoặc "tạm dừng"',
        },
        {
                name: lang?.voiceCommands?.Resume || "Tiếp tục",
                description: lang?.voiceFunc?.Resume || "Tiếp tục phát nhạc",
                example: '"resume" hoặc "tiếp tục"',
        },
        {
                name: lang?.voiceCommands?.AutoPlay || "Tự động phát",
                description: lang?.voiceFunc?.AutoPlay || "Bật/tắt chế độ tự động phát",
                example: '"auto play" hoặc "tự động phát"',
        },
        {
                name: lang?.voiceCommands?.Disconnect || "Ngắt kết nối",
                description: lang?.voiceFunc?.Disconnect || "Ngắt kết nối từ kênh thoại",
                example: '"disconnect" hoặc "ngắt kết nối"',
        },
];

module.exports.paginateCommands = (guildCommands, currentPage, lang, category, userId) => {
        const header = `# ${lang.Help.GuildCommands}:\n\n`;
        const commandStrings = guildCommands.map((cmd) => {
                if (cmd.options?.at(0)?.type == 1) {
                        let optionss = "";
                        for (const option of cmd.options) {
                                if (option.type == 1) {
                                        optionss += `</${cmd.name} ${option.name}:${cmd.id}>: ${option.description}\n`;
                                }
                        }
                        return optionss;
                }
                return `</${cmd.name}:${cmd.id}>: ${cmd.description}\n`;
        });
        
        const maxCharsPerPage = 3800;
        const pages = [];
        let currentPageContent = header;
        
        for (let i = 0; i < commandStrings.length; i++) {
                const commandString = commandStrings[i];
                if ((currentPageContent + commandString).length > maxCharsPerPage) {
                        if (currentPageContent === header) {
                                // Command too long for a single page, truncate it
                                const availableSpace = maxCharsPerPage - header.length - 50;
                                pages.push(currentPageContent + commandString.substring(0, availableSpace) + "...\n");
                        } else {
                                pages.push(currentPageContent);
                                currentPageContent = header + commandString;
                        }
                } else {
                        currentPageContent += commandString;
                }
        }
        
        if (currentPageContent !== header) {
                pages.push(currentPageContent);
        }
        
        const totalPages = pages.length;
        const safePage = Math.max(1, Math.min(currentPage, totalPages));
        const description = pages[safePage - 1] || header;
        
        const footer = {
                text: `${lang.Help.Page.replace('{current}', safePage).replace('{total}', totalPages)} • SHELP|gc|${safePage}/${totalPages}|uid=${userId}`,
                iconURL: null
        };
        
        const components = [];
        if (totalPages > 1) {
                const row = new ActionRowBuilder()
                        .addComponents(
                                new ButtonBuilder()
                                        .setCustomId('B_help_prev')
                                        .setLabel(lang.Help.Previous)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(safePage === 1),
                                new ButtonBuilder()
                                        .setCustomId('B_help_next')
                                        .setLabel(lang.Help.Next)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(safePage === totalPages)
                        );
                components.push(row);
        }
        
        return { description, footer, components };
};

module.exports.paginateContextCommands = (contextCommands, currentPage, lang, userId) => {
        const header = `# ${lang.Help.ContextCommands}:\n\n`;
        const commandStrings = contextCommands.map((cmd) => `### ${cmd.name}\n\n`);
        
        const maxCharsPerPage = 3800;
        const pages = [];
        let currentPageContent = header;
        
        for (let i = 0; i < commandStrings.length; i++) {
                const commandString = commandStrings[i];
                if ((currentPageContent + commandString).length > maxCharsPerPage) {
                        if (currentPageContent === header) {
                                pages.push(currentPageContent + commandString.substring(0, maxCharsPerPage - header.length - 10) + "...\n");
                        } else {
                                pages.push(currentPageContent);
                                currentPageContent = header + commandString;
                        }
                } else {
                        currentPageContent += commandString;
                }
        }
        
        if (currentPageContent !== header) {
                pages.push(currentPageContent);
        }
        
        const totalPages = pages.length;
        const safePage = Math.max(1, Math.min(currentPage, totalPages));
        const description = pages[safePage - 1] || header;
        
        const footer = {
                text: `${lang.Help.Page.replace('{current}', safePage).replace('{total}', totalPages)} • SHELP|cc|${safePage}/${totalPages}|uid=${userId}`,
                iconURL: null
        };
        
        const components = [];
        if (totalPages > 1) {
                const row = new ActionRowBuilder()
                        .addComponents(
                                new ButtonBuilder()
                                        .setCustomId('B_help_prev')
                                        .setLabel(lang.Help.Previous)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(safePage === 1),
                                new ButtonBuilder()
                                        .setCustomId('B_help_next')
                                        .setLabel(lang.Help.Next)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(safePage === totalPages)
                        );
                components.push(row);
        }
        
        return { description, footer, components };
};

module.exports.commands = async (interaction) => {
        const commands = await interaction.client.rest.get(Routes.applicationCommands(interaction.client.user.id));
        const guildCommands = commands.filter((cmd) => cmd.type === 1);
        const contextCommands = commands.filter((cmd) => cmd.type === 2 || cmd.type === 3);
        return { guildCommands, contextCommands };
};
