const axios = require("axios");

class StreamingService {
        constructor() {
                this.updateInterval = 500;
                this.maxChunkSize = 1900;
                this.minUpdateChars = 10;
        }

        async streamResponse(interaction, model, messages, apiKey, header = "") {
                const requestBody = {
                        model,
                        messages,
                        stream: true,
                };

                if (model.includes("polaris")) {
                        requestBody.plugins = [{ id: "web" }];
                }

                const response = await axios.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        requestBody,
                        {
                                headers: {
                                        Authorization: `Bearer ${apiKey}`,
                                        "Content-Type": "application/json",
                                        "HTTP-Referer": "https://replit.com",
                                        "X-Title": "Zibot Discord Bot",
                                },
                                responseType: "stream",
                                timeout: 90000,
                        }
                );

                let fullResponse = "";
                let lastUpdate = Date.now();
                let buffer = "";

                return new Promise((resolve, reject) => {
                        response.data.on("data", async (chunk) => {
                                try {
                                        const lines = chunk.toString().split("\n");

                                        for (const line of lines) {
                                                if (line.startsWith("data: ")) {
                                                        const data = line.slice(6);
                                                        
                                                        if (data === "[DONE]") {
                                                                continue;
                                                        }

                                                        try {
                                                                const parsed = JSON.parse(data);
                                                                const content = parsed.choices?.[0]?.delta?.content;

                                                                if (content) {
                                                                        buffer += content;
                                                                        fullResponse += content;

                                                                        const now = Date.now();
                                                                        const timeSinceUpdate = now - lastUpdate;
                                                                        const hasEnoughChars = buffer.length >= this.minUpdateChars;
                                                                        
                                                                        if (timeSinceUpdate > this.updateInterval || hasEnoughChars) {
                                                                                await this.updateMessage(interaction, header, fullResponse);
                                                                                lastUpdate = now;
                                                                                buffer = "";
                                                                        }
                                                                }
                                                        } catch (e) {
                                                        }
                                                }
                                        }
                                } catch (error) {
                                        console.error("Stream processing error:", error);
                                }
                        });

                        response.data.on("end", async () => {
                                await this.updateMessage(interaction, header, fullResponse);
                                resolve(fullResponse);
                        });

                        response.data.on("error", (error) => {
                                reject(error);
                        });
                });
        }

        async updateMessage(interaction, header, content) {
                try {
                        const displayContent = header + content + "\n\n*⏳ Đang viết...*";
                        
                        if (displayContent.length > 2000) {
                                const truncated = displayContent.slice(0, 1950) + "\n\n*⏳ Đang viết...*";
                                await interaction.editReply({ content: truncated });
                        } else {
                                await interaction.editReply({ content: displayContent });
                        }
                } catch (error) {
                        console.error("Failed to update message:", error);
                }
        }

        async finalizeMessage(interaction, header, content) {
                try {
                        const displayContent = header + content;
                        
                        if (displayContent.length > 2000) {
                                await interaction.editReply({ 
                                        content: displayContent.slice(0, 1990) + "\n\n*[Quá dài]*" 
                                });
                        } else {
                                await interaction.editReply({ content: displayContent });
                        }
                } catch (error) {
                        console.error("Failed to finalize message:", error);
                }
        }
}

module.exports = new StreamingService();
