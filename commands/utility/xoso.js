/**
 * =============================================================================
 * XỔ SỐ MIỀN NAM - DÒ VÉ SỐ TRÚNG THƯỞNG
 * =============================================================================
 * File: xoso.js
 * Mô tả: Command Discord bot để kiểm tra kết quả xổ số miền Nam từ minhngoc.net
 * Tính năng:
 *   - Xem kết quả xổ số theo tỉnh/thành
 *   - Dò vé số trúng thưởng
 *   - Kiểm tra thời gian chờ cho đến giờ quay số
 *   - Xem kết quả theo ngày cụ thể
 * 
 * API: https://www.minhngoc.net
 * Lưu ý: Thời gian chờ tối thiểu giữa các request: 5 giây (theo yêu cầu của minhngoc.net)
 * Giờ quay số: 16:15 - 16:35 (Múi giờ Việt Nam)
 * =============================================================================
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");

// Lưu trữ kết quả xổ số tạm thời (5 phút) để người dùng có thể dò vé
const activeResults = new Map();
const userActiveResults = new Map();

module.exports = {
        data: {
                name: "xoso",
                description: "Dò vé số trúng thưởng Miền Nam",
                type: 1,
                options: [
                        {
                                name: "tinh",
                                description: "Chọn tỉnh xổ số",
                                type: 3,
                                required: true,
                                choices: [
                                        { name: "TP. Hồ Chí Minh", value: "tp-hcm" },
                                        { name: "Đồng Tháp", value: "dong-thap" },
                                        { name: "Cà Mau", value: "ca-mau" },
                                        { name: "Bến Tre", value: "ben-tre" },
                                        { name: "Vũng Tàu", value: "vung-tau" },
                                        { name: "Bạc Liêu", value: "bac-lieu" },
                                        { name: "Đồng Nai", value: "dong-nai" },
                                        { name: "Cần Thơ", value: "can-tho" },
                                        { name: "Sóc Trăng", value: "soc-trang" },
                                        { name: "Tây Ninh", value: "tay-ninh" },
                                        { name: "An Giang", value: "an-giang" },
                                        { name: "Bình Thuận", value: "binh-thuan" },
                                        { name: "Vĩnh Long", value: "vinh-long" },
                                        { name: "Bình Dương", value: "binh-duong" },
                                        { name: "Trà Vinh", value: "tra-vinh" },
                                        { name: "Long An", value: "long-an" },
                                        { name: "Bình Phước", value: "binh-phuoc" },
                                        { name: "Hậu Giang", value: "hau-giang" },
                                        { name: "Tiền Giang", value: "tien-giang" },
                                        { name: "Kiên Giang", value: "kien-giang" },
                                        { name: "Đà Lạt", value: "da-lat" },
                                ],
                        },
                        {
                                name: "so_ve",
                                description: "Nhập số vé cần kiểm tra (5 hoặc 6 chữ số)",
                                type: 3,
                                required: false,
                        },
                        {
                                name: "ngay",
                                description: "Ngày quay số (DD-MM-YYYY, để trống = kỳ gần nhất)",
                                type: 3,
                                required: false,
                        },
                ],
                integration_types: [0, 1],
                contexts: [0, 1, 2],
        },

        /**
         * Hàm thực thi chính của command
         * @param {Object} interaction - Discord interaction object
         * @param {Object} lang - Đối tượng ngôn ngữ (không bắt buộc)
         */
        async execute({ interaction, lang }) {
                await interaction.deferReply();

                const tinh = interaction.options.getString("tinh");
                const soVe = interaction.options.getString("so_ve");
                const ngay = interaction.options.getString("ngay");

                try {
                        // Kiểm tra định dạng ngày (DD-MM-YYYY)
                        if (ngay && !this.isValidDate(ngay)) {
                                return interaction.editReply({
                                        content: "❌ Ngày không đúng định dạng! Vui lòng nhập: **DD-MM-YYYY** (ví dụ: 29-10-2025)",
                                });
                        }

                        // Lấy thời gian hiện tại theo múi giờ Việt Nam
                        const now = new Date();
                        const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
                        const currentHour = vnTime.getHours();
                        const currentMinute = vnTime.getMinutes();
                        const currentDay = vnTime.getDay(); // 0 = Chủ Nhật, 1 = Thứ Hai, ...
                        const currentTime = currentHour * 60 + currentMinute; // Tổng số phút từ 00:00
                        const lotteryTime = 16 * 60 + 15; // 16:15 = 975 phút
                        const lotteryEndTime = 16 * 60 + 35; // 16:35 = 995 phút

                        // Lấy lịch quay số của đài được chọn
                        const schedule = this.getLotterySchedule(tinh);

                        // ===== XỬ LÝ KHI NGƯỜI DÙNG NHẬP NGÀY CỤ THỂ =====
                        if (ngay) {
                                const [day, month, year] = ngay.split("-").map(Number);
                                const requestedDate = new Date(year, month - 1, day);
                                const requestedDay = requestedDate.getDay();
                                const todayDate = `${String(vnTime.getDate()).padStart(2, '0')}-${String(vnTime.getMonth() + 1).padStart(2, '0')}-${vnTime.getFullYear()}`;

                                // Kiểm tra xem ngày được chọn có phải là ngày đài quay số không
                                const isRequestedDayLotteryDay = schedule.includes(requestedDay);
                                if (!isRequestedDayLotteryDay) {
                                        const scheduleDays = schedule.map(d => this.getDayName(d)).join(", ");
                                        return interaction.editReply({
                                                content: `📅 **NGÀY KHÔNG QUAY SỐ**\n\n` +
                                                        `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                        `📆 **Ngày bạn chọn:** ${ngay} (${this.getDayName(requestedDay)})\n` +
                                                        `🎰 **Lịch quay:** ${scheduleDays}\n\n` +
                                                        `💡 **Lưu ý:** Đài này không quay vào ${this.getDayName(requestedDay)}!\n` +
                                                        `📌 Hãy chọn ngày phù hợp với lịch quay của đài.`,
                                        });
                                }

                                // Kiểm tra xem ngày được chọn có phải là ngày trong tương lai không
                                const vnTimeOnly = new Date(vnTime.getFullYear(), vnTime.getMonth(), vnTime.getDate());
                                const requestedDateOnly = new Date(year, month - 1, day);
                                
                                if (requestedDateOnly > vnTimeOnly) {
                                        // Ngày trong tương lai
                                        const scheduleDays = schedule.map(d => this.getDayName(d)).join(", ");
                                        return interaction.editReply({
                                                content: `📅 **NGÀY CHƯA TỚI KỲ QUAY**\n\n` +
                                                        `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                        `📆 **Ngày bạn chọn:** ${ngay} (${this.getDayName(requestedDay)})\n` +
                                                        `🎰 **Giờ quay:** 16:15 - 16:35\n` +
                                                        `📅 **Hôm nay:** ${todayDate}\n\n` +
                                                        `⏳ **Lưu ý:** Ngày này chưa diễn ra kỳ quay!\n` +
                                                        `💡 Vui lòng quay lại vào ngày ${ngay} sau 16h35 để xem kết quả.`,
                                        });
                                }

                                // Nếu ngày được chọn là hôm nay, kiểm tra thời gian
                                if (ngay === todayDate) {
                                        if (currentTime < lotteryTime) {
                                                // Tính thời gian chờ còn lại
                                                const timeUntil = lotteryTime - currentTime;
                                                const hoursLeft = Math.floor(timeUntil / 60);
                                                const minutesLeft = timeUntil % 60;

                                                return interaction.editReply({
                                                        content: `⏰ **CHƯA TỚI GIỜ QUAY SỐ**\n\n` +
                                                                `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                                `📆 **Ngày quay:** ${ngay} (${this.getDayName(requestedDay)})\n` +
                                                                `🎰 **Giờ quay:** 16:15 - 16:35\n` +
                                                                `⏱️ **Hiện tại:** ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n` +
                                                                `⏳ **Còn khoảng:** ${hoursLeft > 0 ? hoursLeft + ' giờ ' : ''}${minutesLeft} phút\n\n` +
                                                                `💡 Kết quả sẽ được cập nhật sau 16h35. Vui lòng quay lại sau!`,
                                                });
                                        } else if (currentTime >= lotteryTime && currentTime < lotteryEndTime) {
                                                return interaction.editReply({
                                                        content: `🎰 **ĐANG QUAY SỐ**\n\n` +
                                                                `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                                `📆 **Ngày quay:** ${ngay} (${this.getDayName(requestedDay)})\n` +
                                                                `🎬 **Giờ quay:** 16:15 - 16:35\n` +
                                                                `⏱️ **Hiện tại:** ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n\n` +
                                                                `⏳ **Trạng thái:** Đang tiến hành quay số...\n` +
                                                                `💡 Kết quả sẽ được cập nhật sau 16h35. Vui lòng quay lại sau vài phút!`,
                                                });
                                        }
                                }
                        } else {
                                // ===== XỬ LÝ KHI KHÔNG NHẬP NGÀY (XEM KỲ GẦN NHẤT) =====
                                const isLotteryDay = schedule.includes(currentDay);

                                // Kiểm tra hôm nay có quay số không
                                if (!isLotteryDay) {
                                        // Tìm kỳ quay gần nhất trước đó
                                        const previousDate = this.getPreviousLotteryDate(tinh, vnTime);
                                        
                                        if (previousDate) {
                                                // Fetch kết quả của kỳ quay gần nhất
                                                const url = `https://www.minhngoc.net.vn/ket-qua-xo-so/${previousDate}.html`;
                                                const { data: html } = await axios.get(url, {
                                                        headers: {
                                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                                        },
                                                });

                                                const $ = cheerio.load(html);
                                                const results = this.parseResultsWithDate($, tinh, previousDate);

                                                if (!results || results.prizes.length === 0) {
                                                        const nextLottery = this.getNextLotteryDay(tinh, currentDay);
                                                        const scheduleDays = schedule.map(d => this.getDayName(d)).join(", ");

                                                        return interaction.editReply({
                                                                content: `📅 **HÔM NAY KHÔNG QUAY SỐ**\n\n` +
                                                                        `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                                        `📆 **Hôm nay:** ${this.getDayName(currentDay)}\n` +
                                                                        `🎰 **Lịch quay:** ${scheduleDays}\n\n` +
                                                                        (nextLottery ? `⏳ **Kỳ tiếp theo:** ${this.getDayName(nextLottery.day)} (${nextLottery.daysUntil} ngày nữa)\n\n` : '') +
                                                                        `💡 Không tìm thấy kết quả kỳ gần nhất. Vui lòng thử lại sau.`,
                                                        });
                                                }

                                                // Lưu kết quả và hiển thị
                                                const resultId = `${interaction.user.id}_${Date.now()}`;
                                                activeResults.set(resultId, results);
                                                userActiveResults.set(interaction.user.id, results);
                                                setTimeout(() => {
                                                        activeResults.delete(resultId);
                                                        userActiveResults.delete(interaction.user.id);
                                                }, 300000);

                                                const embeds = [this.createResultEmbed(results, lang, interaction, 0)];
                                                
                                                if (soVe) {
                                                        const checkEmbed = this.createCheckEmbed(results, soVe, lang, interaction);
                                                        embeds.push(checkEmbed);
                                                }

                                                const prizesPerPage = 8;
                                                const totalPages = Math.ceil(results.prizes.length / prizesPerPage);
                                                const components = this.createComponents(0, totalPages, resultId);

                                                return await interaction.editReply({
                                                        content: `💡 **Hôm nay không quay số.** Đây là kết quả kỳ gần nhất:`,
                                                        embeds: embeds,
                                                        components: components,
                                                });
                                        }
                                }

                                // Kiểm tra thời gian hiện tại so với giờ quay số
                                if (currentTime < lotteryTime) {
                                        const timeUntil = lotteryTime - currentTime;
                                        const hoursLeft = Math.floor(timeUntil / 60);
                                        const minutesLeft = timeUntil % 60;

                                        return interaction.editReply({
                                                content: `⏰ **CHƯA TỚI GIỜ QUAY SỐ**\n\n` +
                                                        `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                                        `📆 **Hôm nay:** ${this.getDayName(currentDay)} (Có quay số)\n` +
                                                        `🎰 **Giờ quay:** 16:15 - 16:35\n` +
                                                        `⏱️ **Hiện tại:** ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}**\n` +
                                                        `⏳ **Còn khoảng:** ${hoursLeft > 0 ? hoursLeft + ' giờ ' : ''}${minutesLeft} phút\n\n` +
                                                        `💡 Kết quả sẽ được cập nhật sau 16h35. Vui lòng quay lại sau!`,
                                        });
                        
                } else if (currentTime >= lotteryTime && currentTime < lotteryEndTime) {
                        return interaction.editReply({
                                content: `🎰 **ĐANG QUAY SỐ**\n\n` +
                                        `🏛️ **Đài:** ${this.getProvinceName(tinh)}\n` +
                                        `📆 **Hôm nay:** ${this.getDayName(currentDay)} (Có quay số)\n` +
                                        `🎬 **Giờ quay:** 16:15 - 16:35\n` +
                                        `⏱️ **Hiện tại:** ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n\n` +
                                        `⏳ **Trạng thái:** Đang tiến hành quay số...\n` +
                                        `💡 Kết quả sẽ được cập nhật sau 16h35. Vui lòng quay lại sau vài phút!`,
                        });
                }
                }

                        // ===== LẤY KẾT QUẢ XỔ SỐ TỪ MINHNGOC.NET =====
                        const url = ngay 
                                ? `https://www.minhngoc.net.vn/ket-qua-xo-so/${ngay}.html`
                                : `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam/${tinh}.html`;

                        // Gửi request với User-Agent để tránh bị chặn
                        const { data: html } = await axios.get(url, {
                                headers: {
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                },
                        });

                        // Parse HTML và lấy kết quả
                        const $ = cheerio.load(html);
                        const results = ngay 
                                ? this.parseResultsWithDate($, tinh, ngay)
                                : this.parseLatestResults($, tinh);

                        // Kiểm tra xem có kết quả không
                        if (!results || results.prizes.length === 0) {
                                return interaction.editReply({
                                        content: ngay 
                                                ? `❌ Không tìm thấy kết quả cho **${this.getProvinceName(tinh)}** ngày **${ngay}**\n\n💡 Đài này có thể không quay vào ngày này. Thử bỏ trống ngày để xem kỳ gần nhất!`
                                                : `❌ Không tìm thấy kết quả cho **${this.getProvinceName(tinh)}**\n\nVui lòng thử lại sau.`,
                                });
                        }

                        // Lưu kết quả vào Map để người dùng có thể dò vé sau (timeout: 5 phút)
                        const resultId = `${interaction.user.id}_${Date.now()}`;
                        activeResults.set(resultId, results);
                        userActiveResults.set(interaction.user.id, results);
                        setTimeout(() => {
                                activeResults.delete(resultId);
                                userActiveResults.delete(interaction.user.id);
                        }, 300000); // 5 phút = 300000ms

                        // Tạo embed hiển thị kết quả
                        const embeds = [this.createResultEmbed(results, lang, interaction, 0)];
                        
                        // Nếu người dùng nhập số vé, thêm embed kiểm tra vé
                        if (soVe) {
                                const checkEmbed = this.createCheckEmbed(results, soVe, lang, interaction);
                                embeds.push(checkEmbed);
                        }

                        // Phân trang kết quả (mỗi trang 8 giải)
                        const prizesPerPage = 8;
                        const totalPages = Math.ceil(results.prizes.length / prizesPerPage);
                        let currentPage = 0;

                        // Tạo các nút điều hướng và dò vé
                        const components = this.createComponents(currentPage, totalPages, resultId);

                        await interaction.editReply({
                                embeds: embeds,
                                components: components,
                        });

                } catch (error) {
                        console.error("Lỗi khi lấy kết quả xổ số:", error.message);
                        await interaction.editReply({
                                content: "❌ Có lỗi xảy ra khi lấy kết quả xổ số. Vui lòng thử lại sau.",
                        });
                }
        },

        /**
         * Tạo các nút điều hướng (Trước, Sau, Dò Vé)
         * @param {number} currentPage - Trang hiện tại
         * @param {number} totalPages - Tổng số trang
         * @param {string} resultId - ID kết quả
         * @returns {Array} Mảng các ActionRow chứa các nút
         */
        createComponents(currentPage, totalPages, resultId) {
                return [
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId("B_xoso_prev")
                                        .setLabel("◀ Trước")
                                        .setStyle(ButtonStyle.Primary)
                                        .setDisabled(currentPage === 0),
                                new ButtonBuilder()
                                        .setCustomId("xoso_page")
                                        .setLabel(`Trang ${currentPage + 1}/${totalPages}`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(true),
                                new ButtonBuilder()
                                        .setCustomId("B_xoso_next")
                                        .setLabel("Sau ▶")
                                        .setStyle(ButtonStyle.Primary)
                                        .setDisabled(currentPage === totalPages - 1),
                                new ButtonBuilder()
                                        .setCustomId("B_xoso_check")
                                        .setLabel("🎫 Dò Vé")
                                        .setStyle(ButtonStyle.Success)
                        )
                ];
        },

        /**
         * Lấy emoji tương ứng với từng loại giải
         * @param {string} prizeName - Tên giải thưởng
         * @returns {string} Emoji tương ứng
         */
        getPrizeEmoji(prizeName) {
                const name = prizeName.toLowerCase();
                if (name.includes("đặc biệt") || name.includes("đb")) return "🏆";
                if (name.includes("nhất") || name.includes("g1")) return "🥇";
                if (name.includes("nhì") || name.includes("g2")) return "🥈";
                if (name.includes("ba") || name.includes("g3")) return "🥉";
                if (name.includes("tư") || name.includes("g4")) return "🎖️";
                if (name.includes("năm") || name.includes("g5")) return "🏅";
                if (name.includes("sáu") || name.includes("g6")) return "🎗️";
                if (name.includes("bảy") || name.includes("g7")) return "🎀";
                if (name.includes("8") || name.includes("tám")) return "🎁";
                return "🎟️";
        },

        /**
         * Tạo embed hiển thị kết quả xổ số
         * @param {Object} results - Kết quả xổ số
         * @param {Object} lang - Đối tượng ngôn ngữ
         * @param {Object} interaction - Discord interaction
         * @param {number} page - Trang hiện tại
         * @returns {EmbedBuilder} Discord embed
         */
        createResultEmbed(results, lang, interaction, page) {
                const prizesPerPage = 8;
                const start = page * prizesPerPage;
                const end = start + prizesPerPage;
                const chunk = results.prizes.slice(start, end);
                const totalPages = Math.ceil(results.prizes.length / prizesPerPage);

                let pageText = "";
                chunk.forEach((prize) => {
                        const emoji = this.getPrizeEmoji(prize.name);
                        pageText += `${emoji} **${prize.name}:** ${prize.numbers.join(", ")}\n`;
                });

                // Tìm mã tỉnh từ tên tỉnh
                let provinceCode = "";
                const tinhMap = {
                        "TP. HCM": "tp-hcm",
                        "Đồng Tháp": "dong-thap",
                        "Cà Mau": "ca-mau",
                        "Bến Tre": "ben-tre",
                        "Vũng Tàu": "vung-tau",
                        "Bạc Liêu": "bac-lieu",
                        "Đồng Nai": "dong-nai",
                        "Cần Thơ": "can-tho",
                        "Sóc Trăng": "soc-trang",
                        "Tây Ninh": "tay-ninh",
                        "An Giang": "an-giang",
                        "Bình Thuận": "binh-thuan",
                        "Vĩnh Long": "vinh-long",
                        "Bình Dương": "binh-duong",
                        "Trà Vinh": "tra-vinh",
                        "Long An": "long-an",
                        "Bình Phước": "binh-phuoc",
                        "Hậu Giang": "hau-giang",
                        "Tiền Giang": "tien-giang",
                        "Kiên Giang": "kien-giang",
                        "Đà Lạt": "da-lat",
                };
                provinceCode = tinhMap[results.province] || "tp-hcm";

                const embed = new EmbedBuilder()
                        .setColor(lang?.color || "#FFD700")
                        .setTitle(`🎰 KẾT QUẢ XỔ SỐ MIỀN NAM`)
                        .setDescription(`**🏛️ Đài:** ${results.province}\n**📅 Ngày quay:** ${results.date}`)
                        .addFields({
                                name: `📋 Kết quả chi tiết (Trang ${page + 1}/${totalPages})`,
                                value: pageText || "Không có dữ liệu",
                                inline: false,
                        })
                        .setTimestamp()
                        .setFooter({
                                text: `${lang?.until?.requestBy || "Yêu cầu bởi"} ${interaction.user.username} | xoso|${page + 1}/${totalPages}|uid=${interaction.user.id}|tinh=${provinceCode}|ngay=${results.date}`,
                                iconURL: interaction.user.displayAvatarURL({ size: 1024 }),
                        });

                return embed;
        },

        /**
         * Tạo embed hiển thị kết quả kiểm tra vé số
         * @param {Object} results - Kết quả xổ số
         * @param {string} ticketNumber - Số vé cần kiểm tra
         * @param {Object} lang - Đối tượng ngôn ngữ
         * @param {Object} interaction - Discord interaction
         * @returns {EmbedBuilder} Discord embed
         */
        createCheckEmbed(results, ticketNumber, lang, interaction) {
                const checkResult = this.checkTicket(results, ticketNumber);
                
                const embed = new EmbedBuilder()
                        .setColor(checkResult.won ? "#00FF00" : "#FF0000")
                        .setTimestamp();

                if (checkResult.won) {
                        embed
                                .setTitle("🎉 CHÚC MỪNG! VÉ SỐ TRÚNG THƯỞNG")
                                .setDescription("Bạn đã trúng giải! Hãy đến đại lý để nhận thưởng!")
                                .addFields(
                                        { name: "🎫 Số vé", value: `\`${ticketNumber}\``, inline: true },
                                        { name: "🏆 Giải thưởng", value: checkResult.prize, inline: true },
                                        { name: "🎯 Số trúng", value: checkResult.winningNumber, inline: false }
                                );
                } else {
                        embed
                                .setTitle("😢 CHƯA TRÚNG THƯỞNG")
                                .setDescription("Số vé chưa trúng giải nào. Chúc bạn may mắn lần sau!")
                                .addFields({
                                        name: "🎫 Số vé đã kiểm tra",
                                        value: `\`${ticketNumber}\``,
                                        inline: false
                                });
                }

                return embed;
        },

        /**
         * Kiểm tra định dạng ngày hợp lệ (DD-MM-YYYY)
         * @param {string} dateString - Chuỗi ngày cần kiểm tra
         * @returns {boolean} True nếu hợp lệ, False nếu không hợp lệ
         */
        isValidDate(dateString) {
                const regex = /^\d{2}-\d{2}-\d{4}$/;
                if (!regex.test(dateString)) return false;

                const [day, month, year] = dateString.split("-").map(Number);
                const date = new Date(year, month - 1, day);
                
                return (
                        date.getFullYear() === year &&
                        date.getMonth() === month - 1 &&
                        date.getDate() === day
                );
        },

        /**
         * Chuyển mã tỉnh thành tên đầy đủ
         * @param {string} province - Mã tỉnh (vd: "can-tho")
         * @returns {string} Tên tỉnh đầy đủ (vd: "Cần Thơ")
         */
        getProvinceName(province) {
                const tinhMap = {
                        "tp-hcm": "TP. HCM",
                        "dong-thap": "Đồng Tháp",
                        "ca-mau": "Cà Mau",
                        "ben-tre": "Bến Tre",
                        "vung-tau": "Vũng Tàu",
                        "bac-lieu": "Bạc Liêu",
                        "dong-nai": "Đồng Nai",
                        "can-tho": "Cần Thơ",
                        "soc-trang": "Sóc Trăng",
                        "tay-ninh": "Tây Ninh",
                        "an-giang": "An Giang",
                        "binh-thuan": "Bình Thuận",
                        "vinh-long": "Vĩnh Long",
                        "binh-duong": "Bình Dương",
                        "tra-vinh": "Trà Vinh",
                        "long-an": "Long An",
                        "binh-phuoc": "Bình Phước",
                        "hau-giang": "Hậu Giang",
                        "tien-giang": "Tiền Giang",
                        "kien-giang": "Kiên Giang",
                        "da-lat": "Đà Lạt",
                };
                return tinhMap[province] || province;
        },

        /**
         * Lấy lịch quay số của từng đài (ngày nào trong tuần quay số)
         * @param {string} province - Mã tỉnh
         * @returns {Array<number>} Mảng các ngày quay số (0=CN, 1=T2, 2=T3, ...)
         */
        getLotterySchedule(province) {
                const scheduleMap = {
                        "tp-hcm": [1, 6],           // Thứ Hai, Thứ Bảy
                        "dong-thap": [1],           // Thứ Hai
                        "ca-mau": [1],              // Thứ Hai
                        "ben-tre": [2],             // Thứ Ba
                        "vung-tau": [2],            // Thứ Ba
                        "bac-lieu": [2],            // Thứ Ba
                        "dong-nai": [3],            // Thứ Tư
                        "can-tho": [3],             // Thứ Tư
                        "soc-trang": [3],           // Thứ Tư
                        "tay-ninh": [4],            // Thứ Năm
                        "an-giang": [4],            // Thứ Năm
                        "binh-thuan": [4],          // Thứ Năm
                        "vinh-long": [5],           // Thứ Sáu
                        "binh-duong": [5],          // Thứ Sáu
                        "tra-vinh": [5],            // Thứ Sáu
                        "long-an": [6],             // Thứ Bảy
                        "binh-phuoc": [6],          // Thứ Bảy
                        "hau-giang": [6],           // Thứ Bảy
                        "tien-giang": [0],          // Chủ Nhật
                        "kien-giang": [0],          // Chủ Nhật
                        "da-lat": [0],              // Chủ Nhật
                };
                return scheduleMap[province] || [];
        },

        /**
         * Chuyển số ngày thành tên ngày tiếng Việt
         * @param {number} dayNumber - Số ngày (0=CN, 1=T2, ...)
         * @returns {string} Tên ngày tiếng Việt
         */
        getDayName(dayNumber) {
                const dayNames = {
                        0: "Chủ Nhật",
                        1: "Thứ Hai",
                        2: "Thứ Ba",
                        3: "Thứ Tư",
                        4: "Thứ Năm",
                        5: "Thứ Sáu",
                        6: "Thứ Bảy",
                };
                return dayNames[dayNumber] || "";
        },

        /**
         * Tìm ngày quay số tiếp theo của đài
         * @param {string} province - Mã tỉnh
         * @param {number} currentDay - Ngày hiện tại (0-6)
         * @returns {Object|null} {day: số ngày, daysUntil: số ngày chờ}
         */
        getNextLotteryDay(province, currentDay) {
                const schedule = this.getLotterySchedule(province);
                if (schedule.length === 0) return null;

                // Tìm ngày quay số gần nhất trong 7 ngày tới
                for (let i = 1; i <= 7; i++) {
                        const nextDay = (currentDay + i) % 7;
                        if (schedule.includes(nextDay)) {
                                return { day: nextDay, daysUntil: i };
                        }
                }
                return null;
        },

        /**
         * Tìm ngày quay số gần nhất trước đó của đài
         * @param {string} province - Mã tỉnh
         * @param {Date} currentDate - Ngày hiện tại
         * @returns {string|null} Ngày quay gần nhất (DD-MM-YYYY)
         */
        getPreviousLotteryDate(province, currentDate) {
                const schedule = this.getLotterySchedule(province);
                if (schedule.length === 0) return null;

                // Lùi lại tối đa 7 ngày để tìm ngày quay gần nhất
                for (let i = 1; i <= 7; i++) {
                        const prevDate = new Date(currentDate);
                        prevDate.setDate(prevDate.getDate() - i);
                        const prevDay = prevDate.getDay();
                        
                        if (schedule.includes(prevDay)) {
                                const day = String(prevDate.getDate()).padStart(2, '0');
                                const month = String(prevDate.getMonth() + 1).padStart(2, '0');
                                const year = prevDate.getFullYear();
                                return `${day}-${month}-${year}`;
                        }
                }
                return null;
        },

        /**
         * Parse kết quả xổ số gần nhất (không nhập ngày)
         * @param {Object} $ - Cheerio object
         * @param {string} province - Mã tỉnh
         * @returns {Object} Kết quả xổ số {province, date, prizes}
         */
        parseLatestResults($, province) {
                const results = {
                        province: this.getProvinceName(province),
                        date: "",
                        prizes: [],
                };

                // Tìm ngày trong HTML
                let dateText = $("div.ngay a").first().text().trim();
                if (!dateText) {
                        dateText = $("div.title_kq strong").first().text().trim();
                }
                
                if (dateText) {
                        const match = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                        if (match) {
                                const [, day, month, year] = match;
                                results.date = `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
                        }
                }

                // Nếu không tìm thấy ngày, dùng ngày hôm nay
                if (!results.date) {
                        const now = new Date();
                        results.date = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
                }

                // Parse bảng kết quả
                const table = $("table.box_kqxs_content").first();
                if (table.length === 0) return results;

                table.find("tr").each((index, row) => {
                        const cells = $(row).find("td");
                        if (cells.length >= 2) {
                                const prizeName = $(cells[0]).text().trim();
                                const prizeValues = [];

                                // Lấy tất cả số trong giải
                                $(cells[1])
                                        .find("div")
                                        .each((di, div) => {
                                                const val = $(div).text().trim();
                                                if (val && /^\d+$/.test(val)) {
                                                        prizeValues.push(val);
                                                }
                                        });

                                if (prizeName && prizeValues.length > 0) {
                                        results.prizes.push({
                                                name: prizeName,
                                                numbers: prizeValues,
                                        });
                                }
                        }
                });

                return results;
        },

        /**
         * Parse kết quả xổ số theo ngày cụ thể
         * @param {Object} $ - Cheerio object
         * @param {string} province - Mã tỉnh
         * @param {string} targetDate - Ngày cần tìm (DD-MM-YYYY)
         * @returns {Object} Kết quả xổ số {province, date, prizes}
         */
        parseResultsWithDate($, province, targetDate) {
                const results = {
                        province: this.getProvinceName(province),
                        date: targetDate,
                        prizes: [],
                };

                const targetProvinceLower = this.getProvinceName(province).toLowerCase();
                
                // Tìm trong table.bkqmiennam (cấu trúc mới)
                $("table.bkqmiennam").each((index, table) => {
                        const cells = $(table).find("td");
                        
                        // Tìm cell chứa tên tỉnh
                        cells.each((i, cell) => {
                                const cellClass = $(cell).attr("class");
                                const cellText = $(cell).text().trim().toLowerCase();
                                
                                // Kiểm tra xem có phải cell tên tỉnh không
                                if (cellClass === "tinh" && cellText === targetProvinceLower) {
                                        // Tìm các giải thưởng liền kề
                                        const prizes = {
                                                "Giải 8": [],
                                                "Giải 7": [],
                                                "Giải 6": [],
                                                "Giải 5": [],
                                                "Giải 4": [],
                                                "Giải 3": [],
                                                "Giải nhì": [],
                                                "Giải nhất": [],
                                                "Giải ĐB": [],
                                        };
                                        
                                        // Parse các cell giải thưởng sau cell tên tỉnh
                                        for (let j = i + 1; j < Math.min(i + 20, cells.length); j++) {
                                                const prizeCell = $(cells[j]);
                                                const prizeClass = prizeCell.attr("class");
                                                const prizeText = prizeCell.text().trim();
                                                
                                                if (prizeClass === "giai8") {
                                                        prizes["Giải 8"] = this.splitPrizeNumbers(prizeText, 2);
                                                } else if (prizeClass === "giai7") {
                                                        prizes["Giải 7"] = this.splitPrizeNumbers(prizeText, 3);
                                                } else if (prizeClass === "giai6") {
                                                        prizes["Giải 6"] = this.splitPrizeNumbers(prizeText, 4);
                                                } else if (prizeClass === "giai5") {
                                                        prizes["Giải 5"] = this.splitPrizeNumbers(prizeText, 4);
                                                } else if (prizeClass === "giai4") {
                                                        prizes["Giải 4"] = this.splitPrizeNumbers(prizeText, 5);
                                                } else if (prizeClass === "giai3") {
                                                        prizes["Giải 3"] = this.splitPrizeNumbers(prizeText, 5);
                                                } else if (prizeClass === "giai2") {
                                                        prizes["Giải nhì"] = this.splitPrizeNumbers(prizeText, 5);
                                                } else if (prizeClass === "giai1") {
                                                        prizes["Giải nhất"] = this.splitPrizeNumbers(prizeText, 5);
                                                } else if (prizeClass === "giaidb") {
                                                        prizes["Giải ĐB"] = [prizeText];
                                                } else if (prizeClass === "tinh") {
                                                        // Đã đến tỉnh tiếp theo, dừng lại
                                                        break;
                                                }
                                        }
                                        
                                        // Thêm các giải vào kết quả (theo thứ tự ngược)
                                        if (prizes["Giải ĐB"].length > 0) results.prizes.push({name: "Giải ĐB", numbers: prizes["Giải ĐB"]});
                                        if (prizes["Giải nhất"].length > 0) results.prizes.push({name: "Giải nhất", numbers: prizes["Giải nhất"]});
                                        if (prizes["Giải nhì"].length > 0) results.prizes.push({name: "Giải nhì", numbers: prizes["Giải nhì"]});
                                        if (prizes["Giải 3"].length > 0) results.prizes.push({name: "Giải 3", numbers: prizes["Giải 3"]});
                                        if (prizes["Giải 4"].length > 0) results.prizes.push({name: "Giải 4", numbers: prizes["Giải 4"]});
                                        if (prizes["Giải 5"].length > 0) results.prizes.push({name: "Giải 5", numbers: prizes["Giải 5"]});
                                        if (prizes["Giải 6"].length > 0) results.prizes.push({name: "Giải 6", numbers: prizes["Giải 6"]});
                                        if (prizes["Giải 7"].length > 0) results.prizes.push({name: "Giải 7", numbers: prizes["Giải 7"]});
                                        if (prizes["Giải 8"].length > 0) results.prizes.push({name: "Giải 8", numbers: prizes["Giải 8"]});
                                        
                                        return false; // Dừng vòng lặp
                                }
                        });
                });

                return results;
        },
        
        /**
         * Tách chuỗi số thành mảng các số với độ dài cụ thể
         * @param {string} text - Chuỗi số cần tách
         * @param {number} length - Độ dài mỗi số
         * @returns {Array} Mảng các số
         */
        splitPrizeNumbers(text, length) {
                if (!text || text.length === 0) return [];
                
                const numbers = [];
                let currentPos = 0;
                
                while (currentPos < text.length) {
                        const num = text.substring(currentPos, currentPos + length);
                        if (num.length === length && /^\d+$/.test(num)) {
                                numbers.push(num);
                        }
                        currentPos += length;
                }
                
                return numbers;
        },

        /**
         * Kiểm tra vé số có trúng thưởng không
         * Logic kiểm tra:
         * 1. Trùng chính xác với bất kỳ giải nào
         * 2. Trùng 5 số cuối với giải Đặc Biệt (Giải An Ủi)
         * 3. Sai 1 số (không phải số đầu) với giải Đặc Biệt (Giải Khuyến Khích)
         * 4. Trùng số cuối với các giải khác
         * 5. Trùng 2 số cuối với các giải khác
         * 
         * @param {Object} results - Kết quả xổ số
         * @param {string} ticketNumber - Số vé cần kiểm tra
         * @returns {Object} {won: boolean, prize: string, winningNumber: string}
         */
        checkTicket(results, ticketNumber) {
                const ticket = ticketNumber.replace(/\s/g, ""); // Xóa khoảng trắng

                // Tìm giải Đặc Biệt
                let specialPrize = null;
                for (const prize of results.prizes) {
                        const prizeName = prize.name.toLowerCase();
                        if (prizeName.includes("đặc biệt") || prizeName.includes("db") || prizeName.includes("đb")) {
                                if (prize.numbers.length > 0) {
                                        specialPrize = prize.numbers[0];
                                        break;
                                }
                        }
                }

                // Kiểm tra trùng chính xác với bất kỳ giải nào
                for (const prize of results.prizes) {
                        for (const number of prize.numbers) {
                                if (number === ticket) {
                                        return {
                                                won: true,
                                                prize: prize.name,
                                                winningNumber: number,
                                        };
                                }
                        }
                }

                // Kiểm tra Giải An Ủi (trùng 5 số cuối với giải ĐB)
                if (specialPrize && specialPrize.length >= 5) {
                        const last5Digits = specialPrize.slice(-5);
                        const ticket5Last = ticket.slice(-5);
                        
                        // Vé 5 số trùng đúng 5 số cuối ĐB
                        if (ticket.length === 5 && ticket === last5Digits) {
                                return {
                                        won: true,
                                        prize: "Giải 5 chữ số - An Ủi (50.000.000đ)",
                                        winningNumber: last5Digits + " (từ giải ĐB: " + specialPrize + ")",
                                };
                        }
                        
                        // Vé 6 số trùng 5 số cuối với ĐB
                        if (ticket.length === 6 && ticket5Last === last5Digits) {
                                return {
                                        won: true,
                                        prize: "Giải 5 chữ số - An Ủi (50.000.000đ)",
                                        winningNumber: ticket + " (trùng 5 số cuối với ĐB: " + specialPrize + ")",
                                };
                        }
                }

                // Kiểm tra Giải Khuyến Khích (sai 1 số không phải số đầu so với ĐB)
                if (specialPrize && ticket.length === specialPrize.length && ticket.length === 6) {
                        let diffCount = 0;
                        let diffPosition = -1;

                        for (let i = 0; i < ticket.length; i++) {
                                if (ticket[i] !== specialPrize[i]) {
                                        diffCount++;
                                        diffPosition = i;
                                }
                        }

                        // Sai đúng 1 số và không phải số đầu tiên
                        if (diffCount === 1 && diffPosition !== 0) {
                                return {
                                        won: true,
                                        prize: "Giải Khuyến Khích (6.000.000đ)",
                                        winningNumber: ticket + " (sai 1 số vị trí " + (diffPosition + 1) + " so với ĐB: " + specialPrize + ")",
                                };
                        }
                }

                // Kiểm tra trùng số cuối với các giải khác (bỏ qua ĐB và Khuyến Khích)
                for (const prize of results.prizes) {
                        const prizeLower = prize.name.toLowerCase();
                        if (prizeLower.includes("khuyến khích") || 
                            prizeLower.includes("đặc biệt") || 
                            prizeLower.includes("db") ||
                            prizeLower.includes("đb")) {
                                continue;
                        }
                        
                        for (const number of prize.numbers) {
                                // Bỏ qua số trùng với ĐB
                                if (specialPrize && number === specialPrize) {
                                        continue;
                                }
                                
                                const numberLength = number.length;
                                const ticketLast = ticket.slice(-numberLength);
                                
                                // Trùng số cuối
                                if (ticketLast === number) {
                                        return {
                                                won: true,
                                                prize: prize.name,
                                                winningNumber: number,
                                        };
                                }
                        }
                }
                
                // Kiểm tra trùng 2 số cuối (giải khác)
                for (const prize of results.prizes) {
                        const prizeLower = prize.name.toLowerCase();
                        if (prizeLower.includes("khuyến khích") || 
                            prizeLower.includes("đặc biệt") || 
                            prizeLower.includes("db") ||
                            prizeLower.includes("đb")) {
                                continue;
                        }
                        
                        for (const number of prize.numbers) {
                                // Bỏ qua số trùng với ĐB
                                if (specialPrize && number === specialPrize) {
                                        continue;
                                }
                                
                                if (ticket.length >= 2 && number.length >= 2) {
                                        const ticket2Last = ticket.slice(-2);
                                        const number2Last = number.slice(-2);
                                        
                                        if (ticket2Last === number2Last) {
                                                return {
                                                        won: true,
                                                        prize: prize.name + " (Trùng 2 số cuối)",
                                                        winningNumber: number,
                                                };
                                        }
                                }
                        }
                }

                // Không trúng giải nào
                return { won: false };
        },

        /**
         * Lấy kết quả xổ số đã lưu của user
         * @param {string} userId - Discord User ID
         * @returns {Object|undefined} Kết quả xổ số hoặc undefined
         */
        getUserResults(userId) {
                return userActiveResults.get(userId);
        },

        /**
         * Lưu kết quả xổ số vào cache
         * @param {string} userId - Discord User ID
         * @param {Object} results - Kết quả xổ số
         */
        saveUserResults(userId, results) {
                const resultId = `${userId}_${Date.now()}`;
                activeResults.set(resultId, results);
                userActiveResults.set(userId, results);
                setTimeout(() => {
                        activeResults.delete(resultId);
                        userActiveResults.delete(userId);
                }, 300000); // 5 phút
        },

        /**
         * Fetch lại kết quả xổ số từ website
         * @param {string} provinceCode - Mã tỉnh
         * @param {string} date - Ngày quay (DD-MM-YYYY)
         * @returns {Object|null} Kết quả xổ số hoặc null
         */
        async fetchResults(provinceCode, date) {
                try {
                        const url = `https://www.minhngoc.net.vn/ket-qua-xo-so/${date}.html`;
                        const { data: html } = await axios.get(url, {
                                headers: {
                                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                },
                        });

                        const cheerio = require("cheerio");
                        const $ = cheerio.load(html);
                        const results = this.parseResultsWithDate($, provinceCode, date);

                        if (!results || results.prizes.length === 0) {
                                return null;
                        }

                        return results;
                } catch (error) {
                        console.error("Error fetching lottery results:", error.message);
                        return null;
                }
        },
};
