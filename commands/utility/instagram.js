const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const FastDLCrawler = require("../../lib/fastdl-crawler");

const downloader = new FastDLCrawler();

module.exports = {
        data: {
                name: "instagram",
                description: "Tải ảnh/video từ Instagram",
                type: 1,
                options: [
                        {
                                name: "url",
                                description: "Link bài viết Instagram (VD: https://www.instagram.com/p/...)",
                                type: 3,
                                required: true,
                        },
                ],
                integration_types: [0, 1],
                contexts: [0, 1, 2],
        },

        async execute({ interaction, lang }) {
                await interaction.deferReply();

                const urlInput = interaction.options.getString("url");

                const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
                const match = urlInput.match(instagramRegex);

                if (!match) {
                        return interaction.editReply({
                                content: "❌ Vui lòng nhập link Instagram hợp lệ (post/reel/tv).",
                        });
                }

                const shortcode = match[1];
                console.log(`[INSTAGRAM] Đang tải media từ shortcode: ${shortcode}`);

                await interaction.editReply({
                        content: "⏳ **Đang tải media từ Instagram...**\n💡 Vui lòng chờ trong giây lát (có thể mất 5-15 giây)",
                });

                try {
                        const mediaData = await this.getInstagramMedia(urlInput, shortcode);

                        if (!mediaData.success) {
                                return interaction.editReply({
                                        content: `❌ ${mediaData.error || "Không thể tải thông tin từ Instagram. Vui lòng thử lại sau."}`,
                                });
                        }

                        const authorEmbed = new EmbedBuilder()
                                .setColor("#E4405F")
                                .setTitle("📸 Thông tin bài viết Instagram")
                                .setURL(urlInput)
                                .addFields(
                                        { name: "👤 Tác giả", value: mediaData.author || "N/A", inline: true },
                                        { name: "📊 Loại", value: mediaData.mediaType || "N/A", inline: true },
                                        { name: "📥 Media", value: `${mediaData.mediaCount || 1} file(s)`, inline: true },
                                )
                                .setTimestamp()
                                .setFooter({
                                        text: `Yêu cầu bởi ${interaction.user.username}`,
                                        iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                                });

                        if (mediaData.title) {
                                const shortTitle = mediaData.title.length > 200 ? mediaData.title.substring(0, 200) + "..." : mediaData.title;
                                authorEmbed.setDescription(`**📝 Tiêu đề:**\n${shortTitle}`);
                        }

                        if (mediaData.thumbnail) {
                                authorEmbed.setThumbnail(mediaData.thumbnail);
                        }

                        const downloadEmbed = new EmbedBuilder()
                                .setColor("#00D9FF")
                                .setTitle("⬇️ Tải về")
                                .setDescription("Nhấn vào button bên dưới để tải media về máy của bạn!\n\n💡 **Chất lượng:** HD (Tối đa)")
                                .setFooter({
                                        text: `IGDL|${shortcode}|uid=${interaction.user.id}`,
                                });

                        const downloadButton = new ButtonBuilder()
                                .setCustomId("B_instagram_download")
                                .setLabel("📥 Tải về HD")
                                .setStyle(ButtonStyle.Success);

                        const row = new ActionRowBuilder().addComponents(downloadButton);

                        return interaction.editReply({
                                content: null,
                                embeds: [authorEmbed, downloadEmbed],
                                components: [row],
                        });
                } catch (error) {
                        console.error("[INSTAGRAM] ❌ Lỗi khi tải media:", error.message);
                        console.error("[INSTAGRAM] Stack:", error.stack);
                        return interaction.editReply({
                                content: "❌ Có lỗi xảy ra khi tải media từ Instagram. Vui lòng thử lại sau.",
                        });
                }
        },

        async getInstagramMedia(url, shortcode) {
                console.log(`[INSTAGRAM] Đang tải media từ Instagram...`);
                
                try {
                        const result = await downloader.getMedia(url);
                        
                        if (result && result.success) {
                                console.log(`[INSTAGRAM] ✅ Lấy dữ liệu thành công: ${result.method}`);

                                const authorName = result.fullname || result.username || "Instagram User";
                                const isVerified = result.isVerified ? " ✓" : "";

                                return {
                                        success: true,
                                        shortcode: shortcode,
                                        author: authorName + isVerified,
                                        title: "",
                                        thumbnail: result.thumbnail || null,
                                        mediaType: result.mediaItems?.[0]?.type === 'video' ? 'Video' : 'Photo',
                                        mediaCount: result.mediaCount || 1,
                                        apiUsed: result.method,
                                        downloadUrl: result.downloadUrl,
                                        mediaItems: result.mediaItems,
                                        likes: result.likes || 0,
                                };
                        }
                } catch (error) {
                        console.log(`[INSTAGRAM] ⚠️ Download thất bại: ${error.message}`);
                        
                        return {
                                success: false,
                                error: "❌ Không thể tải từ Instagram. API hiện đang gặp vấn đề.\n\n" +
                                       "💡 **Có thể thử:**\n" +
                                       "- Kiểm tra link có đúng không\n" +
                                       "- Post/Reel phải ở chế độ public\n" +
                                       "- Thử lại sau vài phút",
                        };
                }
        },
};
