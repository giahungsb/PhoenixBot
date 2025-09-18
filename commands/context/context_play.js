const Encryptor = require("@zibot/ziencryptor");
const { useFunctions } = require("@zibot/zihooks");
const fetch = require("node-fetch");

module.exports.data = {
	name: "Play / Add music",
	type: 3, // context
	options: [],
	integration_types: [0],
	contexts: [0],
};

/**
 * @param { object } context - object command
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } context.interaction - interaction
 * @param { import('../../lang/vi.js') } context.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
	try {
		let query = interaction.targetMessage.content;

		if (!query) {
			query = await handleEmbed(interaction, lang);
			if (query === "ZibotZibotZibotZibot") return;
		}

		if (!query) {
			console.error("No valid query found.");
			return;
		}

		const searchCommand = useFunctions().get("Search");
		await searchCommand.execute(interaction, query, lang);
	} catch (error) {
		console.error("Error executing command:", error);
	}
};

/**
 * Xử lý khi targetMessage có embed.
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } interaction - interaction.
 * @returns { string | null } Trả về query hoặc null nếu không có.
 */
async function handleEmbed(interaction, lang) {
	const embed = interaction.targetMessage.embeds?.at(0)?.data;

	if (!embed) return null;

	if (embed.author?.name?.includes("Save Queue:")) {
		const restoredTracks = await handleSaveQueue(interaction, lang);
		if (restoredTracks) return restoredTracks;
	}

	return embed?.author?.url || embed?.description || null;
}

/**
 * Xử lý khi message chứa file "save.txt".
 * @param { import ("discord.js").MessageContextMenuCommandInteraction } interaction - interaction.
 * @returns { Array | null } Trả về tracks hoặc null nếu không có.
 */
async function handleSaveQueue(interaction, lang) {
	const file = interaction.targetMessage.attachments?.at(0);

	if (!file || file.name !== "zsave.txt") return null;

	try {
		const response = await fetch(file.url);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const encryptedData = await response.text();
		const decryptor = new Encryptor("Z");
		const decryptedData = decryptor.decrypt(encryptedData);

		const restoreCommand = useFunctions().get("Restored_tracks");
		await restoreCommand.execute(interaction, decryptedData, lang);

		return "ZibotZibotZibotZibot";
	} catch (error) {
		console.error("Error restoring tracks:", error);
		return null;
	}
}
