/**
 * =====================================================
 * TIKTOK UTILITIES
 * =====================================================
 * Module tổng hợp các tiện ích cho TikTok downloader
 * 
 * Chức năng:
 * - Trích xuất URL CDN từ JWT token (TikTok V3 API)
 * - Download file với progress bar
 * - Tích hợp Discord progress updates
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * =====================================================
 * TIKTOK CDN EXTRACTOR
 * =====================================================
 * Giải mã JWT token và trích xuất URL CDN gốc
 */
class TikTokCDNExtractor {
    decodeJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }

            const payload = parts[1];
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const decodedPayload = Buffer.from(base64, 'base64').toString('utf-8');
            return JSON.parse(decodedPayload);
        } catch (error) {
            return null;
        }
    }

    extractCDNUrl(jwtUrl) {
        try {
            if (!jwtUrl || typeof jwtUrl !== 'string') {
                throw new Error('Invalid JWT URL');
            }

            const tokenMatch = jwtUrl.match(/token=(.+)$/);
            if (!tokenMatch) {
                return jwtUrl;
            }

            const token = tokenMatch[1];
            const decoded = this.decodeJWT(token);

            if (decoded) {
                const originUrl = decoded.origin_url || decoded.originUrl;
                if (originUrl) {
                    return originUrl;
                }
                
                if (decoded.url_list && Array.isArray(decoded.url_list) && decoded.url_list.length > 0) {
                    return decoded.url_list[0];
                }
                
                if (decoded.url) {
                    return decoded.url;
                }
            }

            return jwtUrl;
        } catch (error) {
            return jwtUrl;
        }
    }

    extractAllUrls(v3Result) {
        const result = {
            videoHD: null,
            videoSD: null,
            videoWatermark: null,
            images: []
        };

        if (v3Result.videoHD) {
            result.videoHD = this.extractCDNUrl(v3Result.videoHD);
        }

        if (v3Result.videoSD) {
            result.videoSD = this.extractCDNUrl(v3Result.videoSD);
        }

        if (v3Result.videoWatermark) {
            result.videoWatermark = this.extractCDNUrl(v3Result.videoWatermark);
        }

        if (v3Result.images && Array.isArray(v3Result.images)) {
            result.images = v3Result.images.map(imgUrl => this.extractCDNUrl(imgUrl));
        }

        return result;
    }
}

/**
 * =====================================================
 * TIKTOK DOWNLOADER WITH PROGRESS
 * =====================================================
 * Download file từ TikTok CDN với hiển thị tiến trình
 */
class TikTokDownloaderProgress {
    constructor() {
        this.tmpDir = path.join(process.cwd(), 'tmp');
    }

