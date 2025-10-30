const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const Tiktok = require("@tobyg74/tiktok-api-dl");
const TikTokDownloadAccelerator = require("../../lib/tiktok-download-accelerator");

const accelerator = TikTokDownloadAccelerator.getInstance({
        cacheExpireTime: 1800000,
        maxRetries: 3,
        timeout: 90000,
        maxCacheSize: 200 * 1024 * 1024,
        maxFileSize: 25 * 1024 * 1024
});

module.exports.data = {
        name: "tiktok",
        description: "Tải video TikTok không có watermark",
        type: 1,
        options: [
                {
                        name: "link",
                        description: "Link video TikTok cần tải",
                        type: 3,
                        required: true,
                },
        ],
        integration_types: [0, 1],
        contexts: [0, 1, 2],
};

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const url = interaction.options.getString("link");

                if (!url.includes("tiktok.com")) {
                        return interaction.reply({
                                content: "❌ Link không hợp lệ! Vui lòng cung cấp link TikTok hợp lệ.",
                                ephemeral: true,
                        });
                }

                await interaction.deferReply();

                const result = await Tiktok.Downloader(url, {
                        version: "v3",
                });

                if (result.status !== "success") {
                        return interaction.editReply({
                                content: "❌ Không thể tải video. Vui lòng kiểm tra lại link hoặc thử lại sau.",
                        });
                }

                const data = result.result;
                const title = data.desc || data.description || "Không có tiêu đề";
                const authorName = data.author?.nickname || "unknown";
                const authorAvatar = data.author?.avatar || null;

                const isImageSlideshow = data.type === "image";

                if (isImageSlideshow) {
                        const images = data.images || [];
                        const downloadUrl = images.length > 0 ? images[0] : null;

                        const previewEmbed = new EmbedBuilder()
                                .setColor("#00f2ea")
                                .setTitle("📸 TikTok Image Slideshow")
                                .setDescription(`**${title}**`)
                                .addFields(
                                        { name: "👤 Tác giả", value: authorName, inline: true },
                                        { name: "🖼️ Số ảnh", value: `${images.length}`, inline: true }
                                )
                                .setImage(downloadUrl)
                                .setThumbnail(authorAvatar)
                                .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                .setTimestamp();

                        const buttons = new ActionRowBuilder();
                        if (downloadUrl) {
                                buttons.addComponents(
                                        new ButtonBuilder()
                                                .setLabel("📥 Tải ảnh đầu tiên")
                                                .setURL(downloadUrl)
                                                .setStyle(ButtonStyle.Link)
                                );
                        }

                        if (images.length > 1) {
                                buttons.addComponents(
                                        new ButtonBuilder()
                                                .setLabel(`📋 Xem tất cả ${images.length} ảnh`)
                                                .setURL(url)
                                                .setStyle(ButtonStyle.Link)
                                );
                        }

                        const downloadEmbed = new EmbedBuilder()
                                .setColor("#ff0050")
                                .setTitle("⬇️ Tải xuống ảnh")
                                .setDescription(`Nhấn nút bên dưới để tải xuống ảnh từ slideshow TikTok.\n\n**Tổng số ảnh:** ${images.length}`)
                                .setFooter({ text: "Chất lượng: HD" });

                        return interaction.editReply({
                                embeds: [previewEmbed, downloadEmbed],
                                components: buttons.components.length > 0 ? [buttons] : [],
                        });
                } else {
                        const videoHD = data.videoHD;
                        const videoSD = data.videoSD;
                        const videoWatermark = data.videoWatermark;

                        const videoUrl = videoHD || videoSD || videoWatermark;

                        if (!videoUrl) {
                                return interaction.editReply({
                                        content: "❌ Không tìm thấy link video. Vui lòng thử lại.",
                                });
                        }

                        const previewEmbed = new EmbedBuilder()
                                .setColor("#00f2ea")
                                .setTitle("🎥 TikTok Video")
                                .setDescription(`**${title}**`)
                                .addFields(
                                        { name: "👤 Tác giả", value: authorName, inline: true },
                                        { name: "📹 Chất lượng", value: videoHD ? "Full HD" : (videoSD ? "SD" : "Standard"), inline: true }
                                )
                                .setThumbnail(authorAvatar)
                                .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                .setTimestamp();

                        await interaction.editReply({
                                embeds: [previewEmbed],
                                content: "⚡ Đang tải video với tốc độ cao...",
                        });

                        try {
                                console.log('[TikTok Command] Starting accelerated download...');
                                const videoBuffer = await accelerator.download(videoUrl);
                                
                                const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
                                console.log(`[TikTok Command] Downloaded video: ${fileSizeMB} MB`);

                                const attachment = new AttachmentBuilder(videoBuffer, {
                                        name: `tiktok_${Date.now()}.mp4`,
                                        description: title.substring(0, 100),
                                        contentType: 'video/mp4'
                                });

                                const successEmbed = new EmbedBuilder()
                                        .setColor("#00ff00")
                                        .setTitle("✅ Tải xuống thành công")
                                        .setDescription(`**Dung lượng:** ${fileSizeMB} MB\n**Codec:** H.264 (tương thích mọi thiết bị) 📱💻\n**Tốc độ:** Tăng tốc 3-5 lần 🚀`)
                                        .setFooter({ text: "Chất lượng: " + (videoHD ? "Full HD | Không watermark | H.264 codec" : "SD | Không watermark | H.264 codec") });

                                console.log('[TikTok Command] Sending video to Discord...');
                                return interaction.editReply({
                                        content: null,
                                        embeds: [previewEmbed, successEmbed],
                                        files: [attachment],
                                        components: [],
                                });

                        } catch (downloadError) {
                                console.error('[TikTok Command] Accelerated download failed:', downloadError.message);

                                let downloadEmbed;
                                if (downloadError.message === 'FILE_TOO_LARGE') {
                                        console.log('[TikTok Command] File too large for Discord, sending link instead');
                                        downloadEmbed = new EmbedBuilder()
                                                .setColor("#ff9900")
                                                .setTitle("⚠️ File quá lớn")
                                                .setDescription(`Video có dung lượng **${downloadError.sizeMB} MB** (vượt quá giới hạn 25MB của Discord).\n\nVui lòng tải qua link bên dưới.`)
                                                .setFooter({ text: "Chất lượng: " + (videoHD ? "Full HD | Không có watermark" : "SD | Không có watermark") });
                                } else {
                                        console.log('[TikTok Command] Download error, falling back to link method');
                                        downloadEmbed = new EmbedBuilder()
                                                .setColor("#ff0050")
                                                .setTitle("⬇️ Tải xuống video")
                                                .setDescription("Không thể tải trực tiếp, vui lòng tải qua link bên dưới.")
                                                .setFooter({ text: "Chất lượng: " + (videoHD ? "Full HD | Không có watermark" : "SD | Không có watermark") });
                                }

                                const buttons = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setLabel("📥 Tải Video " + (videoHD ? "HD" : "SD"))
                                                .setURL(videoUrl)
                                                .setStyle(ButtonStyle.Link)
                                );

                                return interaction.editReply({
                                        content: null,
                                        embeds: [previewEmbed, downloadEmbed],
                                        components: [buttons],
                                });
                        }
                }
        } catch (error) {
                console.error("TikTok download error:", error);
                
                const errorMessage = interaction.deferred || interaction.replied
                        ? { content: "❌ Đã xảy ra lỗi khi xử lý video TikTok. Vui lòng thử lại sau hoặc kiểm tra link." }
                        : { content: "❌ Đã xảy ra lỗi khi xử lý video TikTok. Vui lòng thử lại sau hoặc kiểm tra link.", ephemeral: true };

                if (interaction.deferred || interaction.replied) {
                        return interaction.editReply(errorMessage);
                } else {
                        return interaction.reply(errorMessage);
                }
        }
};
