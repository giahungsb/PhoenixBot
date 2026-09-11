/**
 * Discord URL Converter
 * Chuyển đổi Discord stream URL thành download URL
 */

class DiscordUrlConverter {
    /**
     * Chuyển Discord stream URL thành download URL
     * @param {string} discordUrl - Discord CDN URL (cdn.discordapp.com hoặc media.discordapp.net)
     * @returns {string} - Download URL
     */
    convertToDownloadUrl(discordUrl) {
        try {
            if (!discordUrl || typeof discordUrl !== 'string') {
                console.log('[Discord URL Converter] Invalid URL provided');
                return discordUrl;
            }

            // Parse URL
            const url = new URL(discordUrl);
            
            // Discord CDN có 2 domain chính:
            // - cdn.discordapp.com (stream)
            // - media.discordapp.net (có thể force download)
            
            if (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net') {
                // Thêm query parameter để force download
                // Discord sẽ set Content-Disposition: attachment khi có ?download=true
                url.searchParams.set('download', 'true');
                
                console.log('[Discord URL Converter] ✅ Converted to download URL');
                return url.toString();
            }

            console.log('[Discord URL Converter] Not a Discord CDN URL, returning original');
            return discordUrl;

        } catch (error) {
            console.error('[Discord URL Converter] ❌ Error converting URL:', error.message);
            return discordUrl;
        }
    }

    /**
     * Chuyển sang media.discordapp.net để có thể force download
     * @param {string} discordUrl - Discord CDN URL
     * @returns {string} - Media URL with download parameter
     */
    convertToMediaUrl(discordUrl) {
        try {
            if (!discordUrl || typeof discordUrl !== 'string') {
                return discordUrl;
            }

            const url = new URL(discordUrl);
            
            // Nếu là cdn.discordapp.com, chuyển sang media.discordapp.net
            if (url.hostname === 'cdn.discordapp.com') {
                url.hostname = 'media.discordapp.net';
            }
            
            // Thêm download parameter
            url.searchParams.set('download', 'true');
            
            console.log('[Discord URL Converter] ✅ Converted to media download URL');
            return url.toString();

        } catch (error) {
            console.error('[Discord URL Converter] ❌ Error converting to media URL:', error.message);
            return discordUrl;
        }
    }

    /**
     * Lấy filename từ Discord URL
     * @param {string} discordUrl - Discord CDN URL
     * @returns {string|null} - Filename or null
     */
    getFilename(discordUrl) {
        try {
            const url = new URL(discordUrl);
            const pathname = url.pathname;
            const parts = pathname.split('/');
            return parts[parts.length - 1] || null;
        } catch (error) {
            console.error('[Discord URL Converter] Error getting filename:', error.message);
            return null;
        }
    }

    /**
     * Kiểm tra xem URL có phải Discord CDN không
     * @param {string} url - URL to check
     * @returns {boolean}
     */
    isDiscordCdnUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === 'cdn.discordapp.com' || 
                   urlObj.hostname === 'media.discordapp.net';
        } catch (error) {
            return false;
        }
    }

    /**
     * Tạo download URL với custom filename
     * @param {string} discordUrl - Discord CDN URL
     * @param {string} customFilename - Custom filename (optional)
     * @returns {string} - Download URL
     */
    createDownloadUrl(discordUrl, customFilename = null) {
        try {
            const url = new URL(discordUrl);
            
            // Chuyển sang media.discordapp.net nếu cần
            if (url.hostname === 'cdn.discordapp.com') {
                url.hostname = 'media.discordapp.net';
            }
            
            // Thêm download parameter
            url.searchParams.set('download', 'true');
            
            // Nếu có custom filename, thêm vào
            if (customFilename) {
                url.searchParams.set('filename', customFilename);
            }
            
            console.log('[Discord URL Converter] ✅ Created download URL with custom filename');
            return url.toString();

        } catch (error) {
            console.error('[Discord URL Converter] Error creating download URL:', error.message);
            return discordUrl;
        }
    }

    /**
     * Batch convert nhiều URLs
     * @param {Array<string>} urls - Array of Discord URLs
     * @returns {Array<string>} - Array of download URLs
     */
    batchConvert(urls) {
        return urls.map(url => this.convertToDownloadUrl(url));
    }
}

module.exports = DiscordUrlConverter;
