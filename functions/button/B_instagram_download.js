const { EmbedBuilder } = require("discord.js");
const FastDLCrawler = require("../../lib/fastdl-crawler");
const InstagramDownloader = require("../../lib/instagram-utils");
const { getTokenManager } = require("../../lib/download-token-manager");
const { getPublicDomain } = require("../../lib/domain-detector");
const path = require("path");

const crawlerDownloader = new FastDLCrawler();
const localDownloader = new InstagramDownloader();

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

        await interaction.editReply({
                content: "⏳ **Đang lấy link download (Local)...**\n💡 Vui lòng chờ trong giây lát (có thể mất 10-20 giây)",
        });

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
                        .setTitle("✅ Link tải về Instagram Media (Local Download)")
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
                                `**📥 Danh sách tải về:**\n${linksList}\n\n💡 **Hướng dẫn:**\nClick vào link để tải về máy của bạn (Local Server).`
                        );
                } else {
                        downloadEmbed.setDescription("❌ Không tìm thấy link download.");
                }

                if (downloadData.thumbnail) {
                        downloadEmbed.setThumbnail(downloadData.thumbnail);
                }

                downloadEmbed.setFooter({
                        text: `Tải bởi ${interaction.user.username} • API: Local Download`,
                        iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                });

                return interaction.editReply({
                        content: null,
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
                // Bước 1: Lấy media từ fastdl.app
                const result = await crawlerDownloader.getMedia(url);
                
                if (result && result.success && result.mediaItems) {
                        let links = [];

                        // Bước 2: Download từng media locally
                        for (const mediaItem of result.mediaItems) {
                                try {
                                        console.log(`[INSTAGRAM_DOWNLOAD] Downloading: ${mediaItem.type}...`);
                                        
                                        const fileType = mediaItem.type === 'video' ? 'mp4' : 'jpg';
                                        const downloadResult = await localDownloader.downloadAndConvert(
                                                mediaItem.url,
                                                fileType
                                        );

                                        if (downloadResult.success) {
                                                // Bước 3: Tạo token bảo mật
                                                const tokenManager = getTokenManager();
                                                const token = tokenManager.createToken(
                                                        downloadResult.filepath,
                                                        downloadResult.filename,
                                                        3600 // 1 giờ
                                                );

                                                // Bước 4: Tạo download link với domain auto-detect
                                                const baseDomain = getPublicDomain();
                                                const downloadUrl = `${baseDomain}/download/${token}`;

                                                links.push({
                                                        url: downloadUrl,
                                                        type: mediaItem.type === 'video' ? 'Video' : 'Photo',
                                                        quality: mediaItem.quality || 'HD',
                                                });

                                                console.log(`[INSTAGRAM_DOWNLOAD] ✅ Created download token for ${downloadResult.filename}`);
                                        } else {
                                                console.warn(`[INSTAGRAM_DOWNLOAD] ⚠️ Download failed: ${downloadResult.error}`);
                                        }
                                } catch (err) {
                                        console.error('[INSTAGRAM_DOWNLOAD] Error processing media:', err.message);
                                }
                        }

                        if (links.length > 0) {
                                console.log(`[INSTAGRAM_DOWNLOAD] ✅ Tìm thấy ${links.length} media: Local Download`);
                                
                                return {
                                        success: true,
                                        links: links,
                                        thumbnail: result.thumbnail,
                                        apiUsed: 'Local Download (Secure)',
                                };
                        }
                }
                
                throw new Error('No media found');
        } catch (error) {
                console.log(`[INSTAGRAM_DOWNLOAD] ⚠️ Download thất bại: ${error.message}`);
                
                return {
                        success: false,
                        error: "❌ Không thể lấy link download.\n\n💡 Thử lại sau vài phút.",
                };
        }
};
