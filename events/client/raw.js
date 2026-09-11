const { Events } = require("discord.js");

module.exports = {
        name: Events.Raw,
        type: "events",
        enable: true,

        /**
         * @param { Object } packet
         */
        execute: async (packet) => {
                // console.log(packet); // Commented out to prevent spam
        },
};
