const { useDB } = require("@zibot/zihooks");
const { TextInputStyle, ModalBuilder, ActionRowBuilder, TextInputBuilder } = require("discord.js");

module.exports.data = {
	name: "B_TempVoice_Kick",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	const config = await useDB().ZiGuild.findOne({ guildId: interaction.guild.id });
	if (!config?.joinToCreate.enabled) return interaction.editReply("❌ | Chức năng này chưa được bật ở máy chủ này");
	const tempChannel = await config.joinToCreate.tempChannels.find((tc) => tc.channelId === interaction.channel.id);
	if (!tempChannel) return;
	const channel = interaction.guild.channels.cache.get(tempChannel.channelId);
	if (!channel) return;
	if (interaction.user.id !== tempChannel.ownerId) {
		return interaction.reply({
			content: "Bạn không có quyền điều khiển kênh này!",
			ephemeral: true,
		});
	}
	const modal = new ModalBuilder()
		.setCustomId("M_TempVoice_Kick")
		.setTitle("Đuổi người dùng")
		.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId("kickUserId")
					.setLabel("Nhập ID người dùng:")
					.setStyle(TextInputStyle.Short)
					.setRequired(true),
			),
		);
	await interaction.showModal(modal);
};
