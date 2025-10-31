const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const Tiktok = require("@tobyg74/tiktok-api-dl");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const archiver = require("archiver");

async function downloadFile(url, outputPath) {
        const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 60000,
        });
        
        const writer = require('fs').createWriteStream(outputPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
        });
}

async function cleanupFiles(...filePaths) {
        for (const filePath of filePaths) {
                try {
                        await fs.unlink(filePath);
                } catch (error) {
                }
        }
}

async function createZipFromImages(imagePaths, outputPath) {
        return new Promise((resolve, reject) => {
                const output = require('fs').createWriteStream(outputPath);
                const archive = archiver('zip', {
                        zlib: { level: 9 }
                });

                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));

                archive.pipe(output);

                imagePaths.forEach((imgPath, index) => {
                        archive.file(imgPath, { name: `image_${index + 1}.jpg` });
                });

                archive.finalize();
        });
}

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
                        
                        if (images.length === 0) {
                                return interaction.editReply({
                                        content: "❌ Không tìm thấy ảnh trong slideshow.",
                                });
                        }

                        await interaction.editReply({
                                content: `⏳ Đang tải ${images.length} ảnh...`,
                        });

                        const tmpDir = path.join(process.cwd(), 'tmp');
                        try {
                                await fs.mkdir(tmpDir, { recursive: true });
                        } catch (error) {
                        }

                        const downloadedImages = [];
                        const zipPath = path.join(tmpDir, `tiktok_${interaction.id}_images.zip`);
                        
                        try {
                                for (let i = 0; i < images.length; i++) {
                                        try {
                                                const imagePath = path.join(tmpDir, `tiktok_${interaction.id}_${i}.jpg`);
                                                await downloadFile(images[i], imagePath);
                                                downloadedImages.push({ path: imagePath, index: i });
                                        } catch (error) {
                                        }
                                }

                                if (downloadedImages.length === 0) {
                                        return interaction.editReply({
                                                content: "❌ Không thể tải ảnh. Vui lòng thử lại sau.",
                                        });
                                }

                                await interaction.editReply({
                                        content: `⏳ Đang tạo file ZIP chứa ${downloadedImages.length} ảnh...`,
                                });
                                
                                await createZipFromImages(downloadedImages.map(img => img.path), zipPath);
                                
                                const zipAttachment = new AttachmentBuilder(zipPath, {
                                        name: 'tiktok_slideshow.zip'
                                });

                                let currentPage = 0;
                                
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

                                const generateButtons = (page) => {
                                        const row = new ActionRowBuilder();
                                        
                                        if (downloadedImages.length > 1) {
                                                row.addComponents(
                                                        new ButtonBuilder()
                                                                .setCustomId(`tiktok_prev_${interaction.id}`)
                                                                .setLabel("⬅️ Trước")
                                                                .setStyle(ButtonStyle.Primary)
                                                                .setDisabled(page === 0)
                                                );
                                        }
                                        
                                        if (downloadedImages.length > 1) {
                                                row.addComponents(
                                                        new ButtonBuilder()
                                                                .setCustomId(`tiktok_next_${interaction.id}`)
                                                                .setLabel("➡️ Sau")
                                                                .setStyle(ButtonStyle.Primary)
                                                                .setDisabled(page === downloadedImages.length - 1)
                                                );
                                        }
                                        
                                        return row;
                                };

                                const getCurrentAttachment = (page) => {
                                        return new AttachmentBuilder(downloadedImages[page].path, { 
                                                name: 'current_image.jpg' 
                                        });
                                };

                                const message = await interaction.editReply({
                                        content: null,
                                        embeds: [generateEmbed(currentPage)],
                                        components: downloadedImages.length > 1 ? [generateButtons(currentPage)] : [],
                                        files: [getCurrentAttachment(currentPage), zipAttachment],
                                });

                                if (downloadedImages.length > 1) {
                                        const collector = message.createMessageComponentCollector({
                                                filter: (i) => i.customId.startsWith('tiktok_') && i.customId.endsWith(`_${interaction.id}`),
                                                time: 300000
                                        });

                                        collector.on('collect', async (i) => {
                                                if (i.customId === `tiktok_prev_${interaction.id}`) {
                                                        currentPage = Math.max(0, currentPage - 1);
                                                } else if (i.customId === `tiktok_next_${interaction.id}`) {
                                                        currentPage = Math.min(downloadedImages.length - 1, currentPage + 1);
                                                }

                                                const zipAttachmentFromMessage = message.attachments.find(a => a.name === 'tiktok_slideshow.zip');
                                                
                                                await i.update({
                                                        embeds: [generateEmbed(currentPage)],
                                                        components: [generateButtons(currentPage)],
                                                        files: [getCurrentAttachment(currentPage)],
                                                        attachments: zipAttachmentFromMessage ? [zipAttachmentFromMessage] : [],
                                                });
                                        });

                                        collector.on('end', async () => {
                                                try {
                                                        await message.edit({ components: [] });
                                                } catch (error) {
                                                }
                                                
                                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                        });
                                } else {
                                        setTimeout(async () => {
                                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                        }, 60000);
                                }
                        } catch (error) {
                                await cleanupFiles(...downloadedImages.map(img => img.path), zipPath);
                                throw error;
                        }

                        return;
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

                        await interaction.editReply({
                                content: `⏳ Đang tải video ${videoHD ? "HD" : "SD"}...`,
                        });

                        const tmpDir = path.join(process.cwd(), 'tmp');
                        try {
                                await fs.mkdir(tmpDir, { recursive: true });
                        } catch (error) {
                        }

                        const videoPath = path.join(tmpDir, `tiktok_${interaction.id}.mp4`);

                        try {
                                await downloadFile(videoUrl, videoPath);

                                const stats = await fs.stat(videoPath);
                                const fileSizeMB = stats.size / (1024 * 1024);

                                if (fileSizeMB > 25) {
                                        await cleanupFiles(videoPath);
                                        
                                        const videoEmbed = new EmbedBuilder()
                                                .setColor("#00f2ea")
                                                .setTitle("🎥 TikTok Video")
                                                .setDescription(`**${title}**\n\n⚠️ Video quá lớn để upload (${fileSizeMB.toFixed(1)}MB). Bạn có thể tải xuống qua link bên dưới.`)
                                                .addFields(
                                                        { name: "👤 Tác giả", value: authorName, inline: true },
                                                        { name: "📹 Chất lượng", value: videoHD ? "Full HD" : (videoSD ? "SD" : "Standard"), inline: true }
                                                )
                                                .setThumbnail(authorAvatar)
                                                .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                                .setTimestamp();

                                        const downloadButton = new ActionRowBuilder().addComponents(
                                                new ButtonBuilder()
                                                        .setLabel("📥 Tải Video " + (videoHD ? "HD" : "SD"))
                                                        .setURL(videoUrl)
                                                        .setStyle(ButtonStyle.Link)
                                        );

                                        return interaction.editReply({
                                                content: null,
                                                embeds: [videoEmbed],
                                                components: [downloadButton],
                                        });
                                }

                                const videoAttachment = new AttachmentBuilder(videoPath, {
                                        name: 'tiktok_video.mp4'
                                });

                                const videoEmbed = new EmbedBuilder()
                                        .setColor("#00f2ea")
                                        .setTitle("🎥 TikTok Video")
                                        .setDescription(`**${title}**`)
                                        .addFields(
                                                { name: "👤 Tác giả", value: authorName, inline: true },
                                                { name: "📹 Chất lượng", value: videoHD ? "Full HD" : (videoSD ? "SD" : "Standard"), inline: true },
                                                { name: "💾 Kích thước", value: `${fileSizeMB.toFixed(1)}MB`, inline: true }
                                        )
                                        .setThumbnail(authorAvatar)
                                        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                        .setTimestamp();

                                await interaction.editReply({
                                        content: null,
                                        embeds: [videoEmbed],
                                        files: [videoAttachment],
                                        components: [],
                                });

                                await cleanupFiles(videoPath);

                        } catch (error) {
                                await cleanupFiles(videoPath);
                                
                                const videoEmbed = new EmbedBuilder()
                                        .setColor("#00f2ea")
                                        .setTitle("🎥 TikTok Video")
                                        .setDescription(`**${title}**\n\n⚠️ Không thể xử lý video. Bạn có thể tải xuống qua link bên dưới.`)
                                        .addFields(
                                                { name: "👤 Tác giả", value: authorName, inline: true },
                                                { name: "📹 Chất lượng", value: videoHD ? "Full HD" : (videoSD ? "SD" : "Standard"), inline: true }
                                        )
                                        .setThumbnail(authorAvatar)
                                        .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                        .setTimestamp();

                                const downloadButton = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setLabel("📥 Tải Video " + (videoHD ? "HD" : "SD"))
                                                .setURL(videoUrl)
                                                .setStyle(ButtonStyle.Link)
                                );

                                return interaction.editReply({
                                        content: null,
                                        embeds: [videoEmbed],
                                        components: [downloadButton],
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
