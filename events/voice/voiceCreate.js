const { useMainPlayer, useQueue, Track } = require("discord-player");
const { useFunctions, useAI } = require("@zibot/zihooks");
const Functions = useFunctions();

async function Update_Player(queue) {
        const player_func = Functions.get("player_func");
        if (!player_func) return;
        const res = await player_func.execute({ queue });
        queue.metadata.mess.edit(res);
}

module.exports = {
        name: "voiceCreate",
        type: "voiceExtractor",
        enable: false, // v7 không hỗ trợ

        /**
         *
         * @param { object } param0 - voice Create event
         * @param { import ("discord.js").User } param0.user - user who created the voice channel
         */
        execute: async ({ content, user, channel }) => {
                const player = useMainPlayer();
                const lowerContent = content.toLowerCase();
                // console.log(lowerContent); // Tắt ghi log nội dung giọng nói
                const queue = useQueue(channel.guild);

                const commands = {
                        "skip|bỏ qua|next": () => {
                                queue.node.skip();
                                // Bỏ qua bài hát thành công
                        },
                        "volume|âm lượng": () => {
                                const volumeMatch = lowerContent.match(/\d+/);
                                if (volumeMatch) {
                                        const newVolume = parseInt(volumeMatch[0]);
                                        if (newVolume >= 0 && newVolume <= 100) {
                                                queue.node.setVolume(newVolume);
                                                // Đặt âm lượng thành công
                                        } else {
                                                // Âm lượng vượt quá giới hạn
                                        }
                                } else {
                                        // Giá trị âm lượng không hợp lệ
                                }
                                Update_Player(queue);
                        },
                        "pause|tạm dừng": () => {
                                queue.node.pause();
                                Update_Player(queue);
                                // Đã tạm dừng nhạc
                        },
                        "resume|tiếp tục": () => {
                                queue.node.resume();
                                Update_Player(queue);
                                // Music resumed
                        },
                        "disconnect|ngắt kết nối": () => {
                                queue.delete();
                                // Disconnected
                        },
                        "auto play|tự động phát": async () => {
                                queue.setRepeatMode(queue.repeatMode === 3 ? 0 : 3);
                                if (queue.isPlaying()) return Update_Player(queue);
                                const B_player_autoPlay = Functions.get("B_player_autoPlay");
                                const tracks = await B_player_autoPlay.getRelatedTracks(queue?.history?.previousTrack, queue?.history);
                                if (!tracks?.at(0)?.url.length) return;
                                const searchCommand = Functions.get("Search");
                                await searchCommand.execute(null, tracks?.at(0)?.url, queue?.metadata?.lang);
                        },
                        "play|tìm|phát|hát": async () => {
                                const query = lowerContent.replace(/play|tìm|phát|hát/g, "").trim();
                                await player.play(channel, query);
                        },
                };

                for (const [pattern, action] of Object.entries(commands)) {
                        if (lowerContent.match(new RegExp(pattern))) {
                                if (!queue) continue;
                                await action();
                                return;
                        }
                }

                const aifunc = await Functions.get("runVoiceAI");
                if (aifunc.checkStatus) {
                        const result = await useAI().run(lowerContent, user);

                        const tts = await Functions.get("TextToSpeech");
                        await tts.execute(
                                {
                                        client: player.client,
                                        guild: channel.guild,
                                        user,
                                },
                                result,
                                queue?.metadata?.lang,
                                { queue, title: lowerContent, voice: channel, old_Prompt: res.old_Prompt },
                        );
                }
        },
};
