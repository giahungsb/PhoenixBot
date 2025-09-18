const Encryptor = require("@zibot/ziencryptor");
const { EmbedBuilder } = require("discord.js");

module.exports.data = {
	name: "encrypt",
	description: "Encrypts another into a string",
	type: 1, // slash command
	options: [
		{
			name: "text",
			description: "The text to encrypt",
			type: 3, // string
			required: true,
		},
		{
			name: "key",
			description: "The key to use for encryption",
			type: 3, // string
		},
	],
	integration_types: [0, 1],
	contexts: [0, 1, 2],
};

/**
 * @param { object } command - object command
 * @param { import ("discord.js").CommandInteraction } command.interaction - interaction
 * @param { import('../../lang/vi.js') } command.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	await interaction.deferReply({ ephemeral: true, fetchReply: true });
	const text = interaction.options.getString("text");
	const key = interaction.options.getString("key") || "Ziii";
	const encrypt = new Encryptor(key);
	let encrypted;
	try {
		encrypted = encrypt.encrypt(text);
	} catch (e) {
		encrypted = e;
	}
	const embed = new EmbedBuilder()
		.setColor(lang?.color || "Random")
		.setAuthor({ name: `Encryption`, iconURL: interaction.user.displayAvatarURL({}) })
		.setDescription(`\`\`\`${encrypted}\`\`\``)
		.setFooter({
			text: `${lang.until.requestBy} ${interaction.user?.username}`,
			iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
		})
		.setTimestamp();
	await interaction.editReply({ embeds: [embed] });
	return;
};
