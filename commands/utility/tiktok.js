/**
 * =====================================================
 * COMMAND: /TIKTOK
 * =====================================================
 * Tải video/ảnh TikTok không watermark
 * 
 * Tính năng:
 * - Tải video TikTok (HD/SD) - trả link download trực tiếp
 * - Tải ảnh slideshow TikTok và đóng gói thành ZIP
 * - Progress bar cho download và conversion
 * - Pagination cho slideshow (nếu nhiều ảnh)
 * 
 * Quy trình xử lý VIDEO (MỚI):
 * 1. Trích xuất URL CDN từ TikTok API
 * 2. Download video từ TikTok CDN
 * 3. Chuyển đổi sang H.264/AAC
 * 4. Tạo worker URL để user download trực tiếp
 * 5. Xóa file tạm, trả link download trong embed
 * 
 * Quy trình xử lý SLIDESHOW:
 * 1. Download tất cả ảnh từ TikTok
 * 2. Tạo file ZIP chứa tất cả ảnh
 * 3. Upload ZIP + hiển thị ảnh với pagination
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const Tiktok = require("@tobyg74/tiktok-api-dl");
const { TikTokCDNExtractor, TikTokDownloaderProgress, VideoConverter } = require("../../lib/tiktok-utils");
const { getTokenManager } = require("../../lib/download-token-manager");
const fs = require("fs").promises;
const path = require("path");
const archiver = require("archiver");

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Dọn dẹp các file tạm
 */
async function cleanupFiles(...filePaths) {
        for (const filePath of filePaths) {
                try {
                        await fs.unlink(filePath);
                } catch (error) {
                        // Bỏ qua lỗi (file có thể đã bị xóa)
                }
        }
}

/**
 * Tạo file ZIP từ danh sách ảnh
 */
async function createZipFromImages(imagePaths, outputPath) {
        return new Promise((resolve, reject) => {
                const output = require('fs').createWriteStream(outputPath);
                const archive = archiver('zip', {
                        zlib: { level: 9 } // Nén tối đa
                });

                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));

                archive.pipe(output);

                // Thêm từng ảnh vào ZIP
                imagePaths.forEach((imgPath, index) => {
                        archive.file(imgPath, { name: `image_${index + 1}.jpg` });
                });

                archive.finalize();
        });
}

// =====================================================
// COMMAND DEFINITION
// =====================================================

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
        contexts: [0, 1],
};

// =====================================================
// COMMAND EXECUTION
// =====================================================

