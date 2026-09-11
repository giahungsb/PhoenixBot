const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { useClient, useLogger, useConfig, useFunctions } = require("@zibot/zihooks");
const { useMainPlayer } = require("discord-player");
const http = require("http");
const ngrok = require("ngrok");
const axios = require("axios");
const { getTokenManager } = require("../lib/download-token-manager");

async function startServer() {
        const logger = useLogger();
        const client = useClient();
        const player = useMainPlayer();

        const app = express();
        const server = http.createServer(app);
        app.use(
                cors({
                        origin: "*",
                        methods: ["GET", "POST"],
                        credentials: true,
                }),
        );
        server.listen(process.env.SERVER_PORT || 5000, "0.0.0.0", () => {
                logger.info(`Server running on port ${process.env.SERVER_PORT || 5000}`);
        });

        // Ngrok tunnel (optional) - Don't crash server if this fails
        if (process.env.NGROK_AUTHTOKEN && process.env.NGROK_AUTHTOKEN !== "") {
                try {
                        const url = await ngrok.connect({
                                addr: process.env.SERVER_PORT || 5000,
                                hostname: process.env.NGROK_DOMAIN,
                                authtoken: process.env.NGROK_AUTHTOKEN,
                        });
                        logger.info(`Ngrok tunnel active: ${url}`);
                } catch (error) {
                        logger.warn(`Ngrok tunnel failed: ${error.message} - Server still running on port ${process.env.SERVER_PORT || 5000}`);
                }
        }

        app.get("/", (req, res) => {
                if (!client.isReady())
                        return res.json({
                                status: "NG",
                                content: "API loading...!",
                        });

                res.json({
                        status: "OK",
                        content: "Welcome to API!",
                        clientName: client?.user?.displayName,
                        clientId: client?.user?.id,
                        avatars: client?.user?.displayAvatarURL({ size: 1024 }),
                });
        });

        app.get("/api/search", async (req, res) => {
                try {
                        const query = req.query?.query || req.query?.q;
                        if (!query) {
                                return res.status(400).json({ error: "Search query is required! Use /api/search?query=<input>" });
                        }

                        const searchResults = await player.search(query, {
                                requestedBy: client.user,
                                searchEngine: useConfig().PlayerConfig.QueryType,
                        });

                        res.json(searchResults.tracks.slice(0, 10));
                } catch (error) {
                        logger.error("Search error:", error);
                        res.status(500).json({ error: "An error occurred during search" });
                }
        });

        app.get("/api/lyrics", async (req, res) => {
                const LyricsFunc = useFunctions().get("Lyrics");
                const lyrics = await LyricsFunc.search({ query: req.query?.query || req.query?.q });
                res.json(lyrics);
        });

        // =====================================================
        // TIKTOK DOWNLOAD PROXY
        // =====================================================
        // Endpoint này xử lý download file qua token bảo mật
        // 
        // Chức năng:
        // - Nhận token từ URL parameter (/download/:token)
        // - Validate token và kiểm tra thời hạn (1 giờ)
        // - Lấy URL gốc và filename từ token
        // - Fetch file từ URL gốc (Discord CDN hoặc TikTok CDN)
        // - Stream file về client với header force download
        // 
        // Lý do cần endpoint này:
        // - Không expose URL gốc trực tiếp
        // - Force download thay vì stream trong browser
        // - Token có thời hạn để bảo mật
        // - Tracking số lần download
        // 
        // Sử dụng bởi:
        // - /tiktok command: Button "Tải video về máy"
        // 
        // ⚠️ QUAN TRỌNG:
        // - Content-Type PHẢI là application/octet-stream
        //   để force download, KHÔNG dùng video/mp4
        // - Content-Disposition PHẢI có "attachment" để force download
        // - Encode filename theo RFC 5987 để hỗ trợ Unicode
        // =====================================================
        
        app.get("/download/:token", async (req, res) => {
                try {
                        const token = req.params.token;
                        const tokenManager = getTokenManager();
                        
                        // BƯỚC 1: Validate token
                        const tokenData = tokenManager.validateToken(token);
                        
                        if (!tokenData) {
                                logger.warn(`[Download Proxy] ❌ Token không hợp lệ hoặc đã hết hạn: ${token}`);
                                return res.status(404).json({ 
                                        error: "Link download không hợp lệ hoặc đã hết hạn",
                                        message: "Download link is invalid or expired"
                                });
                        }
                        
                        const { url, filename } = tokenData;
                        logger.info(`[Download Proxy] 🔽 Đang tải: ${filename}`);
                        
                        // BƯỚC 2: Kiểm tra nếu là file path local hay URL remote
                        const isLocalFile = url.startsWith('/') || url.includes('tmp/');
                        
                        if (isLocalFile) {
                                // =====================================================
                                // SERVE LOCAL FILE (TikTok converted video)
                                // =====================================================
                                const filePath = url;
                                
                                // Kiểm tra file tồn tại
                                const fs = require('fs');
                                if (!fs.existsSync(filePath)) {
                                        logger.error(`[Download Proxy] ❌ File không tồn tại: ${filePath}`);
                                        return res.status(404).json({ error: 'File không tồn tại hoặc đã bị xóa' });
                                }
                                
                                const stat = fs.statSync(filePath);
                                const encodedFilename = encodeURIComponent(filename);
                                
                                // Set headers để force download
                                res.setHeader('Content-Type', 'application/octet-stream');
                                res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
                                res.setHeader('Content-Length', stat.size);
                                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                                res.setHeader('Pragma', 'no-cache');
                                res.setHeader('Expires', '0');
                                
                                // Stream file
                                const fileStream = fs.createReadStream(filePath);
                                fileStream.pipe(res);
                                
                                fileStream.on('end', () => {
                                        logger.info(`[Download Proxy] ✅ Download hoàn thành: ${filename}`);
                                });
                                
                                fileStream.on('error', (error) => {
                                        logger.error(`[Download Proxy] ❌ Lỗi stream:`, error);
                                        if (!res.headersSent) {
                                                res.status(500).json({ error: 'Download failed' });
                                        }
                                });
                        } else {
                                // =====================================================
                                // FETCH REMOTE FILE (TikTok CDN, Discord CDN, etc.)
                                // =====================================================
                                const isTikTok = url.includes('tiktok.com') || url.includes('tiktokcdn.com') || url.includes('muscdn.com') || url.includes('tik.fail');
                                const response = await axios({
                                        method: 'GET',
                                        url: url,
                                        responseType: 'stream',
                                        timeout: 0,
                                        maxContentLength: Infinity,
                                        maxBodyLength: Infinity,
                                        maxRedirects: 10,
                                        headers: isTikTok ? {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                                'Referer': 'https://www.tiktok.com/',
                                                'Accept': '*/*',
                                                'Accept-Encoding': 'identity',
                                                'Range': 'bytes=0-',
                                        } : {},
                                });
                                
                                const contentLength = response.headers['content-length'];
                                const encodedFilename = encodeURIComponent(filename);
                                
                                res.setHeader('Content-Type', 'application/octet-stream');
                                res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
                                
                                if (contentLength) {
                                        res.setHeader('Content-Length', contentLength);
                                }
                                
                                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                                res.setHeader('Pragma', 'no-cache');
                                res.setHeader('Expires', '0');
                                
                                response.data.pipe(res);
                                
                                response.data.on('end', () => {
                                        logger.info(`[Download Proxy] ✅ Download hoàn thành: ${filename}`);
                                });
                                
                                response.data.on('error', (error) => {
                                        logger.error(`[Download Proxy] ❌ Lỗi stream:`, error);
                                        if (!res.headersSent) {
                                                res.status(500).json({ error: 'Download failed' });
                                        }
                                });
                        }
                        
                } catch (error) {
                        logger.error('[Download Proxy] ❌ Lỗi:', error.message);
                        
                        if (!res.headersSent) {
                                res.status(500).json({ 
                                        error: "Không thể tải file",
                                        message: error.message 
                                });
                        }
                }
        });
        
        // =====================================================
        // KẾT THÚC TIKTOK DOWNLOAD PROXY
        // =====================================================

        const wss = new WebSocket.Server({ server });

        wss.on("connection", (ws) => {
                logger.debug("[WebSocket] Client connected.");

                let user = null;
                /**
                 * @type {import("discord-player").GuildQueue}
                 * @description The queue of the user
                 */
                let queue = null;

                ws.on("message", async (message) => {
                        try {
                                const data = JSON.parse(message);
                                logger.debug(data);

                                if (data.event == "GetVoice") {
                                        user = await client.users.fetch(data.userID);
                                        const userQueue = player.queues.cache.find((node) => node.metadata?.listeners.includes(user));
                                        if (userQueue?.connection) {
                                                queue = userQueue;
                                                ws.send(
                                                        JSON.stringify({ event: "ReplyVoice", channel: queue.metadata.channel, guild: queue.metadata.channel.guild }),
                                                );
                                        }
                                }
                                if (!queue || (queue.metadata.LockStatus && queue.metadata.requestedBy?.id !== (user?.id || data.userID))) return;

                                switch (data.event) {
                                        case "pause":
                                                await queue.node.setPaused(!queue.node.isPaused());
                                                break;
                                        case "play":
                                                await queue.play(data.trackUrl);
                                                break;
                                        case "skip":
                                                await queue.node.skip();
                                                break;
                                        case "back":
                                                if (queue?.history && queue.history?.previousTrack) queue.history.previous();
                                                break;
                                        case "volume":
                                                await queue.node.setVolume(Number(data.volume));
                                                break;
                                        case "loop":
                                                await queue.setRepeatMode(Number(data.mode));
                                                break;
                                        case "shuffle":
                                                await queue.tracks.shuffle();
                                                break;
                                        case "filter":
                                                await queue.filters.ffmpeg.toggle(data.filter);
                                                break;
                                        case "Playnext":
                                                if (queue.isEmpty() || !data.trackUrl || !data.TrackPosition) break;
                                                const res = await player.search(data.trackUrl, {
                                                        requestedBy: user,
                                                });
                                                if (res) {
                                                        await queue.removeTrack(data.TrackPosition - 1);
                                                        await queue.insertTrack(res.tracks?.at(0), 0);
                                                        await queue.node.skip();
                                                }
                                                break;
                                        case "DelTrack":
                                                if (queue.isEmpty() || !data.TrackPosition) break;
                                                queue.removeTrack(data.TrackPosition - 1);
                                                break;
                                        case "seek":
                                                if (!queue.isPlaying() || !data.position) break;
                                                await queue.node.seek(data.position);
                                                break;
                                }
                        } catch (error) {
                                logger.error("WebSocket message error:", error);
                        }
                });

                const sendStatistics = async () => {
                        if (!queue?.connection) return;
                        try {
                                const queueTracks = queue.tracks.map((track) => ({
                                        title: track.title,
                                        url: track.url,
                                        duration: track.duration,
                                        thumbnail: track.thumbnail,
                                        author: track.author,
                                }));

                                const currentTrack =
                                        queue.currentTrack ?
                                                {
                                                        title: queue.currentTrack.title,
                                                        url: queue.currentTrack.url,
                                                        duration: queue.currentTrack.duration,
                                                        thumbnail: queue.currentTrack.thumbnail,
                                                        author: queue.currentTrack.author,
                                                }
                                        :       null;

                                ws.send(
                                        JSON.stringify({
                                                event: "statistics",
                                                timestamp: {
                                                        current: queue.node.getTimestamp()?.current?.value ?? 0,
                                                        total: queue.currentTrack?.durationMS,
                                                },
                                                listeners: queue.metadata?.channel?.members.filter((mem) => !mem.user.bot).size ?? 0,
                                                tracks: queue.tracks.size,
                                                volume: queue.node.volume,
                                                paused: queue.node.isPaused(),
                                                repeatMode: queue.repeatMode,
                                                track: currentTrack,
                                                queue: queueTracks,
                                                filters: queue.filters.ffmpeg.getFiltersEnabled(),
                                                shuffle: queue.tracks.shuffled,
                                        }),
                                );
                        } catch (error) {
                                logger.error("Error in statistics handler:", error);
                        }
                };

                const statsInterval = setInterval(sendStatistics, 1000);
                sendStatistics();

                ws.on("close", () => {
                        logger.debug("[WebSocket] Client disconnected.");
                        clearInterval(statsInterval);
                });
        });
}

module.exports = { startServer };
