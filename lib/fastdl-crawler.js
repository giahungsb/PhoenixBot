const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class FastDLCrawler {
    constructor() {
        console.log('[FastDLCrawler] ✅ Module initialized (with Puppeteer + Chromium)');
        this.maxRetries = 2;
        this.retryDelay = 3000;
        // Try to use puppeteer's built-in Chromium first
        this.chromiumPath = this.detectChromiumPath();
    }

    detectChromiumPath() {
        try {
            // First, try puppeteer's executable path (it auto-downloads Chromium)
            const puppeteerPath = puppeteer.executablePath();
            if (puppeteerPath && fs.existsSync(puppeteerPath)) {
                console.log(`[FastDLCrawler] ✅ Using Puppeteer Chromium: ${puppeteerPath}`);
                return puppeteerPath;
            }
        } catch (e) {
            console.log('[FastDLCrawler] Could not get Puppeteer path:', e.message);
        }

        const nixPath = '/usr/local/bin/chromium';
        
        // Check if custom path exists
        if (fs.existsSync(nixPath)) {
            console.log('[FastDLCrawler] Using Chromium at /usr/local/bin');
            return nixPath;
        }
        
        // Try common Linux paths
        const commonPaths = [
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/applications/Chromium.app/Contents/MacOS/Chromium',
            '/Program Files/Google/Chrome/Application/chrome.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable'
        ];
        
        for (const chromiumPath of commonPaths) {
            if (fs.existsSync(chromiumPath)) {
                console.log(`[FastDLCrawler] Found Chromium at ${chromiumPath}`);
                return chromiumPath;
            }
        }
        
        console.log('[FastDLCrawler] ⚠️ No Chromium found, will let Puppeteer auto-detect');
        return null; // Puppeteer will auto-detect
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isValidInstagramUrl(url) {
        const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
        return instagramRegex.test(url);
    }

    async getMedia(instagramUrl) {
        console.log('[FastDLCrawler] Processing URL:', instagramUrl);

        if (!this.isValidInstagramUrl(instagramUrl)) {
            throw new Error('Invalid Instagram URL. Please provide a valid Instagram post/reel/tv URL.');
        }

        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
            try {
                console.log(`[FastDLCrawler] Attempt ${attempt}/${this.maxRetries + 1}...`);
                
                const result = await this.crawlWithPuppeteer(instagramUrl);
                
                if (result && result.success && result.downloadUrl) {
                    console.log(`[FastDLCrawler] ✅ Success on attempt ${attempt}`);
                    result.attempt = attempt;
                    return result;
                }
            } catch (error) {
                lastError = error;
                console.log(`[FastDLCrawler] ⚠️ Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt <= this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(1.5, attempt - 1);
                    console.log(`[FastDLCrawler] Retrying in ${Math.round(delay)}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        console.error('[FastDLCrawler] ❌ All attempts failed');
        throw new Error(
            `❌ Không thể tải từ Instagram sau ${this.maxRetries + 1} lần thử.\n\n` +
            `**Nguyên nhân có thể:**\n` +
            `- Post/Reel ở chế độ riêng tư\n` +
            `- Link không tồn tại hoặc đã bị xóa\n` +
            `- Instagram đang chặn tạm thời\n` +
            `- FastDL.app đang bảo trì\n\n` +
            `**Giải pháp:**\n` +
            `1. Kiểm tra link có đúng và post ở chế độ Public\n` +
            `2. Thử lại sau vài phút\n` +
            `3. Sử dụng công cụ khác: SnapInsta.to, iGram.world\n\n` +
            `Lỗi chi tiết: ${lastError?.message || 'Unknown error'}`
        );
    }

    async crawlWithPuppeteer(instagramUrl) {
        console.log('[FastDLCrawler] Using Puppeteer method...');

        let browser;
        try {
            const launchConfig = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            };

            // Only set executablePath if we found a valid Chromium path
            if (this.chromiumPath) {
                launchConfig.executablePath = this.chromiumPath;
            }

            browser = await puppeteer.launch(launchConfig);

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            console.log('[FastDLCrawler] Opening fastdl.app...');
            await page.goto('https://fastdl.app/en2', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            console.log('[FastDLCrawler] Finding input field...');
            await page.waitForSelector('input[type="text"]', { timeout: 10000 });
            
            const inputSelector = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input'));
                const input = inputs.find(i => 
                    i.type === 'text' || 
                    i.placeholder?.toLowerCase().includes('url') || 
                    i.placeholder?.toLowerCase().includes('link') ||
                    i.placeholder?.toLowerCase().includes('instagram')
                );
                
                if (!input) return null;
                input.id = input.id || 'fastdl-input-field';
                return '#' + input.id;
            });

            if (!inputSelector) {
                throw new Error('Cannot find input field');
            }

            console.log('[FastDLCrawler] Typing Instagram URL...');
            await page.type(inputSelector, instagramUrl, { delay: 50 });
            await this.sleep(800);
            
            console.log('[FastDLCrawler] Clicking Download button...');
            const mediaResponsePromise = page.waitForResponse(
                response => {
                    const url = response.url();
                    return (url.includes('cdninstagram') || 
                            url.includes('scontent') || 
                            url.includes('media.fastdl.app') ||
                            url.includes('fbcdn'));
                },
                { timeout: 15000 }
            ).catch(() => null);

            const buttonClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const downloadBtn = buttons.find(btn => 
                    btn.textContent?.toLowerCase().includes('download') ||
                    btn.value?.toLowerCase().includes('download')
                );
                
                if (downloadBtn) {
                    downloadBtn.click();
                    return true;
                }
                return false;
            });

            if (!buttonClicked) {
                throw new Error('Cannot find Download button');
            }

            console.log('[FastDLCrawler] Waiting for results...');
            
            await Promise.race([
                page.waitForSelector('.result, .download-result, a[download], a[href*="media.fastdl.app"]', { timeout: 12000 }).catch(() => null),
                this.sleep(8000)
            ]);

            const errorInfo = await page.evaluate(() => {
                const bodyText = document.body.innerText.toLowerCase();
                if (bodyText.includes('something went wrong') || 
                    bodyText.includes('couldn\'t download') ||
                    bodyText.includes('error occurred')) {
                    
                    const errorElement = Array.from(document.querySelectorAll('*')).find(el => {
                        const text = el.textContent.toLowerCase();
                        return text.includes('something went wrong') || 
                               text.includes('couldn\'t download');
                    });
                    
                    return {
                        hasError: true,
                        message: errorElement?.textContent || 'FastDL reported an error'
                    };
                }
                return { hasError: false };
            });

            if (errorInfo.hasError) {
                throw new Error(errorInfo.message);
            }

            const results = await page.evaluate(() => {
                const downloadLinks = [];
                
                const links = document.querySelectorAll('a[href*="cdninstagram"], a[href*="scontent"], a[download], a[href*=".mp4"], a[href*=".jpg"], a[href*="media.fastdl.app"]');
                links.forEach(link => {
                    if (link.href && link.href.startsWith('http')) {
                        const isVideo = link.href.includes('.mp4') || 
                                       link.href.includes('video') || 
                                       link.textContent?.toLowerCase().includes('video');
                        downloadLinks.push({
                            url: link.href,
                            type: isVideo ? 'video' : 'image'
                        });
                    }
                });

                const videos = document.querySelectorAll('video source, video');
                videos.forEach(video => {
                    const src = video.src || video.querySelector('source')?.src;
                    if (src && src.startsWith('http')) {
                        downloadLinks.push({
                            url: src,
                            type: 'video'
                        });
                    }
                });

                const images = document.querySelectorAll('img[src*="cdninstagram"], img[src*="scontent"], img[src*="media.fastdl.app"]');
                images.forEach(img => {
                    if (img.src && img.src.startsWith('http') && 
                        !img.src.includes('logo') && 
                        !img.src.includes('icon') &&
                        img.width > 100) {
                        downloadLinks.push({
                            url: img.src,
                            type: 'image'
                        });
                    }
                });

                return downloadLinks.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
            });

            if (results.length === 0) {
                const pageHTML = await page.content();
                console.log('[FastDLCrawler] No results found, page length:', pageHTML.length);
                throw new Error('No download links found. FastDL may have changed its structure or the post is unavailable.');
            }

            const mediaItems = results.map(item => ({
                url: item.url,
                type: item.type,
                quality: 'HD',
                thumbnail: null
            }));

            console.log(`[FastDLCrawler] Found ${mediaItems.length} media item(s)`);

            return {
                success: true,
                method: 'puppeteer',
                downloadUrl: mediaItems[0].url,
                mediaItems: mediaItems,
                mediaCount: mediaItems.length,
                thumbnail: mediaItems.find(m => m.type === 'image')?.url || null,
                username: null,
                fullname: null,
                isVerified: false,
                likes: 0,
                originalUrl: instagramUrl
            };

        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = FastDLCrawler;
