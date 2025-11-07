/**
 * =====================================================
 * DOWNLOAD TOKEN MANAGER
 * =====================================================
 * Module quản lý token bảo mật cho download proxy
 * 
 * Chức năng:
 * - Tạo token ngẫu nhiên cho mỗi file download
 * - Lưu trữ mapping: token → URL gốc + tên file
 * - Validate token và kiểm tra thời hạn
 * - Tự động dọn dẹp token hết hạn
 * 
 * Lý do cần module này:
 * - Không expose URL Discord CDN trực tiếp trong button
 * - Token có thời hạn (1 giờ) để bảo mật
 * - Cho phép tracking số lần download
 */

const crypto = require('crypto');

class DownloadTokenManager {
    constructor() {
        // Lưu trữ tokens: token -> { url, filename, expiresAt, downloads }
        this.tokens = new Map();
        
        // Tự động dọn dẹp token hết hạn mỗi 5 phút
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Tạo token mới cho download
     * 
     * @param {string} discordUrl - URL gốc (Discord CDN hoặc TikTok CDN)
     * @param {string} filename - Tên file khi download (mặc định: video.mp4)
     * @param {number} ttl - Thời gian sống của token (giây, mặc định: 1 giờ)
     * @returns {string} - Token ngẫu nhiên 64 ký tự
     * 
     * Token format: 64 ký tự hex ngẫu nhiên
     * Ví dụ: a1b2c3d4e5f6...
     */
    createToken(discordUrl, filename = 'video.mp4', ttl = 3600) {
        // Tạo token ngẫu nhiên (32 bytes = 64 hex chars)
        const token = crypto.randomBytes(32).toString('hex');
        
        // Tính thời gian hết hạn
        const expiresAt = Date.now() + (ttl * 1000);
        
        // Lưu thông tin token
        this.tokens.set(token, {
            url: discordUrl,          // URL gốc cần download
            filename: filename,       // Tên file khi download
            expiresAt: expiresAt,     // Thời gian hết hạn
            createdAt: Date.now(),    // Thời gian tạo
            downloads: 0              // Số lần đã download
        });
        
        return token;
    }

    /**
     * Kiểm tra và lấy thông tin từ token
     * 
     * @param {string} token - Token cần validate
     * @returns {Object|null} - Thông tin token hoặc null nếu không hợp lệ
     * 
     * Return format:
     * {
     *   url: "https://...",
     *   filename: "video.mp4",
     *   expiresAt: 1234567890,
     *   createdAt: 1234567890,
     *   downloads: 1
     * }
     */
    validateToken(token) {
        const data = this.tokens.get(token);
        
        // Token không tồn tại
        if (!data) {
            return null;
        }
        
        // Token đã hết hạn
        if (Date.now() > data.expiresAt) {
            this.tokens.delete(token);
            return null;
        }
        
        // Tăng số lần download
        data.downloads++;
        
        return data;
    }

    /**
     * Vô hiệu hóa token (xóa token)
     * 
     * @param {string} token - Token cần xóa
     */
    invalidateToken(token) {
        this.tokens.delete(token);
    }

    /**
     * Dọn dẹp các token đã hết hạn
     * Được gọi tự động mỗi 5 phút
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt) {
                this.tokens.delete(token);
                cleaned++;
            }
        }
    }

    /**
     * Lấy thống kê token
     * 
     * @returns {Object} - Thống kê
     */
    getStats() {
        const now = Date.now();
        const active = Array.from(this.tokens.values()).filter(t => now <= t.expiresAt).length;
        const expired = this.tokens.size - active;
        
        return {
            total: this.tokens.size,
            active: active,
            expired: expired
        };
    }

    /**
     * Xóa tất cả token
     */
    clearAll() {
        this.tokens.clear();
    }

    /**
     * Hủy manager và dừng cleanup interval
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.clearAll();
    }
}

// =====================================================
// SINGLETON PATTERN
// =====================================================
// Đảm bảo chỉ có 1 instance duy nhất trong toàn bộ app

let instance = null;

/**
 * Lấy singleton instance của DownloadTokenManager
 * 
 * @returns {DownloadTokenManager}
 */
function getTokenManager() {
    if (!instance) {
        instance = new DownloadTokenManager();
    }
    return instance;
}

module.exports = {
    DownloadTokenManager,
    getTokenManager
};