module.exports.execute = async ({ interaction, lang }) => {
        try {
                const url = interaction.options.getString("link");

                // Validate URL
                if (!url.includes("tiktok.com")) {
                        return interaction.reply({
                                content: "❌ Link không hợp lệ! Vui lòng cung cấp link TikTok hợp lệ.",
                                ephemeral: true,
                        });
                }

                await interaction.deferReply();

                // =====================================================
                // BƯỚC 1: Lấy dữ liệu từ TikTok API
                // =====================================================
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

                // =====================================================
                // BƯỚC 2: Trích xuất URL CDN gốc
                // =====================================================
                const extractor = new TikTokCDNExtractor();
                const cdnUrls = extractor.extractAllUrls(data);

                const isImageSlideshow = data.type === "image";

                // =====================================================
                // XỬ LÝ SLIDESHOW (ẢNH)
                // =====================================================
                if (isImageSlideshow) {
                        // Sử dụng URL gốc từ data.images (không qua extractor để giữ nguyên quality)
                        let images = data.images || [];
                        
                        // Nếu URL có q70 (quality 70%), thay thế thành q100 (full quality)
                        images = images.map(imgUrl => {
                                // Decode base64 nếu là fastdl.muscdn.app
                                if (imgUrl.includes('fastdl.muscdn.app/a/images/')) {
                                        try {
                                                const base64Part = imgUrl.split('/images/')[1];
                                                const decodedUrl = Buffer.from(base64Part, 'base64').toString('utf-8');
                                                const fullQualityUrl = decodedUrl.replace(':q70', ':q100');
                                                return fullQualityUrl;
                                        } catch (error) {
                                                return imgUrl;
                                        }
                                }
                                return imgUrl;
                        });
                        
                        if (images.length === 0) {
                                return interaction.editReply({
                                        content: "❌ Không tìm thấy ảnh trong slideshow.",
                                });
                        }

                        await interaction.editReply({
                                content: `⏳ Đang tải ${images.length} ảnh...`,
                        });

                        const tmpDir = path.join(process.cwd(), 'tmp');
                        await fs.mkdir(tmpDir, { recursive: true });

                        const downloadedImages = [];
                        const zipPath = path.join(tmpDir, `tiktok_${interaction.id}_images.zip`);
                        
                        try {
                                // Download tất cả ảnh
                                const progressDownloader = new TikTokDownloaderProgress();
                                const downloadedPaths = await progressDownloader.downloadMultipleWithDiscordProgress(
                                        images,
                                        tmpDir,
                                        interaction,
                                        `${images.length} ảnh slideshow`
                                );
                                
                                downloadedImages.push(...downloadedPaths.map((filePath, i) => ({ 
                                        path: filePath, 
                                        index: i 
                                })));

                                if (downloadedImages.length === 0) {
                                        return interaction.editReply({
                                                content: "❌ Không thể tải ảnh. Vui lòng thử lại sau.",
                                        });
                                }

                                // Tạo file ZIP
                                await interaction.editReply({
                                        content: `⏳ Đang tạo file ZIP chứa ${downloadedImages.length} ảnh...`,
                                });
                                
                                await createZipFromImages(downloadedImages.map(img => img.path), zipPath);
                                
                                const zipAttachment = new AttachmentBuilder(zipPath, {
                                        name: 'tiktok_slideshow.zip'
                                });

                                // =====================================================
                                // PAGINATION SYSTEM
                                // =====================================================
                                let currentPage = 0;
                                
                                // Tạo embed cho từng trang
                                const generateEmbed = (page) => {
                                        return new EmbedBuilder()
                                                .setColor("#00f2ea")
                                                .setTitle("📸 TikTok Image Slideshow")
                                                .setDescription(`**${title}**\n\n👤 **Tác giả:** ${authorName}\n\n📦 **File ZIP chứa tất cả ${downloadedImages.length} ảnh đã được đính kèm bên dưới!**`)
                                                .setImage(`attachment://current_image.jpg`)
                                                .setThumbnail(authorAvatar)
                                                .setFooter({ 
                                                        text: `Ảnh ${page + 1}/${downloadedImages.length} | Yêu cầu bởi ${interaction.user.username}`, 
                                                        iconURL: interaction.user.displayAvatarURL() 
                                                })
                                                .setTimestamp();
                                };

                                // Tạo buttons điều hướng
                                const generateButtons = (page) => {
                                        const row = new ActionRowBuilder();
                                        
                                        if (downloadedImages.length > 1) {
                                                row.addComponents(
                                                        new ButtonBuilder()
                                                                .setCustomId(`tiktok_prev_${interaction.id}`)
                                                                .setLabel("⬅️ Trước")
                                                                .setStyle(ButtonStyle.Primary)
                                                                .setDisabled(page === 0),
                                                        new ButtonBuilder()
                                                                .setCustomId(`tiktok_next_${interaction.id}`)
                                                                .setLabel("➡️ Sau")
                                                                .setStyle(ButtonStyle.Primary)
                                                                .setDisabled(page === downloadedImages.length - 1)
                                                );
                                        }
                                        
                                        return row;
                                };

                                // Tạo attachment cho ảnh hiện tại
                                const getCurrentAttachment = (page) => {
                                        return new AttachmentBuilder(downloadedImages[page].path, { 
                                                name: 'current_image.jpg' 
                                        });
                                };

                                // Gửi message đầu tiên
                                const message = await interaction.editReply({
                                        content: null,
                                        embeds: [generateEmbed(currentPage)],
                                        components: downloadedImages.length > 1 ? [generateButtons(currentPage)] : [],
                                        files: [getCurrentAttachment(currentPage), zipAttachment],
                                });

                                // Xử lý pagination (nếu có nhiều hơn 1 ảnh)
                                if (downloadedImages.length > 1) {
                                        const collector = message.createMessageComponentCollector({
                                                filter: (i) => i.customId.startsWith('tiktok_') && i.customId.endsWith(`_${interaction.id}`),
                                                time: 300000 // 5 phút
                                        });

                                        collector.on('collect', async (i) => {
                                                // Cập nhật trang hiện tại
                                                if (i.customId === `tiktok_prev_${interaction.id}`) {
                                                        currentPage = Math.max(0, currentPage - 1);
                                                } else if (i.customId === `tiktok_next_${interaction.id}`) {
                                                        currentPage = Math.min(downloadedImages.length - 1, currentPage + 1);
                                                }

                                                // Giữ lại file ZIP attachment
                                                const zipAttachmentFromMessage = message.attachments.find(a => a.name === 'tiktok_slideshow.zip');
                                                
                                                await i.update({
                                                        embeds: [generateEmbed(currentPage)],
                                                        components: [generateButtons(currentPage)],
                                                        files: [getCurrentAttachment(currentPage)],
                                                        attachments: zipAttachmentFromMessage ? [zipAttachmentFromMessage] : [],
                                                });
                                        });

                                        // Dọn dẹp khi hết thời gian
                                        collector.on('end', async () => {
                                                try {
                                                        await message.edit({ components: [] });
                                                } catch (error) {}
                                                
                                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                        });
                                } else {
                                        // Chỉ 1 ảnh - dọn dẹp sau 1 phút
                                        setTimeout(async () => {
                                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                        }, 60000);
                                }
                        } catch (error) {
                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                throw error;
                        }

                        return;
                } 
                
                // =====================================================
                // XỬ LÝ VIDEO
                // =====================================================
                else {
                        // ⚠️ QUAN TRỌNG: Chỉ dùng CDN URLs đã được decode (không dùng data.videoHD trực tiếp vì nó là JWT stream link)
                        // Nếu cdnUrls không có, decode lại để đảm bảo
                        const videoHD = cdnUrls.videoHD || (data.videoHD ? extractor.extractCDNUrl(data.videoHD) : null);
                        const videoSD = cdnUrls.videoSD || (data.videoSD ? extractor.extractCDNUrl(data.videoSD) : null);
                        const videoWatermark = cdnUrls.videoWatermark || (data.videoWatermark ? extractor.extractCDNUrl(data.videoWatermark) : null);

                        const videoUrl = videoHD || videoSD || videoWatermark;

                        if (!videoUrl) {
                                return interaction.editReply({
                                        content: "❌ Không tìm thấy link video. Vui lòng thử lại.",
                                });
                        }

                        const tmpDir = path.join(process.cwd(), 'tmp');
                        await fs.mkdir(tmpDir, { recursive: true });

                        const videoPath = path.join(tmpDir, `tiktok_${interaction.id}.mp4`);

                        try {
                                // =====================================================
                                // BƯỚC 1: DOWNLOAD VIDEO
                                // =====================================================
                                await interaction.editReply({
                                        content: `⏳ Đang tải video TikTok...`,
                                });

                                const progressDownloader = new TikTokDownloaderProgress();
                                await progressDownloader.downloadWithDiscordProgress(
                                        videoUrl,
                                        videoPath,
                                        interaction,
                                        videoHD ? 'video TikTok HD' : 'video TikTok SD'
                                );

                                // =====================================================
                                // BƯỚC 2: CONVERT SANG H.264/AAC
                                // =====================================================
                                await interaction.editReply({
                                        content: `⏳ Đang chuyển đổi video sang H.264/AAC... 0%`,
                                });

                                const converter = new VideoConverter();
                                let convertUpdatePercent = 0;
                                
                                await converter.convertInPlace(videoPath, async (percent) => {
                                        if (percent - convertUpdatePercent >= 5 || percent === 100) {
                                                convertUpdatePercent = percent;
                                                try {
                                                        await interaction.editReply({
                                                                content: `⏳ Đang chuyển đổi video sang H.264/AAC... ${percent}%`,
                                                        });
                                                } catch (error) {}
                                        }
                                });

                                const stats = await fs.stat(videoPath);
                                const fileSizeMB = stats.size / (1024 * 1024);

                                // =====================================================
                                // BƯỚC 3: TẠO DOWNLOAD TOKEN
                                // =====================================================
                                const tokenManager = getTokenManager();
                                const filename = `tiktok_${data.id || interaction.id}.mp4`;
                                
                                // Tạo token với file path (sẽ serve file local)
                                const token = tokenManager.createToken(videoPath, filename, 3600); // 1 giờ
                                
                                const downloadUrl = `${process.env.SERVER_URL}/download/${token}`;
                                
                                // Auto cleanup file sau 1 giờ
                                setTimeout(async () => {
                                        await cleanupFiles(videoPath);
                                }, 3600000);
                                
                                const videoEmbed = new EmbedBuilder()
                                        .setColor("#00f2ea")
                                        .setTitle("🎥 TikTok Video (H.264/AAC)")
                                        .setDescription(`**${title}**\n\n✅ **Video đã được convert sang H.264/AAC**\nClick button bên dưới để tải về máy!`)
                                        .addFields(
                                                { name: "👤 Tác giả", value: authorName, inline: true },
                                                { name: "📹 Chất lượng", value: videoHD ? "Full HD" : (videoSD ? "SD" : "Standard"), inline: true },
                                                { name: "💾 Kích thước", value: `${fileSizeMB.toFixed(1)}MB`, inline: true }
                                        )
                                        .setThumbnail(authorAvatar)
                                        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                        .setTimestamp();

                                const downloadButton = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setLabel(`📥 Tải video ${videoHD ? "HD" : "SD"} về máy`)
                                                .setURL(downloadUrl)
                                                .setStyle(ButtonStyle.Link)
                                );

                                return interaction.editReply({
                                        content: null,
                                        embeds: [videoEmbed],
                                        components: [downloadButton],
                                });

                        } catch (error) {
                                await cleanupFiles(videoPath);
                                
                                return interaction.editReply({
                                        content: "❌ Không thể xử lý video TikTok. Vui lòng thử lại sau.\n\n" +
                                                 "Chi tiết lỗi: " + error.message
                                });
                        }
                }
        } catch (error) {
                const errorMessage = {
                        content: "❌ Đã xảy ra lỗi khi xử lý video TikTok. Vui lòng thử lại sau hoặc kiểm tra link."
                };

                if (interaction.deferred || interaction.replied) {
                        return interaction.editReply(errorMessage);
                } else {
                        return interaction.reply({ ...errorMessage, ephemeral: true });
                }
        }
};
