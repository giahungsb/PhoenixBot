const { EmbedBuilder } = require("discord.js");
const InstagramDownloaderAPI = require("../../lib/instagram-downloader-api");

const downloaderAPI = new InstagramDownloaderAPI();

module.exports.data = {
        name: "B_instagram_download",
        type: "button",
};

module.exports.execute = async ({ interaction, lang }) => {
        const footerText = interaction.message?.embeds?.[1]?.footer?.text;

        if (!footerText || !footerText.includes("IGDL|")) {
                return await interaction.reply({
                        content: "❌ Không tìm thấy thông tin bài viết!",
                        ephemeral: true,
                });
        }

        const match = footerText.match(/IGDL\|([^|]+)\|uid=(\d+)/);
        if (!match) {
                return await interaction.reply({
                        content: "❌ Dữ liệu không hợp lệ!",
                        ephemeral: true,
                });
        }

        const [, shortcode, userId] = match;

        if (userId !== interaction.user.id) {
                return await interaction.reply({
                        content: "❌ Chỉ người yêu cầu mới có thể sử dụng button này!",
                        ephemeral: true,
                });
        }

        await interaction.deferReply({ ephemeral: true });

        console.log(`[INSTAGRAM_DOWNLOAD] User ${interaction.user.tag} đang tải media: ${shortcode}`);

        try {
                const originalUrl = interaction.message?.embeds?.[0]?.url || `https://www.instagram.com/p/${shortcode}/`;

                const downloadData = await module.exports.getDownloadLinks(originalUrl, shortcode);

                if (!downloadData.success) {
                        return interaction.editReply({
                                content: `❌ ${downloadData.error || "Không thể lấy link tải về. Vui lòng thử lại sau."}`,
                        });
                }

                const downloadEmbed = new EmbedBuilder()
                        .setColor("#00FF00")
                        .setTitle("✅ Link tải về Instagram Media (HD)")
                        .setTimestamp();

                if (downloadData.links && downloadData.links.length > 0) {
                        const linksList = downloadData.links
                                .map((link, i) => {
                                        const type = link.type || "Media";
                                        const quality = link.quality || "HD";
                                        return `${i + 1}. [📥 Tải ${type} ${i + 1} (${quality})](${link.url})`;
                                })
                                .join("\n");

                        downloadEmbed.setDescription(
                                `**📥 Danh sách tải về:**\n${linksList}\n\n💡 **Hướng dẫn:**\nClick vào link → Nhấn chuột phải → Chọn "Save As" để tải về.`
                        );
                } else {
                        downloadEmbed.setDescription("❌ Không tìm thấy link download.");
                }

                if (downloadData.thumbnail) {
                        downloadEmbed.setThumbnail(downloadData.thumbnail);
                }

                downloadEmbed.setFooter({
                        text: `Tải bởi ${interaction.user.username} • API: ${downloadData.apiUsed || "Snapsave"}`,
                        iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                });

                return interaction.editReply({
                        embeds: [downloadEmbed],
                });
        } catch (error) {
                console.error("[INSTAGRAM_DOWNLOAD] ❌ Lỗi khi tải media:", error.message);
                console.error("[INSTAGRAM_DOWNLOAD] Stack:", error.stack);
                return interaction.editReply({
                        content: "❌ Có lỗi xảy ra khi tải media. Vui lòng thử lại sau.",
                });
        }
};

module.exports.getDownloadLinks = async function (url, shortcode) {
        console.log(`[INSTAGRAM_DOWNLOAD] Đang tải media từ Instagram...`);
        
        try {
                const result = await downloaderAPI.getMedia(url);
                
                if (result && result.success) {
                        let links = [];

                        if (result.mediaItems && result.mediaItems.length > 0) {
                                links = result.mediaItems.map(item => ({
                                        url: item.url,
                                        type: item.type === 'video' ? 'Video' : 'Photo',
                                        quality: item.quality || 'HD',
                                }));
                        } else if (result.downloadUrl) {
                                links.push({
                                        url: result.downloadUrl,
                                        type: result.type === 'video' ? 'Video' : 'Photo',
                                        quality: 'HD',
                                });
                        }

                        if (links.length > 0) {
                                console.log(`[INSTAGRAM_DOWNLOAD] ✅ Tìm thấy ${links.length} media: ${result.method}`);
                                
                                return {
                                        success: true,
                                        links: links,
                                        thumbnail: result.thumbnail,
                                        apiUsed: `${result.method || 'Snapsave'} (Free)`,
                                };
                        }
                }
                
                throw new Error('No media found');
        } catch (error) {
                console.log(`[INSTAGRAM_DOWNLOAD] ⚠️ Download thất bại: ${error.message}`);
                
                return {
                        success: false,
                        error: "❌ Không thể lấy link download. API đang gặp vấn đề.\n\n💡 Thử lại sau vài phút.",
                };
        }
};
