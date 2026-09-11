const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { useDB, useConfig } = require("@zibot/zihooks");
const config = useConfig();

module.exports.data = {
	name: "log",
	description: "Quản lý hệ thống log của bot",
	type: 1,
	options: [
		{
			name: "setup",
			description: "Thiết lập kênh nhận log",
			type: 1,
			options: [
				{
					name: "channel",
					description: "Kênh sẽ nhận log từ bot",
					type: 7,
					channel_types: [0],
					required: true,
				},
			],
		},
		{
			name: "disable",
			description: "Tắt hệ thống log",
			type: 1,
		},
		{
			name: "config",
			description: "Cấu hình các loại log",
			type: 1,
			options: [
				{
					name: "commands",
					description: "Log các lệnh được sử dụng",
					type: 5,
					required: false,
				},
				{
					name: "moderation",
					description: "Log các hành động kiểm duyệt (ban, kick, timeout)",
					type: 5,
					required: false,
				},
				{
					name: "errors",
					description: "Log các lỗi xảy ra",
					type: 5,
					required: false,
				},
				{
					name: "voice",
					description: "Log hoạt động voice channel",
					type: 5,
					required: false,
				},
				{
					name: "join_leave",
					description: "Log thành viên vào/rời server",
					type: 5,
					required: false,
				},
			],
		},
		{
			name: "info",
			description: "Xem cấu hình log hiện tại",
			type: 1,
		},
	],
	integration_types: [0],
	contexts: [0],
	default_member_permissions: "8",
	enable: true,
};

module.exports.execute = async ({ interaction, lang }) => {
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
		return interaction.reply({ content: lang?.until?.noPermission || "Bạn không có quyền sử dụng lệnh này!", ephemeral: true });
	}

	const db = useDB();
	if (!db) return interaction.reply({ content: lang?.until?.noDB || "Không thể kết nối database!", ephemeral: true });

	const subcommand = interaction.options.getSubcommand();

	switch (subcommand) {
		case "setup":
			return this.setupLog({ interaction, lang, db });
		case "disable":
			return this.disableLog({ interaction, lang, db });
		case "config":
			return this.configLog({ interaction, lang, db });
		case "info":
			return this.infoLog({ interaction, lang, db });
		default:
			return interaction.reply({ content: "Lệnh không hợp lệ!", ephemeral: true });
	}
};

module.exports.setupLog = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	try {
		const channel = interaction.options.getChannel("channel");

		if (!channel.isTextBased()) {
			return interaction.editReply("❌ Vui lòng chọn một kênh văn bản!");
		}

		const botPermissions = channel.permissionsFor(interaction.guild.members.me);
		if (!botPermissions.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks])) {
			return interaction.editReply("❌ Bot không có quyền gửi tin nhắn và embed trong kênh này!");
		}

		await db.ZiLog.updateOne(
			{ guildId: interaction.guild.id },
			{
				$set: {
					channelId: channel.id,
					enabled: true,
				},
			},
			{ upsert: true },
		);

		const successEmbed = new EmbedBuilder()
			.setTitle("✅ Thiết lập Log thành công")
			.setDescription(`Kênh log đã được thiết lập tại ${channel}`)
			.addFields(
				{ name: "📋 Commands", value: "✅ Bật", inline: true },
				{ name: "🛡️ Moderation", value: "✅ Bật", inline: true },
				{ name: "⚠️ Errors", value: "✅ Bật", inline: true },
				{ name: "🔊 Voice", value: "❌ Tắt", inline: true },
				{ name: "👋 Join/Leave", value: "❌ Tắt", inline: true },
			)
			.setColor("Green")
			.setTimestamp()
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) });

		await interaction.editReply({ embeds: [successEmbed] });

		const testLogEmbed = new EmbedBuilder()
			.setTitle("🤖 Hệ thống Log đã được kích hoạt")
			.setDescription(`Kênh này sẽ nhận các thông báo về hoạt động của bot trong server **${interaction.guild.name}**`)
			.addFields(
				{ name: "👤 Được thiết lập bởi", value: `${interaction.user.tag}`, inline: true },
				{ name: "⏰ Thời gian", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
			)
			.setColor("Blue")
			.setTimestamp();

		await channel.send({ embeds: [testLogEmbed] });
	} catch (error) {
		console.error("Error setting up log:", error);
		return interaction.editReply("❌ Đã xảy ra lỗi khi thiết lập log!");
	}
};

