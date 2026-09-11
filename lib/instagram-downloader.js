const { instagramGetUrl } = require('instagram-url-direct');
const axios = require('axios');

class InstagramDownloader {
    constructor() {
        console.log('[InstagramDownloader] ✅ Module initialized with multiple API fallbacks');
        this.methods = [
            { name: 'instagram-url-direct', func: this.tryInstagramUrlDirect.bind(this) },
            { name: '@mrnima/instagram-downloader', func: this.tryMrNima.bind(this) },
            { name: 'scraper-instagram', func: this.tryScraperInstagram.bind(this) }
        ];
        this.maxRetries = 2;
        this.retryDelay = 1500;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async retryWithBackoff(func, methodName, attempt = 1) {
        try {
            return await func();
        } catch (error) {
            const retriesLeft = this.maxRetries - attempt;
            if (retriesLeft <= 0) {
                throw error;
            }
            
            const delay = this.retryDelay * Math.pow(1.5, attempt - 1);
            console.log(`[InstagramDownloader] Retry ${attempt}/${this.maxRetries - 1} for ${methodName} after ${Math.round(delay)}ms`);
            await this.sleep(delay);
            
            return this.retryWithBackoff(func, methodName, attempt + 1);
        }
    }

    async getMedia(instagramUrl) {
        console.log('[InstagramDownloader] Processing URL:', instagramUrl);

        if (!this.isValidInstagramUrl(instagramUrl)) {
            throw new Error('Invalid Instagram URL. Please provide a valid Instagram post/reel/tv URL.');
        }

        const errors = [];
        
        for (const method of this.methods) {
            try {
                console.log(`[InstagramDownloader] Trying ${method.name}...`);
                
                const result = await this.retryWithBackoff(
                    () => method.func(instagramUrl),
                    method.name
                );
                
                if (result && result.success) {
                    console.log(`[InstagramDownloader] ✅ Success with ${method.name}`);
                    return result;
                }
            } catch (error) {
                const errorMsg = `${method.name}: ${error.message}`;
                console.log(`[InstagramDownloader] ⚠️ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

        console.error('[InstagramDownloader] ❌ All methods failed');
        console.error('[InstagramDownloader] Errors:', errors.join(' | '));
        
        throw new Error(
            `⚠️ Instagram đã chặn tất cả các phương thức tải về.\n\n` +
            `**Nguyên nhân:**\n` +
            `- Instagram thường xuyên cập nhật bảo mật để chặn các công cụ tải về\n` +
            `- Các API miễn phí không có proxy để vượt qua hạn chế\n` +
            `- Post có thể ở chế độ riêng tư hoặc đã bị xóa\n\n` +
            `**Giải pháp:**\n` +
            `1. Thử lại sau vài phút (Instagram có thể bỏ chặn)\n` +
            `2. Sử dụng các trang web tải về trực tiếp:\n` +
            `   • SnapInsta.to\n` +
            `   • iGram.world\n` +
            `   • DownloadGram.org\n` +
            `3. Đảm bảo post ở chế độ công khai (Public)`
        );
    }

    isValidInstagramUrl(url) {
        const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
        return instagramRegex.test(url);
    }

    async tryInstagramUrlDirect(url) {
        const result = await instagramGetUrl(url);

        if (!result || !result.url_list || result.url_list.length === 0) {
            throw new Error('No media found');
        }

        return this.formatResponse(result, url, 'instagram-url-direct');
    }

    async tryMrNima(url) {
        const { instagramDownload } = require('@mrnima/instagram-downloader');
        
        const result = await instagramDownload(url);
        
        if (!result || !result.status || !result.result || result.result.length === 0) {
            throw new Error('API returned no media');
        }

        const mediaItems = result.result.map(item => ({
            url: item.link,
            type: item.type || 'image',
            quality: 'HD',
            thumbnail: null
        }));

        return {
            success: true,
            method: '@mrnima/instagram-downloader',
            downloadUrl: mediaItems[0].url,
            mediaItems: mediaItems,
            mediaCount: mediaItems.length,
            thumbnail: null,
            username: null,
            fullname: null,
            isVerified: false,
            likes: 0,
            originalUrl: url
        };
    }

    async tryScraperInstagram(url) {
        const InstaClient = require('scraper-instagram');
        
        const shortcode = this.parseInstagramUrl(url).shortcode;
        const result = await InstaClient.getPost(shortcode);
        
        if (!result || !result.link) {
            throw new Error('No media link found');
        }

        const mediaItems = [{
            url: result.link,
            type: result.type === 'Video' ? 'video' : 'image',
            quality: 'HD',
            thumbnail: result.thumbnail || null
        }];

        return {
            success: true,
            method: 'scraper-instagram',
            downloadUrl: result.link,
            mediaItems: mediaItems,
            mediaCount: 1,
            thumbnail: result.thumbnail || null,
            username: result.owner?.username || null,
            fullname: result.owner?.full_name || null,
            isVerified: result.owner?.is_verified || false,
            likes: result.likes || 0,
            originalUrl: url
        };
    }

    formatResponse(data, originalUrl, methodName) {
        const mediaItems = [];

        if (data.media_details && Array.isArray(data.media_details)) {
            for (const media of data.media_details) {
                mediaItems.push({
                    url: media.url,
                    type: media.type || 'image',
                    quality: 'HD',
                    thumbnail: media.thumbnail || null,
                    dimensions: media.dimensions || null,
                    videoViews: media.video_view_count || null,
                });
            }
        } else if (data.url_list && Array.isArray(data.url_list)) {
            for (const url of data.url_list) {
                mediaItems.push({
                    url: url,
                    type: url.toLowerCase().includes('video') ? 'video' : 'image',
                    quality: 'HD',
                    thumbnail: null,
                });
            }
        }

        if (mediaItems.length === 0) {
            throw new Error('No media items found in response');
        }

        return {
            success: true,
            method: methodName,
            downloadUrl: mediaItems[0].url,
            mediaItems: mediaItems,
            mediaCount: data.results_number || mediaItems.length,
            thumbnail: mediaItems[0].thumbnail || null,
            username: data.post_info?.owner_username || null,
            fullname: data.post_info?.owner_fullname || null,
            isVerified: data.post_info?.is_verified || false,
            likes: data.post_info?.likes || 0,
            originalUrl: originalUrl,
        };
    }

    parseInstagramUrl(url) {
        const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
        const match = url.match(instagramRegex);
        
        if (!match) {
            throw new Error('Invalid Instagram URL format');
        }

        return {
            shortcode: match[1],
            fullUrl: `https://www.instagram.com/p/${match[1]}/`
        };
    }
}

module.exports = InstagramDownloader;
