/**
 * =====================================================
 * COMMAND: /TIKTOK (Tobyg74 v3 + TikWM Fallback + TmpFiles)
 * =====================================================
 * Ưu tiên lấy dữ liệu qua Tobyg74 (v3).
 * Nếu lỗi (Proxy/API/Invalid URL), tự động chuyển sang TikWM API.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Tiktok = require("@tobyg74/tiktok-api-dl");
const fs = require("fs").promises;
const path = require("path");
const archiver = require("archiver");
const axios = require("axios");
const FormData = require("form-data");

// =====================================================
// HELPER FUNCTIONS & TMPFILES INTEGRATION
// =====================================================

/**
 * Upload file trực tiếp lên TmpFiles.org
 */
async function uploadToTmpFiles(filePath) {
        try {
                console.log(`\n[LOG TMPFILES] 📤 Bắt đầu upload file lên TmpFiles: ${filePath}`);
                const formData = new FormData();
                formData.append("file", require("fs").createReadStream(filePath));

                const response = await axios.post("https://tmpfiles.org/api/v1/upload", formData, {
                        headers: {
                                ...formData.getHeaders(),
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                });

                if (response.data && response.data.status === "success") {
                        const pageUrl = response.data.data.url;
                        const directUrl = pageUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
                        console.log(`[LOG TMPFILES] ✅ Upload thành công! Link: ${directUrl}`);
                        return directUrl;
                } else {
                        throw new Error("Upload lên TmpFiles thất bại");
                }
        } catch (error) {
                console.error("[LOG ERROR - TMPFILES] ❌ Lỗi upload:", error.message);
                throw error;
        }
}

/**
 * Dọn dẹp các file tạm trong thư mục tmp
 */
async function cleanupFiles(...filePaths) {
        console.log("\n[LOG CLEANUP] 🧹 Bắt đầu dọn dẹp file tạm...");
        for (const filePath of filePaths) {
                try {
                        await fs.unlink(filePath);
                        console.log(`[LOG CLEANUP]  --> Đã xóa: ${filePath}`);
                } catch (error) {
                        console.error(`[LOG CLEANUP]  --> Không thể xóa ${filePath}:`, error.message);
                }
        }
}

/**
 * Tạo file ZIP từ danh sách ảnh
 */
async function createZipFromImages(imagePaths, outputPath) {
        return new Promise((resolve, reject) => {
                console.log(`\n[LOG ZIP] 📦 Bắt đầu nén ${imagePaths.length} ảnh vào ZIP...`);
                const output = require('fs').createWriteStream(outputPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', () => {
                        console.log(`[LOG ZIP] ✅ Hoàn tất nén ZIP! Dung lượng: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
                        resolve();
                });
                archive.on('error', (err) => reject(err));
                archive.pipe(output);

                imagePaths.forEach((imgPath, index) => {
                        archive.file(imgPath, { name: `image_${index + 1}.jpg` });
                });

                archive.finalize();
        });
}

/**
 * Tải file từ URL về thư mục tạm (có kiểm tra URL hợp lệ)
 */
async function downloadFile(fileUrl, outputPath) {
        if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.startsWith("http")) {
                throw new Error(`URL tải không hợp lệ: "${fileUrl}"`);
        }

        console.log(`[LOG DOWNLOAD] ⏳ Đang tải file từ URL: ${fileUrl}`);
        const writer = require('fs').createWriteStream(outputPath);
        const response = await axios({
                url: fileUrl,
                method: 'GET',
                responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                        console.log(`[LOG DOWNLOAD] ✅ Tải về thành công: ${outputPath}`);
                        resolve();
                });
                writer.on('error', reject);
        });
}

// =====================================================
// FETCHER 1: TOBYG74 (Chuyển sang Version v3)
// =====================================================
async function fetchViaTobyg74(url) {
        console.log("[LOG FETCH] 🔄 BƯỚC 1: Thử lấy dữ liệu qua Tobyg74 (v3)...");
        const result = await Tiktok.Downloader(url, { version: "v3" });

        if (!result || result.status !== "success") {
                throw new Error("Tobyg74 v3 trả về status !== success");
        }

        const data = result.result;
        const isImage = data.type === "image";
        
        let videoUrl = null;
        if (!isImage) {
                // Lấy URL video từ phản hồi của v3
                videoUrl = data.videoHD || data.video1 || data.video2 || data.videoWatermark || data.video || null;
                
                // Nếu URL không tồn tại hoặc không phải định dạng link HTTP/HTTPS -> coi như v3 lỗi để nhảy sang TikWM
                if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
                        throw new Error("Tobyg74 v3 không trả về URL video hợp lệ");
                }
        }

        return {
                source: "Tobyg74 (v3)",
                title: data.desc || data.description || "TikTok Content",
                authorName: data.author?.nickname || "Unknown",
                authorAvatar: data.author?.avatar || null,
                isImage: isImage,
                images: data.images || [],
                videoUrl: videoUrl
        };
}

// =====================================================
// FETCHER 2: TIKWM (Dự phòng khi Tobyg74 lỗi)
// =====================================================
async function fetchViaTikWM(url) {
        console.log("[LOG FETCH] ⚠️ BƯỚC 2: Tobyg74 lỗi -> Chuyển sang cào bằng TikWM API (Dự phòng)...");
        const response = await axios.post("https://www.tikwm.com/api/", new URLSearchParams({ url: url, hd: "1" }));
        const res = response.data;

        if (!res || res.code !== 0) {
                throw new Error("TikWM API thất bại hoặc code !== 0");
        }

        const data = res.data;
        const isImage = data.images && Array.isArray(data.images) && data.images.length > 0;

        return {
                source: "TikWM API (Dự phòng)",
                title: data.title || "TikTok Content",
                authorName: data.author?.nickname || "Unknown",
                authorAvatar: data.author?.avatar || null,
                isImage: isImage,
                images: data.images || [],
                videoUrl: data.hdplay || data.play || data.wmplay
        };
}

// =====================================================
// COMMAND DEFINITION
// =====================================================

module.exports.data = {
        name: "tiktok",
        description: "Tải video/slideshow TikTok không watermark (Auto Fallback v3/TikWM)",
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
                console.log("\n=========================================================");
                console.log(`[LOG COMMAND] 🚀 Nhận lệnh /tiktok từ: ${interaction.user.tag}`);
                console.log(`[LOG COMMAND] 🔗 Link: ${url}`);
                console.log("=========================================================");

                if (!url.includes("tiktok.com")) {
                        return interaction.reply({
                                content: "❌ Link không hợp lệ! Vui lòng cung cấp link TikTok hợp lệ.",
                                ephemeral: true,
                        });
                }

                await interaction.deferReply();

                // Lấy dữ liệu với cơ chế Fallback
                let tiktokData = null;

                try {
                        tiktokData = await fetchViaTobyg74(url);
                        console.log(`[LOG FETCH] ✅ Lấy dữ liệu thành công từ Nguồn: ${tiktokData.source}`);
                } catch (tobyg74Error) {
                        console.error(`[LOG FETCH ERROR] ❌ Tobyg74 v3 thất bại: ${tobyg74Error.message}`);
                        try {
                                tiktokData = await fetchViaTikWM(url);
                                console.log(`[LOG FETCH] ✅ Lấy dữ liệu thành công từ Nguồn: ${tiktokData.source}`);
                        } catch (tikwmError) {
                                console.error(`[LOG FETCH ERROR] ❌ Cả 2 phương thức đều thất bại! TikWM lỗi: ${tikwmError.message}`);
                                return interaction.editReply({
                                        content: "❌ Không thể lấy dữ liệu video từ cả 2 hệ thống. Vui lòng thử lại sau!",
                                });
                        }
                }

                const tmpDir = path.join(process.cwd(), 'tmp');
                await fs.mkdir(tmpDir, { recursive: true });

                // =====================================================
                // XỬ LÝ SLIDESHOW (ẢNH)
                // =====================================================
                if (tiktokData.isImage) {
                        let images = tiktokData.images;
                        console.log(`\n[LOG PROCESS] 🖼️ Định dạng: SLIDESHOW (${images.length} ảnh) [Nguồn: ${tiktokData.source}]`);

                        if (images.length === 0) {
                                return interaction.editReply({ content: "❌ Không tìm thấy ảnh trong bài đăng này." });
                        }

                        await interaction.editReply({ content: `⏳ Đang tải ${images.length} ảnh slideshow (${tiktokData.source})...` });

                        const downloadedPaths = [];
                        for (let i = 0; i < images.length; i++) {
                                const imgPath = path.join(tmpDir, `tiktok_${interaction.id}_img_${i + 1}.jpg`);
                                await downloadFile(images[i], imgPath);
                                downloadedPaths.push(imgPath);
                        }

                        const zipPath = path.join(tmpDir, `tiktok_${interaction.id}_slideshow.zip`);
                        await interaction.editReply({ content: "📦 Đang nén file ZIP..." });
                        await createZipFromImages(downloadedPaths, zipPath);

                        await interaction.editReply({ content: "🚀 Đang tải file ZIP lên TmpFiles..." });
                        const storageLink = await uploadToTmpFiles(zipPath);

                        const embed = new EmbedBuilder()
                                .setColor("#00f2ea")
                                .setTitle("📸 TikTok Image Slideshow")
                                .setDescription(`**${tiktokData.title}**\n\n👤 **Tác giả:** ${tiktokData.authorName}\n📦 **Tổng số ảnh:** ${images.length}\n⚙️ **Nguồn tải:** ${tiktokData.source}`)
                                .setThumbnail(tiktokData.authorAvatar)
                                .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                .setTimestamp();

                        const buttonRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setLabel("📥 Tải file ZIP (TmpFiles)")
                                        .setURL(storageLink)
                                        .setStyle(ButtonStyle.Link)
                        );

                        await interaction.editReply({
                                content: null,
                                embeds: [embed],
                                components: [buttonRow]
                        });

                        await cleanupFiles(...downloadedPaths, zipPath);
                        console.log("[LOG SUCCESS] 🎉 Hoàn tất xử lý Slideshow!");
                        return;
                }

                // =====================================================
                // XỬ LÝ VIDEO
                // =====================================================
                else {
                        console.log(`\n[LOG PROCESS] 🎥 Định dạng: VIDEO [Nguồn: ${tiktokData.source}]`);

                        await interaction.editReply({ content: `⏳ Đang tải video từ TikTok (${tiktokData.source})...` });

                        const videoPath = path.join(tmpDir, `tiktok_${interaction.id}.mp4`);
                        await downloadFile(tiktokData.videoUrl, videoPath);

                        await interaction.editReply({ content: "🚀 Đang tải video lên TmpFiles..." });
                        const storageLink = await uploadToTmpFiles(videoPath);

                        const videoEmbed = new EmbedBuilder()
                                .setColor("#00f2ea")
                                .setTitle("🎥 TikTok Video")
                                .setDescription(`**${tiktokData.title}**\n\n👤 **Tác giả:** ${tiktokData.authorName}\n⚙️ **Nguồn tải:** ${tiktokData.source}`)
                                .setThumbnail(tiktokData.authorAvatar)
                                .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                .setTimestamp();

                        const buttons = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setLabel("📥 Tải Video Trực Tiếp (TmpFiles)")
                                        .setURL(storageLink)
                                        .setStyle(ButtonStyle.Link)
                        );

                        await interaction.editReply({
                                content: null,
                                embeds: [videoEmbed],
                                components: [buttons],
                        });

                        await cleanupFiles(videoPath);
                        console.log("[LOG SUCCESS] 🎉 Hoàn tất xử lý Video!");
                        return;
                }
        } catch (error) {
                console.error("\n[CRITICAL ERROR] 💥 Lỗi không xác định trong execute /tiktok:", error);
                const errorMessage = {
                        content: "❌ Đã xảy ra lỗi trong quá trình xử lý hoặc tải file."
                };

                if (interaction.deferred || interaction.replied) {
                        return interaction.editReply(errorMessage);
                } else {
                        return interaction.reply({ ...errorMessage, ephemeral: true });
                }
        }
};