module.exports.disableLog = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	try {
		const logConfig = await db.ZiLog.findOne({ guildId: interaction.guild.id });

		if (!logConfig || !logConfig.enabled) {
			return interaction.editReply("❌ Hệ thống log chưa được thiết lập hoặc đã bị tắt!");
		}

		await db.ZiLog.updateOne({ guildId: interaction.guild.id }, { $set: { enabled: false } });

		const successEmbed = new EmbedBuilder()
			.setTitle("✅ Đã tắt hệ thống Log")
			.setDescription("Hệ thống log đã được tắt. Bot sẽ không gửi log nữa.")
			.setColor("Red")
			.setTimestamp()
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) });

		await interaction.editReply({ embeds: [successEmbed] });
	} catch (error) {
		console.error("Error disabling log:", error);
		return interaction.editReply("❌ Đã xảy ra lỗi khi tắt log!");
	}
};

module.exports.configLog = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	try {
		const logConfig = await db.ZiLog.findOne({ guildId: interaction.guild.id });

		if (!logConfig) {
			return interaction.editReply("❌ Vui lòng thiết lập kênh log trước khi cấu hình! Sử dụng `/log setup`");
		}

		const commands = interaction.options.getBoolean("commands");
		const moderation = interaction.options.getBoolean("moderation");
		const errors = interaction.options.getBoolean("errors");
		const voice = interaction.options.getBoolean("voice");
		const joinLeave = interaction.options.getBoolean("join_leave");

		const updateObj = {};
		if (commands !== null) updateObj["logTypes.commands"] = commands;
		if (moderation !== null) updateObj["logTypes.moderation"] = moderation;
		if (errors !== null) updateObj["logTypes.errors"] = errors;
		if (voice !== null) updateObj["logTypes.voice"] = voice;
		if (joinLeave !== null) updateObj["logTypes.join_leave"] = joinLeave;

		if (Object.keys(updateObj).length === 0) {
			return interaction.editReply("❌ Vui lòng chọn ít nhất một tùy chọn để cấu hình!");
		}

		await db.ZiLog.updateOne({ guildId: interaction.guild.id }, { $set: updateObj });

		const updatedConfig = await db.ZiLog.findOne({ guildId: interaction.guild.id });

		const successEmbed = new EmbedBuilder()
			.setTitle("✅ Cập nhật cấu hình Log")
			.setDescription("Đã cập nhật cấu hình log thành công!")
			.addFields(
				{ name: "📋 Commands", value: updatedConfig.logTypes.commands ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "🛡️ Moderation", value: updatedConfig.logTypes.moderation ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "⚠️ Errors", value: updatedConfig.logTypes.errors ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "🔊 Voice", value: updatedConfig.logTypes.voice ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "👋 Join/Leave", value: updatedConfig.logTypes.join_leave ? "✅ Bật" : "❌ Tắt", inline: true },
			)
			.setColor("Green")
			.setTimestamp()
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) });

		await interaction.editReply({ embeds: [successEmbed] });
	} catch (error) {
		console.error("Error configuring log:", error);
		return interaction.editReply("❌ Đã xảy ra lỗi khi cấu hình log!");
	}
};

module.exports.infoLog = async ({ interaction, lang, db }) => {
	await interaction.deferReply({ ephemeral: true });

	try {
		const logConfig = await db.ZiLog.findOne({ guildId: interaction.guild.id });

		if (!logConfig) {
			return interaction.editReply("❌ Hệ thống log chưa được thiết lập! Sử dụng `/log setup` để thiết lập.");
		}

		const channel = interaction.guild.channels.cache.get(logConfig.channelId);
		const channelMention = channel ? `${channel}` : "❌ Kênh không tồn tại";

		const infoEmbed = new EmbedBuilder()
			.setTitle("📊 Thông tin Log")
			.setDescription(`**Trạng thái:** ${logConfig.enabled ? "✅ Đang hoạt động" : "❌ Đã tắt"}`)
			.addFields(
				{ name: "📺 Kênh Log", value: channelMention, inline: false },
				{ name: "📋 Commands", value: logConfig.logTypes.commands ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "🛡️ Moderation", value: logConfig.logTypes.moderation ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "⚠️ Errors", value: logConfig.logTypes.errors ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "🔊 Voice", value: logConfig.logTypes.voice ? "✅ Bật" : "❌ Tắt", inline: true },
				{ name: "👋 Join/Leave", value: logConfig.logTypes.join_leave ? "✅ Bật" : "❌ Tắt", inline: true },
			)
			.setColor("Blue")
			.setTimestamp()
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) });

		await interaction.editReply({ embeds: [infoEmbed] });
	} catch (error) {
		console.error("Error fetching log info:", error);
		return interaction.editReply("❌ Đã xảy ra lỗi khi lấy thông tin log!");
	}
};
