const { useMainPlayer } = require("discord-player");
const player = useMainPlayer();
const { useZiVoiceExtractor } = require("@zibot/ziextractor");
const { useFunctions, useAI } = require("@zibot/zihooks");

module.exports.data = {
	name: "runVoiceAI",
	type: "ai",
};

let voiceAI = false; // Đặt mặc định là `false`

module.exports.execute = async (interaction, lang, options = { query: null }) => {
	try {
		const { client, guild, user } = interaction;

		const voiceChannel = interaction.member?.voice.channel;
		if (!voiceChannel) {
			return interaction.editReply({
				content: lang?.music?.NOvoiceChannel ?? "Bạn chưa tham gia vào kênh thoại",
				ephemeral: true,
			});
		}

		const voiceMe = guild.members.cache.get(client.user.id).voice.channel;
		if (voiceMe && voiceMe.id !== voiceChannel.id) {
			return interaction.editReply({
				content: lang?.music?.NOvoiceMe ?? "Bot đã tham gia một kênh thoại khác",
				ephemeral: true,
			});
		}

		const permissions = voiceChannel.permissionsFor(client.user);
		if (!permissions.has("Connect") || !permissions.has("Speak")) {
			return interaction.reply({
				content: lang?.music?.NoPermission ?? "Bot không có quyền tham gia hoặc nói trong kênh thoại này",
				ephemeral: true,
			});
		}

		// Tham gia voice channel
		const tts = useFunctions().get("TextToSpeech");
		const result = options?.query ?? useAI().run(`Hello, my name is ${user.username}`);
		await tts.execute(interaction, result, lang);

		voiceAI = true;

		await interaction.editReply("✅ Successfully activated AI assistant!");
	} catch (error) {
		console.error("Error while joining the voice channel:", error);
		await interaction.editReply("❌ Failed to activate AI assistant. Please try again.");
	}
};

module.exports.checkStatus = () => {
	return voiceAI;
};
