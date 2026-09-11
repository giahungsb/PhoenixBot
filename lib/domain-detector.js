/**
 * Domain Detector
 * Simple domain detection for Instagram/TikTok downloads
 * 
 * Usage:
 * 1. Set DOWNLOAD_BASE_URL in .env to your public domain
 * 2. If not set, falls back to localhost (development only)
 */

function getPublicDomain() {
    // User-configured domain from .env
    if (process.env.DOWNLOAD_BASE_URL) {
        const url = process.env.DOWNLOAD_BASE_URL.replace(/\/$/, '');
        console.log('[DomainDetector] Using DOWNLOAD_BASE_URL:', url);
        return url;
    }

    // Fallback: localhost (development only)
    const serverPort = process.env.SERVER_PORT || 5000;
    const fallback = `http://localhost:${serverPort}`;
    console.error('[DomainDetector] ❌ DOWNLOAD_BASE_URL not configured!');
    console.error('[DomainDetector] ❌ Using localhost fallback:', fallback);
    console.error('[DomainDetector] ⚠️  Downloads will NOT work for Discord users!');
    console.error('[DomainDetector] 💡 Please set DOWNLOAD_BASE_URL in .env');
    return fallback;
}

module.exports = { getPublicDomain };