    async downloadWithProgress(url, outputPath, onProgress = null) {
        let response;
        
        try {
            response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tiktok.com/',
                }
            });
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
        }

        try {
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            let lastPercent = 0;

            await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

            const writer = fs.createWriteStream(outputPath);

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                
                if (totalSize) {
                    const percent = Math.floor((downloadedSize / totalSize) * 100);
                    
                    if (percent !== lastPercent && onProgress) {
                        lastPercent = percent;
                        onProgress(percent, downloadedSize, totalSize);
                    }
                }
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    if (onProgress) {
                        onProgress(100, downloadedSize, totalSize || downloadedSize);
                    }
                    resolve(outputPath);
                });
                
                writer.on('error', (error) => {
                    reject(error);
                });
            });

        } catch (error) {
            throw error;
        }
    }

    async downloadWithDiscordProgress(url, outputPath, interaction, prefix = "file") {
        let lastUpdateTime = Date.now();
        const UPDATE_INTERVAL = 2000;

        const onProgress = async (percent, downloaded, total) => {
            const now = Date.now();
            
            if (now - lastUpdateTime >= UPDATE_INTERVAL || percent === 100) {
                lastUpdateTime = now;
                
                const downloadedMB = (downloaded / (1024 * 1024)).toFixed(2);
                const totalMB = (total / (1024 * 1024)).toFixed(2);
                
                const progressBar = this.createProgressBar(percent);
                
                const message = `⏳ Đang tải ${prefix}...\n\n${progressBar} ${percent}%\n📊 ${downloadedMB}MB / ${totalMB}MB`;
                
                try {
                    if (percent < 100) {
                        await interaction.editReply({ content: message });
                    }
                } catch (error) {
                }
            }
        };

        return await this.downloadWithProgress(url, outputPath, onProgress);
    }

    createProgressBar(percent) {
        const barLength = 20;
        const filledLength = Math.floor((percent / 100) * barLength);
        const emptyLength = barLength - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        return `[${filledBar}${emptyBar}]`;
    }

    async downloadMultipleWithProgress(urls, outputDir, onProgress = null) {
        const downloadedFiles = [];

        await fs.promises.mkdir(outputDir, { recursive: true });

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const fileName = `file_${i + 1}${path.extname(url) || '.jpg'}`;
            const outputPath = path.join(outputDir, fileName);

            const fileProgress = (percent) => {
                if (onProgress) {
                    onProgress(i + 1, urls.length, percent);
                }
            };

            try {
                const filePath = await this.downloadWithProgress(url, outputPath, fileProgress);
                downloadedFiles.push(filePath);
            } catch (error) {
            }
        }

        return downloadedFiles;
    }

    async downloadMultipleWithDiscordProgress(urls, outputDir, interaction, prefix = "files") {
        let lastUpdateTime = Date.now();
        const UPDATE_INTERVAL = 2000;

        const onProgress = async (fileIndex, totalFiles, percent) => {
            const now = Date.now();
            
            if (now - lastUpdateTime >= UPDATE_INTERVAL || (fileIndex === totalFiles && percent === 100)) {
                lastUpdateTime = now;
                
                const overallPercent = Math.floor(((fileIndex - 1) / totalFiles * 100) + (percent / totalFiles));
                const progressBar = this.createProgressBar(overallPercent);
                
                const message = `⏳ Đang tải ${prefix}...\n\n${progressBar} ${overallPercent}%\n📁 File ${fileIndex}/${totalFiles} - ${percent}%`;
                
                try {
                    await interaction.editReply({ content: message });
                } catch (error) {
                }
            }
        };

        return await this.downloadMultipleWithProgress(urls, outputDir, onProgress);
    }
}

/**
 * =====================================================
 * VIDEO CONVERTER - FFMPEG
 * =====================================================
 * Chuyển đổi video sang định dạng tương thích Discord (H.264/AAC)
 */
class VideoConverter {
    async convertToH264(inputPath, outputPath, progressCallback = null) {
        const { spawn } = require('child_process');
        const ffmpegPath = require('ffmpeg-static');
        
        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputPath,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
                '-progress', 'pipe:2',
                '-y',
                outputPath
            ];

            const ffmpeg = spawn(ffmpegPath, args);
            let stderr = '';
            let duration = null;
            
            ffmpeg.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                
                if (!duration) {
                    const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                    if (durationMatch) {
                        const hours = parseInt(durationMatch[1]);
                        const minutes = parseInt(durationMatch[2]);
                        const seconds = parseFloat(durationMatch[3]);
                        duration = hours * 3600 + minutes * 60 + seconds;
                    }
                }
                
                if (duration && progressCallback) {
                    const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                    if (timeMatch) {
                        const hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        const seconds = parseFloat(timeMatch[3]);
                        const currentTime = hours * 3600 + minutes * 60 + seconds;
                        const percent = Math.min(Math.round((currentTime / duration) * 100), 100);
                        progressCallback(percent);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    if (progressCallback) progressCallback(100);
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    async convertInPlace(filePath, progressCallback = null) {
        const tempPath = filePath + '.temp.mp4';
        
        try {
            await this.convertToH264(filePath, tempPath, progressCallback);
            await fs.promises.unlink(filePath);
            await fs.promises.rename(tempPath, filePath);
        } catch (error) {
            try {
                await fs.promises.unlink(tempPath);
            } catch (cleanupError) {
            }
            throw error;
        }
    }
}

module.exports = {
    TikTokCDNExtractor,
    TikTokDownloaderProgress,
    VideoConverter
};
