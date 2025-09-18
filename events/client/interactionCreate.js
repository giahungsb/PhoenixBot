const { Events, CommandInteraction, PermissionsBitField, MessageFlags } = require("discord.js");
const { useCooldowns, useCommands, useFunctions, useConfig, useLogger } = require("@zibot/zihooks");
const config = useConfig();
const fs = require("fs");
const path = require("path");
const Cooldowns = useCooldowns();
const Commands = useCommands();
const Functions = useFunctions();

/**
 * @param { CommandInteraction } interaction
 * @param { Client } client
 * @param { import('../../lang/vi.js') } lang - language
 */

async function checkStatus(interaction, client, lang) {
        // Kiểm tra quyền
        if (interaction.guild) {
                const hasPermission = interaction.channel
                        .permissionsFor(client.user)
                        .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]);

                if (!hasPermission) {
                        await interaction.reply({ content: lang.until.NOPermission, ephemeral: true });
                        return true;
                }
        }
        // Kiểm tra cấm
        const configPath = path.join(__dirname, "../../jsons/developer.json");
        if (!fs.existsSync(configPath)) {
                fs.writeFileSync(configPath, JSON.stringify({ bannedUsers: [] }, null, 4));
        }
        let devConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (devConfig.bannedUsers.includes(interaction.user.id)) {
                await interaction
                        .reply({
                                content: lang.until.banned,
                                flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                return true;
        }

        // Kiểm tra chủ sở hữu
        if (config.OwnerID.includes(interaction.user.id)) return false;

        // Kiểm tra modal
        if (interaction.isModalSubmit()) return false;
        // Kiểm tra thời gian chờ
        const now = Date.now();
        const cooldownDuration = config.defaultCooldownDuration ?? 3000;
        const expirationTime = Cooldowns.get(interaction.user.id) + cooldownDuration;

        if (Cooldowns.has(interaction.user.id) && now < expirationTime) {
                const expiredTimestamp = Math.round(expirationTime / 1_000);
                await interaction
                        .reply({
                                content: lang.until.cooldown
                                        .replace("{command}", interaction.commandName || interaction.customId)
                                        .replace("{time}", `<t:${expiredTimestamp}:R>`),
                                ephemeral: true,
                        })
                        .catch(() => {});
                return true;
        }
        // Set cooldown
        Cooldowns.set(interaction.user.id, now);
        setTimeout(() => Cooldowns.delete(interaction.user.id), cooldownDuration);
        return false;
}

module.exports = {
        name: Events.InteractionCreate,
        type: "events",
};

/**
 * @param { CommandInteraction } interaction
 */
module.exports.execute = async (interaction) => {
        const { client, user } = interaction;
        if (!client.isReady()) return;

        let command;
        let commandType;

        // Determine the interaction type and set the command
        if (interaction.isChatInputCommand() || interaction.isAutocomplete() || interaction.isMessageContextMenuCommand()) {
                command = Commands.get(interaction.commandName);
                commandType = "command";
        } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
                command = Functions.get(interaction.customId);
                commandType = "function";
        }

        // If no command was found, log the error and return
        if (!command) {
                console.error(`No ${commandType} matching ${interaction.commandName || interaction.customId} was found.`);
                return;
        }

        // Get the user's language preference
        const langfunc = Functions.get("ZiRank");
        const lang = await langfunc.execute({ user, XpADD: interaction.isAutocomplete() ? 0 : 1 });

        // Try to execute the command and handle errors
        try {
                if (interaction.isAutocomplete()) {
                        await command.autocomplete({ interaction, lang });
                } else {
                        useLogger().debug(
                                `Interaction received: ${interaction?.commandName || interaction?.customId} >> User: ${interaction?.user?.username} >> Guild: ${interaction?.guild?.name} (${interaction?.guildId})`,
                        );

                        const status = await checkStatus(interaction, client, lang);
                        if (status) return;

                        await command.execute({ interaction, lang });
                }
        } catch (error) {
                client.errorLog(`**${error.message}**`);
                client.errorLog(error.stack);
                console.error(error);
                const response = {
                        content: "There was an error while executing this command!",
                        ephemeral: true,
                };
                if (interaction.isAutocomplete()) return;
                if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(response).catch(() => {});
                } else {
                        await interaction.reply(response).catch(() => {});
                }
        }
};
