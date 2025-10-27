/**
 * Instagram Downloader API - Sử dụng Snapsave
 * Hoàn toàn MIỄN PHÍ, KHÔNG GIỚI HẠN, KHÔNG CẦN API KEY!
 */

const InstagramSnapsave = require('./instagram-snapsave');

class InstagramDownloaderAPI {
    constructor() {
        this.snapsave = new InstagramSnapsave();
    }

    /**
     * Lấy media từ Instagram URL
     * @param {string} instagramUrl - Instagram post/reel/story URL
     * @returns {Promise<Object>} - Media data với download URLs
     */
    async getMedia(instagramUrl) {
        console.log('[Instagram Downloader] Processing URL:', instagramUrl);

        try {
            const result = await this.snapsave.download(instagramUrl);
            
            if (result && result.success) {
                console.log('[Instagram Downloader] ✅ Success with Snapsave');
                return result;
            }
            
            throw new Error('Snapsave returned no data');
        } catch (error) {
            console.log('[Instagram Downloader] ❌ Snapsave failed:', error.message);
            throw error;
        }
    }

    /**
     * Parse Instagram URL
     */
    parseInstagramUrl(url) {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (match) {
            return {
                type: match[1],
                shortcode: match[2],
                fullUrl: `https://www.instagram.com/${match[1]}/${match[2]}/`,
            };
        }
        return null;
    }
}

module.exports = InstagramDownloaderAPI;
