const { EmbedBuilder } = require("discord.js");
const { useDB } = require("@zibot/zihooks");

class BotLogger {
	constructor() {
		this.cache = new Map();
	}

	async getLogConfig(guildId) {
		if (this.cache.has(guildId)) {
			return this.cache.get(guildId);
		}

		const db = useDB();
		if (!db) return null;

		try {
			const config = await db.ZiLog.findOne({ guildId });
			if (config) {
				this.cache.set(guildId, config);
				setTimeout(() => this.cache.delete(guildId), 300000);
			}
			return config;
		} catch (error) {
			console.error("Error fetching log config:", error);
			return null;
		}
	}

	async sendLog(client, guildId, logType, embed) {
		try {
			const config = await this.getLogConfig(guildId);

			if (!config || !config.enabled) return;

			if (!config.logTypes[logType]) return;

			const channel = await client.channels.fetch(config.channelId).catch(() => null);
			if (!channel || !channel.isTextBased()) return;

			const permissions = channel.permissionsFor(client.user);
			if (!permissions || !permissions.has(["SendMessages", "EmbedLinks"])) return;

			await channel.send({ embeds: [embed] });
		} catch (error) {
			console.error("Error sending log:", error);
		}
	}

	async logCommand(client, interaction) {
		const embed = new EmbedBuilder()
			.setTitle("📋 Command Used")
			.setDescription(`**Command:** \`/${interaction.commandName}\``)
			.addFields(
				{ name: "👤 User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
				{ name: "📺 Channel", value: `${interaction.channel}`, inline: true },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
			)
			.setColor("Blue")
			.setTimestamp()
			.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 1024 }) });

		if (interaction.options?.data?.length > 0) {
			const options = interaction.options.data
				.map(opt => {
					if (opt.value !== undefined) {
						return `**${opt.name}:** ${opt.value}`;
					} else if (opt.options) {
						return `**${opt.name}:** ${opt.options.map(o => `${o.name}=${o.value}`).join(", ")}`;
					}
					return `**${opt.name}**`;
				})
				.join("\n");
			embed.addFields({ name: "⚙️ Options", value: options || "None", inline: false });
		}

		await this.sendLog(client, interaction.guildId, "commands", embed);
	}

	async logModeration(client, guildId, action, moderator, target, reason = "No reason provided") {
		const actionEmojis = {
			ban: "🔨",
			kick: "👢",
			timeout: "⏰",
			unban: "✅",
			untimeout: "✅",
		};

		const actionColors = {
			ban: "Red",
			kick: "Orange",
			timeout: "Yellow",
			unban: "Green",
			untimeout: "Green",
		};

		const embed = new EmbedBuilder()
			.setTitle(`${actionEmojis[action] || "🛡️"} Moderation Action: ${action.toUpperCase()}`)
			.addFields(
				{ name: "👤 Target", value: `${target.tag || target} (${target.id || target})`, inline: true },
				{ name: "🛡️ Moderator", value: `${moderator.tag} (${moderator.id})`, inline: true },
				{ name: "📝 Reason", value: reason, inline: false },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
			)
			.setColor(actionColors[action] || "Blue")
			.setTimestamp();

		await this.sendLog(client, guildId, "moderation", embed);
	}

	async logError(client, guildId, error, context = "Unknown") {
		const embed = new EmbedBuilder()
			.setTitle("⚠️ Error Occurred")
			.setDescription(`**Context:** ${context}`)
			.addFields(
				{ name: "❌ Error", value: `\`\`\`${error.message || error}\`\`\``, inline: false },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
			)
			.setColor("Red")
			.setTimestamp();

		if (error.stack) {
			const stackTrace = error.stack.slice(0, 1000);
			embed.addFields({ name: "📚 Stack Trace", value: `\`\`\`${stackTrace}\`\`\``, inline: false });
		}

		await this.sendLog(client, guildId, "errors", embed);
	}

	async logVoice(client, guildId, member, action, channel) {
		const actionEmojis = {
			join: "🔊",
			leave: "🔇",
			move: "↔️",
		};

		const embed = new EmbedBuilder()
			.setTitle(`${actionEmojis[action] || "🔊"} Voice Activity: ${action.toUpperCase()}`)
			.addFields(
				{ name: "👤 Member", value: `${member.user.tag} (${member.id})`, inline: true },
				{ name: "📺 Channel", value: channel ? `${channel.name}` : "None", inline: true },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
			)
			.setColor("Purple")
			.setTimestamp();

		await this.sendLog(client, guildId, "voice", embed);
	}

	async logJoinLeave(client, guildId, member, action) {
		const embed = new EmbedBuilder()
			.setTitle(action === "join" ? "👋 Member Joined" : "👋 Member Left")
			.addFields(
				{ name: "👤 Member", value: `${member.user.tag} (${member.id})`, inline: true },
				{ name: "📅 Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
				{ name: "⏰ Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
			)
			.setColor(action === "join" ? "Green" : "Orange")
			.setTimestamp()
			.setThumbnail(member.user.displayAvatarURL({ size: 256 }));

		if (action === "join") {
			const guild = member.guild;
			embed.addFields({ name: "👥 Member Count", value: `${guild.memberCount}`, inline: true });
		}

		await this.sendLog(client, guildId, "join_leave", embed);
	}

	clearCache(guildId) {
		if (guildId) {
			this.cache.delete(guildId);
		} else {
			this.cache.clear();
		}
	}
}

module.exports = new BotLogger();
