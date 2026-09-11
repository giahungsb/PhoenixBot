const { useFunctions } = require("@zibot/zihooks");

module.exports.data = {
        name: "S_player_Track",
        type: "SelectMenu",
};

/**
 * @param { object } selectmenu - object selectmenu
 * @param { import ("discord.js").StringSelectMenuInteraction } selectmenu.interaction - selectmenu interaction
 * @param { import('../../lang/vi.js') } selectmenu.lang - language
 */

module.exports.execute = async ({ interaction, lang }) => {
        // chọn track từ lệnh tìm kiếm văn bản | modal tìm kiếm | ngữ cảnh tìm kiếm | v.v.
        const query = interaction.values?.at(0);
        if (query === "cancel") return interaction.message.delete().catch((e) => {});
        const command = useFunctions().get("Search");
        await command.execute(interaction, query, lang);
        return;
};
