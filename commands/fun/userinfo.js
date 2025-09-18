const { EmbedBuilder } = require("discord.js");

module.exports.data = {
        name: "userinfo",
        description: "Xem thông tin người dùng của ai đó",
        type: 1, // lệnh slash
        options: [
                {
                        name: "user",
                        description: "Chọn người dùng để xem thông tin",
                        type: 6,
                        required: false,
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
        const user = interaction.options.getUser("user") || interaction.user;
        const member = interaction.guild?.members.cache.get(user.id);

        const formatTime = (time) => `<t:${Math.floor(time / 1000)}:F>`;
        const getField = (name, value) => ({ name, value, inline: true });

        const fields = [
                getField(lang?.UserInfo?.Username, user.username),
                getField(lang?.UserInfo?.UserID, user.id),
                getField(
                        lang?.UserInfo?.JoinedAt,
                        member?.joinedAt ? formatTime(member.joinedAt.getTime()) : lang?.UserInfo?.NotServerMember,
                ),
                getField(lang?.UserInfo?.UserJoined, formatTime(user.createdTimestamp)),
        ];

        const embed = new EmbedBuilder()
                .setColor(lang?.color ?? "Random")
                .setTitle(lang?.UserInfo?.Title)
                .setThumbnail(user.displayAvatarURL())
                .addFields(fields)
                .setTimestamp()
                .setFooter({
                        iconURL: interaction.user.displayAvatarURL(),
                        text: `${lang?.until?.requestBy} ${interaction.user.username}`,
                })
                .setImage(user.bannerURL() || null);

        await interaction.reply({ embeds: [embed] });
};
