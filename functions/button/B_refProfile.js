const { useCommands } = require("@zibot/zihooks");

module.exports.data = {
	name: "B_refProfile",
	type: "button",
};

/**
 * @param { object } button - object button
 * @param { import ("discord.js").ButtonInteraction } button.interaction - button interaction
 * @param { import('../../lang/vi.js') } button.lang - language
 * @returns
 */

module.exports.execute = async ({ interaction, lang }) => {
	const Command = useCommands();
	return Command.get("profile").execute({ interaction, lang });
};
