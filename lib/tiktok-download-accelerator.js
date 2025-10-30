/**
 * TikTok Download Accelerator - Singleton Pattern
 * Tăng tốc độ download video TikTok từ link API trả về
 * - Hỗ trợ AbortController cho timeout thực sự
 * - Cache thông minh với size check
 * - Retry tự động
 * - Singleton cleanup để tránh memory leak
 * - Chuyển đổi codec AV1 → H.264 để tương thích tốt hơn
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

class TikTokDownloadAccelerator {
    static instance = null;
    static cleanupInterval = null;

    constructor(options = {}) {
        if (TikTokDownloadAccelerator.instance) {
            return TikTokDownloadAccelerator.instance;
        }

        this.cacheDir = options.cacheDir || path.join(__dirname, '../cache/tiktok');
        this.cacheExpireTime = options.cacheExpireTime || 1800000;
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 90000;
        this.maxCacheSize = options.maxCacheSize || 200 * 1024 * 1024;
        this.maxFileSize = options.maxFileSize || 25 * 1024 * 1024;
        this.convertToH264 = options.convertToH264 !== false;
        
        this.ensureCacheDir();
        this.startCacheCleanup();

        TikTokDownloadAccelerator.instance = this;
    }

    static getInstance(options = {}) {
        if (!TikTokDownloadAccelerator.instance) {
            new TikTokDownloadAccelerator(options);
        }
        return TikTokDownloadAccelerator.instance;
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            console.log('[TikTok Accelerator] Created cache directory:', this.cacheDir);
        }
    }

    getCacheKey(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    getCachePath(url) {
        const cacheKey = this.getCacheKey(url);
        return path.join(this.cacheDir, `${cacheKey}.mp4`);
    }

    isCacheValid(cachePath) {
        try {
            if (!fs.existsSync(cachePath)) {
                return false;
            }

            const stats = fs.statSync(cachePath);
            const now = Date.now();
            const fileAge = now - stats.mtimeMs;

            if (fileAge > this.cacheExpireTime) {
                console.log('[TikTok Accelerator] Cache expired, removing:', cachePath);
                fs.unlinkSync(cachePath);
                return false;
            }

            const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`[TikTok Accelerator] Cache hit: ${fileSizeMB} MB`);
            return true;
        } catch (error) {
            console.error('[TikTok Accelerator] Cache check error:', error);
            return false;
        }
    }

    async checkFileSize(url) {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            const contentLength = response.headers['content-length'];
            if (contentLength) {
                const sizeBytes = parseInt(contentLength, 10);
                const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
                console.log(`[TikTok Accelerator] File size: ${sizeMB} MB`);
                return { size: sizeBytes, sizeMB };
            }

            return null;
        } catch (error) {
            console.log('[TikTok Accelerator] Could not determine file size:', error.message);
            return null;
        }
    }

    async downloadWithRetry(url, retries = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('[TikTok Accelerator] Request timeout, aborting...');
            controller.abort();
        }, this.timeout);

        try {
            console.log(`[TikTok Accelerator] Downloading... (attempt ${retries + 1}/${this.maxRetries})`);

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
                    'Connection': 'keep-alive',
                    'Referer': 'https://www.tiktok.com/',
                    'Sec-Fetch-Dest': 'video',
                    'Sec-Fetch-Mode': 'no-cors',
                },
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
            });

            clearTimeout(timeoutId);

            if (!response.data || response.data.length === 0) {
                throw new Error('Empty response data');
            }

            const sizeMB = (response.data.length / 1024 / 1024).toFixed(2);
            console.log(`[TikTok Accelerator] ✅ Downloaded ${sizeMB} MB`);

            if (!this.convertToH264 && response.data.length > this.maxFileSize) {
                console.log(`[TikTok Accelerator] ⚠️ Downloaded file ${sizeMB} MB exceeds Discord limit`);
                const error = new Error('FILE_TOO_LARGE');
                error.size = response.data.length;
                error.sizeMB = sizeMB;
                throw error;
            }

            return response.data;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'CanceledError' || error.code === 'ECONNABORTED') {
                console.error(`[TikTok Accelerator] Download timeout or aborted (attempt ${retries + 1})`);
            } else {
                console.error(`[TikTok Accelerator] Download error (attempt ${retries + 1}):`, error.message);
            }

            if (retries < this.maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, retries), 5000);
                console.log(`[TikTok Accelerator] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.downloadWithRetry(url, retries + 1);
            }

            throw error;
        }
    }

    async convertVideoToH264(inputBuffer) {
        return new Promise((resolve, reject) => {
            const randomId = crypto.randomBytes(8).toString('hex');
            const tempInput = path.join(this.cacheDir, `temp_input_${Date.now()}_${randomId}.mp4`);
            const tempOutput = path.join(this.cacheDir, `temp_output_${Date.now()}_${randomId}.mp4`);

            fs.writeFileSync(tempInput, inputBuffer);
            
            const cleanup = () => {
                try {
                    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                } catch (e) {
                    console.warn('[TikTok Accelerator] Cleanup warning:', e.message);
                }
            };

            try {
                console.log('[TikTok Accelerator] 🔄 Converting to H.264 codec for better compatibility...');

                const ffmpeg = spawn(ffmpegPath, [
                    '-i', tempInput,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', '+faststart',
                    '-f', 'mp4',
                    '-y',
                    tempOutput
                ]);

                let stderr = '';
                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    try {
                        if (code !== 0) {
                            console.error('[TikTok Accelerator] ❌ FFmpeg conversion failed:', stderr);
                            console.log('[TikTok Accelerator] ⚠️ Using original video without conversion');
                            return resolve(inputBuffer);
                        }

                        const convertedBuffer = fs.readFileSync(tempOutput);

                        const originalMB = (inputBuffer.length / 1024 / 1024).toFixed(2);
                        const convertedMB = (convertedBuffer.length / 1024 / 1024).toFixed(2);
                        console.log(`[TikTok Accelerator] ✅ Converted: ${originalMB} MB → ${convertedMB} MB (H.264)`);

                        resolve(convertedBuffer);
                    } catch (conversionError) {
                        console.error('[TikTok Accelerator] Conversion read error:', conversionError);
                        resolve(inputBuffer);
                    } finally {
                        cleanup();
                    }
                });

                ffmpeg.on('error', (error) => {
                    console.error('[TikTok Accelerator] FFmpeg spawn error:', error);
                    cleanup();
                    resolve(inputBuffer);
                });

            } catch (error) {
                console.error('[TikTok Accelerator] Conversion setup error:', error);
                cleanup();
                resolve(inputBuffer);
            }
        });
    }

    async download(url, skipCache = false) {
        const cachePath = this.getCachePath(url);

        if (!skipCache && this.isCacheValid(cachePath)) {
            console.log('[TikTok Accelerator] ✅ Using cached version');
            const cachedBuffer = fs.readFileSync(cachePath);
            
            if (cachedBuffer.length > this.maxFileSize) {
                console.log('[TikTok Accelerator] ⚠️ Cached file exceeds limit, removing and re-downloading');
                fs.unlinkSync(cachePath);
                return this.download(url, true);
            }
            
            return cachedBuffer;
        }

        if (!this.convertToH264) {
            const sizeInfo = await this.checkFileSize(url);
            if (sizeInfo && sizeInfo.size > this.maxFileSize) {
                console.log(`[TikTok Accelerator] ⚠️ File ${sizeInfo.sizeMB} MB exceeds Discord limit (pre-check)`);
                const error = new Error('FILE_TOO_LARGE');
                error.size = sizeInfo.size;
                error.sizeMB = sizeInfo.sizeMB;
                throw error;
            }
        } else {
            console.log('[TikTok Accelerator] ℹ️ Codec conversion enabled - will check size after conversion');
        }

        console.log('[TikTok Accelerator] 📥 Downloading from source...');
        let videoBuffer = await this.downloadWithRetry(url);

        if (this.convertToH264) {
            try {
                videoBuffer = await this.convertVideoToH264(videoBuffer);
                
                if (videoBuffer.length > this.maxFileSize) {
                    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
                    console.log(`[TikTok Accelerator] ⚠️ Converted file ${sizeMB} MB still exceeds Discord limit`);
                    const error = new Error('FILE_TOO_LARGE');
                    error.size = videoBuffer.length;
                    error.sizeMB = sizeMB;
                    throw error;
                }
            } catch (conversionError) {
                if (conversionError.message === 'FILE_TOO_LARGE') {
                    throw conversionError;
                }
                console.error('[TikTok Accelerator] Conversion failed, using original:', conversionError);
            }
        }

        try {
            await this.cleanupCacheIfNeeded();
            fs.writeFileSync(cachePath, videoBuffer);
            console.log('[TikTok Accelerator] ✅ Cached for future use');
        } catch (cacheError) {
            console.warn('[TikTok Accelerator] Could not cache file:', cacheError.message);
        }

        return videoBuffer;
    }

    async cleanupCacheIfNeeded() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            let totalSize = 0;
            const fileStats = [];

            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                fileStats.push({ path: filePath, size: stats.size, mtime: stats.mtimeMs });
            }

            if (totalSize > this.maxCacheSize) {
                console.log(`[TikTok Accelerator] Cache size ${(totalSize / 1024 / 1024).toFixed(2)} MB exceeded, cleaning up...`);
                fileStats.sort((a, b) => a.mtime - b.mtime);

                let removedSize = 0;
                for (const file of fileStats) {
                    if (totalSize - removedSize <= this.maxCacheSize * 0.8) break;
                    
                    fs.unlinkSync(file.path);
                    removedSize += file.size;
                    console.log(`[TikTok Accelerator] Removed old cache: ${path.basename(file.path)}`);
                }
            }
        } catch (error) {
            console.error('[TikTok Accelerator] Cache cleanup error:', error);
        }
    }

    startCacheCleanup() {
        if (TikTokDownloadAccelerator.cleanupInterval) {
            console.log('[TikTok Accelerator] Cleanup interval already running (singleton)');
            return;
        }

        console.log('[TikTok Accelerator] Starting singleton cleanup interval');
        TikTokDownloadAccelerator.cleanupInterval = setInterval(() => {
            try {
                const files = fs.readdirSync(this.cacheDir);
                const now = Date.now();
                let removedCount = 0;

                for (const file of files) {
                    const filePath = path.join(this.cacheDir, file);
                    const stats = fs.statSync(filePath);
                    const fileAge = now - stats.mtimeMs;

                    if (fileAge > this.cacheExpireTime) {
                        fs.unlinkSync(filePath);
                        removedCount++;
                    }
                }

                if (removedCount > 0) {
                    console.log(`[TikTok Accelerator] Auto cleanup: removed ${removedCount} expired cache files`);
                }
            } catch (error) {
                console.error('[TikTok Accelerator] Auto cleanup error:', error);
            }
        }, 600000);
    }

    static dispose() {
        if (TikTokDownloadAccelerator.cleanupInterval) {
            clearInterval(TikTokDownloadAccelerator.cleanupInterval);
            TikTokDownloadAccelerator.cleanupInterval = null;
            console.log('[TikTok Accelerator] Cleanup interval stopped');
        }
        TikTokDownloadAccelerator.instance = null;
    }

    clearCache() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                fs.unlinkSync(path.join(this.cacheDir, file));
            }
            console.log('[TikTok Accelerator] Cache cleared');
            return true;
        } catch (error) {
            console.error('[TikTok Accelerator] Clear cache error:', error);
            return false;
        }
    }

    getCacheInfo() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            let totalSize = 0;
            let count = 0;

            for (const file of files) {
                const stats = fs.statSync(path.join(this.cacheDir, file));
                totalSize += stats.size;
                count++;
            }

            return {
                count,
                totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                maxSizeMB: (this.maxCacheSize / 1024 / 1024).toFixed(2),
            };
        } catch (error) {
            console.error('[TikTok Accelerator] Get cache info error:', error);
            return null;
        }
    }
}

module.exports = TikTokDownloadAccelerator;
