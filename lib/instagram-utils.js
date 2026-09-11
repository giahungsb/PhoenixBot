/**
 * INSTAGRAM UTILITIES - Local Download Handler
 * Tương tự TikTok, download media locally và trả token bảo mật
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class InstagramDownloader {
    constructor() {
        this.tmpDir = path.join(process.cwd(), 'tmp');
    }

    async downloadMediaLocal(mediaUrl, outputPath, onProgress = null) {
        try {
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'stream',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.instagram.com/',
                }
            });

            const totalSize = parseInt(response.headers['content-length'] || 0, 10);
            let downloadedSize = 0;
            let lastPercent = 0;

            await fs.mkdir(path.dirname(outputPath), { recursive: true });

            const writer = require('fs').createWriteStream(outputPath);

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                
                if (totalSize && onProgress) {
                    const percent = Math.floor((downloadedSize / totalSize) * 100);
                    if (percent !== lastPercent) {
                        lastPercent = percent;
                        onProgress(percent, downloadedSize, totalSize);
                    }
                }
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`[InstagramUtils] ✅ Downloaded: ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            console.error('[InstagramUtils] ❌ Download error:', error.message);
            throw error;
        }
    }

    async downloadAndConvert(mediaUrl, fileType = 'mp4') {
        const timestamp = Date.now();
        const filename = `instagram_${timestamp}.${fileType}`;
        const outputPath = path.join(this.tmpDir, filename);

        try {
            console.log(`[InstagramUtils] Downloading from: ${mediaUrl.substring(0, 80)}...`);
            
            await this.downloadMediaLocal(mediaUrl, outputPath, (percent, current, total) => {
                if (percent % 25 === 0) {
                    console.log(`[InstagramUtils] Progress: ${percent}% (${Math.round(current/1024/1024)}MB)`);
                }
            });

            return {
                success: true,
                filepath: outputPath,
                filename: filename,
                fileType: fileType,
                size: (await fs.stat(outputPath)).size
            };

        } catch (error) {
            console.error('[InstagramUtils] ❌ Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = InstagramDownloader;
