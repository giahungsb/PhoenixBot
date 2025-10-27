/**
 * Instagram Downloader sử dụng Snapsave
 * Package: snapsave-media-downloader
 * Hoàn toàn MIỄN PHÍ, KHÔNG GIỚI HẠN, KHÔNG CẦN API KEY!
 */

class InstagramSnapsave {
    constructor() {
        this.snapsave = null;
        this.initialized = false;
    }

    /**
     * Initialize snapsave module (dynamic import vì ESM)
     */
    async init() {
        if (this.initialized) return;
        
        try {
            const module = await import('snapsave-media-downloader');
            this.snapsave = module.snapsave;
            this.initialized = true;
            console.log('[Snapsave] ✅ Module initialized');
        } catch (error) {
            console.error('[Snapsave] ❌ Failed to load module:', error.message);
            throw new Error('Snapsave module not available');
        }
    }

    /**
     * Download Instagram media
     * @param {string} url - Instagram post/reel URL
     * @returns {Promise<Object>}
     */
    async download(url) {
        try {
            await this.init();
            
            console.log('[Snapsave] Downloading:', url);
            
            const result = await this.snapsave(url);
            
            if (!result || !result.success) {
                throw new Error('Snapsave returned no data');
            }

            return this.formatResponse(result, url);

        } catch (error) {
            console.error('[Snapsave] Error:', error.message);
            throw error;
        }
    }

    /**
     * Format snapsave response to bot format
     */
    formatResponse(snapsaveResult, originalUrl) {
        const data = snapsaveResult.data;
        
        if (!data || !data.media || data.media.length === 0) {
            throw new Error('No media found in response');
        }

        const mediaItems = data.media.map((item, index) => ({
            url: item.url,
            type: item.type === 'video' ? 'video' : 'image',
            quality: 'HD',
            thumbnail: item.thumbnail || null,
        }));

        return {
            success: true,
            method: 'snapsave-free',
            downloadUrl: mediaItems[0].url,
            mediaItems: mediaItems,
            mediaCount: mediaItems.length,
            thumbnail: mediaItems[0].thumbnail || null,
            originalUrl: originalUrl,
        };
    }

    /**
     * Check if URL is valid Instagram URL
     */
    isValidInstagramUrl(url) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)/,
            /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
            /(?:https?:\/\/)?(?:www\.)?instagram\.com\/share\/([A-Za-z0-9_-]+)/,
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }
}

module.exports = InstagramSnapsave;
