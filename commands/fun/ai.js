const { useFunctions, useConfig } = require("@zibot/zihooks");
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
