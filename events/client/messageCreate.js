const { Events, Message } = require("discord.js");
const { useResponder, useConfig, useFunctions, useCommands, useLogger, modinteraction, useAI } = require("@zibot/zihooks");
const config = useConfig();
const { useQueue } = require("discord-player");
const mentionRegex = /@(everyone|here|ping)/;
const ziicon = require("./../../utility/icon");

const Commands = useCommands();
const Functions = useFunctions();

module.exports = {
        name: Events.MessageCreate,
        type: "events",
        enable: config?.DevConfig?.AutoResponder,
};

/**
 * @param { Message } message
 */
module.exports.execute = async (message) => {
        if (!message.client.isReady()) return;
        if (message.author.bot) return;
        // Lấy thiết lập ngôn ngữ của người dùng
        const langfunc = Functions.get("ZiRank");
        const lang = await langfunc.execute({ user: message.author, XpADD: 0 });
        // tts
        if (message.channel.isThread() && message.channel.name.startsWith(`${message?.client?.user?.username} TTS |`)) {
                return await reqTTS(message, lang);
        }
        // Tự động trả lời
        if (config?.DevConfig?.AutoResponder && message?.guild && (await reqreponser(message))) return; // Auto Responder

        // Tin nhắn riêng tự động trả lời = AI
        if (!message.guild || message.mentions.has(message.client.user)) {
                await reqai(message, lang);
        }
};

/**
 * @param { Message } message
 */

const reqai = async (message, lang) => {
        if (mentionRegex.test(message.content?.toLowerCase())) return;
        const prompt = message.content.replace(`<@${message.client.user.id}>`, "").trim();
        if (!prompt) {
                const commsnd = Commands.get("help");
                if (commsnd) {
                        modinteraction(message);
                        await commsnd.execute({ interaction: message, lang });
                }
                return;
        }
        await message.channel.sendTyping().catch(() => {
                return; // không thể gửi tin nhắn nên bỏ qua
        });

        try {
                const result = await useAI().run(prompt, message.author, lang);
                await message.reply(result);
        } catch (err) {
                useLogger().error(`Error in generating content: ${err}`);
                const replies = await message.reply("❌ | Không thể tạo nội dung! Xin hãy chờ ít phút");
                setTimeout(() => {
                        replies.delete();
                }, 5000);
        }
};

/**
 * @param { Message } message
 */

const reqreponser = async (message) => {
        const parseVar = useFunctions().get("getVariable");
        const guildResponders = useResponder().get(message.guild.id) ?? [];

        const trigger = guildResponders.find((responder) => {
                const msgContent = message.content.toLowerCase();
                const triggerContent = responder.trigger.toLowerCase();

                switch (responder.matchMode) {
                        case "exactly":
                                return msgContent === triggerContent;
                        case "startswith":
                                return msgContent.startsWith(triggerContent);
                        case "endswith":
                                return msgContent.endsWith(triggerContent);
                        case "includes":
                                return msgContent.includes(triggerContent);
                        default:
                                return msgContent === triggerContent;
                }
        });

        if (trigger) {
                try {
                        await message.reply(parseVar.execute(trigger.response, message));
                        return true;
                } catch (error) {
                        console.error(`Failed to send response: ${error.message}`);
                        return false;
                }
        }
        return false;
};

/**
 * @param { Message } message
 */

const reqTTS = async (message, lang) => {
        const queue = useQueue(message.guild.id);
        modinteraction(message);
        const tts = await Functions.get("TextToSpeech");
        if (queue?.metadata) await message.react(ziicon.yess);
        const context = message.content.replace(`<@${message.client.user.id}>`, "").trim();

        await tts.execute(message, context, lang, { queue });
};
