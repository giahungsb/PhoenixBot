const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiSearch {
        constructor() {
                this.apiKey = process.env.GEMINI_API_KEY;
                this.model = null;
                this.initModel();
        }

        initModel() {
                if (!this.apiKey) {
                        console.warn("[GeminiSearch] GEMINI_API_KEY not found. Search will be disabled.");
                        return;
                }

                try {
                        const genAI = new GoogleGenerativeAI(this.apiKey);
                        this.model = genAI.getGenerativeModel({
                                model: "gemini-2.0-flash-exp",
                                tools: [{ googleSearch: {} }],
                        });
                        console.log("[GeminiSearch] ✅ Initialized with gemini-2.0-flash-exp and Google Search");
                } catch (error) {
                        console.error("[GeminiSearch] Failed to initialize:", error.message);
                }
        }

        async search(query, maxResults = 5) {
                if (!this.model) {
                        return {
                                success: false,
                                message: "GEMINI_API_KEY chưa được thiết lập. Vui lòng thêm key vào Secrets.",
                                results: [],
                        };
                }

                try {
                        const today = new Date();
                        const dateString = today.toLocaleDateString('vi-VN', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                        });
                        
                        const prompt = `Today's date is ${dateString}. Search the web and provide the MOST CURRENT and ACCURATE information about: ${query}

IMPORTANT REQUIREMENTS:
1. For prices (gold, fuel, stocks, crypto): MUST provide the EXACT current price for TODAY (${dateString})
2. For news/events: MUST provide the LATEST information available
3. For statistics/data: MUST verify the data is UP-TO-DATE and from RELIABLE sources
4. Always include SPECIFIC NUMBERS and DATES when providing information
5. Cross-check information from MULTIPLE RELIABLE sources if possible

Please provide:
1. Direct answer with SPECIFIC, ACCURATE data (numbers, dates, details)
2. Latest information available as of TODAY (${dateString})
3. Reliable sources and citations

Format your response clearly and concisely in Vietnamese if the query is in Vietnamese, otherwise in English.`;

                        const result = await this.model.generateContent(prompt);
                        const response = result.response;
                        const text = response.text();

                        const groundingMetadata = response.groundingMetadata;
                        const sources = [];

                        if (groundingMetadata && groundingMetadata.groundingChunks) {
                                groundingMetadata.groundingChunks.forEach((chunk, index) => {
                                        if (chunk.web && index < maxResults) {
                                                sources.push({
                                                        position: index + 1,
                                                        title: chunk.web.title || "No title",
                                                        url: chunk.web.uri,
                                                        description: text.substring(0, 200),
                                                });
                                        }
                                });
                        }

                        return {
                                success: true,
                                query: query,
                                answer: text,
                                sources: sources,
                                webSearchQueries: groundingMetadata?.webSearchQueries || [],
                                totalResults: sources.length,
                        };
                } catch (error) {
                        console.error("[GeminiSearch Error]:", error.message);
                        
                        if (error.message.includes("API_KEY_INVALID")) {
                                return {
                                        success: false,
                                        message: "GEMINI_API_KEY không hợp lệ. Vui lòng kiểm tra lại key.",
                                        results: [],
                                };
                        }

                        return {
                                success: false,
                                message: `Lỗi khi tìm kiếm: ${error.message}`,
                                results: [],
                        };
                }
        }

        formatResultsForAI(searchData) {
                if (!searchData.success) {
                        return `❌ ${searchData.message}`;
                }

                let formattedText = `🔍 Kết quả tìm kiếm cho "${searchData.query}":\n\n`;
                formattedText += `📝 **Trả lời:**\n${searchData.answer}\n\n`;

                if (searchData.sources && searchData.sources.length > 0) {
                        formattedText += `📚 **Nguồn tham khảo:**\n`;
                        searchData.sources.forEach((source) => {
                                formattedText += `${source.position}. **${source.title}**\n`;
                                formattedText += `   🔗 ${source.url}\n\n`;
                        });
                }

                if (searchData.webSearchQueries && searchData.webSearchQueries.length > 0) {
                        formattedText += `🔎 Các truy vấn tìm kiếm: ${searchData.webSearchQueries.join(", ")}\n`;
                }

                return formattedText;
        }

        async searchAndFormat(query, maxResults = 5) {
                const searchData = await this.search(query, maxResults);
                return this.formatResultsForAI(searchData);
        }
}

module.exports = new GeminiSearch();
