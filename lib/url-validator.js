const axios = require('axios');

class URLValidator {
    static validateDownloadUrl(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('URL không hợp lệ');
        }
        
        if (!url.startsWith('http')) {
            throw new Error('URL phải bắt đầu bằng http/https');
        }
        
        if (url.length > 2000) {
            return {
                valid: true,
                warning: 'URL quá dài, cần rút gọn',
                needsShorten: true,
                url: url
            };
        }
        
        const expireMatch = url.match(/__expires=(\d+)/);
        if (expireMatch) {
            const expiresTimestamp = parseInt(expireMatch[1]) * 1000;
            const now = Date.now();
            const remainingTime = expiresTimestamp - now;
            
            if (remainingTime < 60000) {
                return {
                    valid: false,
                    error: '❌ Link download đã hết hạn (chỉ còn < 1 phút). Vui lòng tải lại.',
                    url: url
                };
            }
            
            if (remainingTime < 300000) {
                return {
                    valid: true,
                    warning: '⚠️ Link sắp hết hạn, hãy tải nhanh!',
                    remainingSeconds: Math.floor(remainingTime / 1000),
                    url: url
                };
            }
        }
        
        return {
            valid: true,
            url: url
        };
    }
    
    static async shortenUrl(longUrl) {
        try {
            const response = await axios.get('https://tinyurl.com/api/create.php', {
                params: { url: longUrl },
                timeout: 5000
            });
            
            if (response.status === 200 && response.data) {
                return response.data.trim();
            }
        } catch (error) {
            console.error('[URLValidator] Không thể rút gọn URL:', error.message);
        }
        
        return longUrl;
    }
    
    static async validateAndProcessUrl(url) {
        const validation = this.validateDownloadUrl(url);
        
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        if (validation.needsShorten) {
            console.log('[URLValidator] URL quá dài, đang rút gọn...');
            const shortened = await this.shortenUrl(url);
            return {
                original: url,
                shortened: shortened,
                url: shortened
            };
        }
        
        return {
            url: url,
            original: url
        };
    }
}

module.exports = URLValidator;
