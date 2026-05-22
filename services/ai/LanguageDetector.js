class LanguageDetector {
        constructor() {
                this.vietnamesePatterns = [
                        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
                        /\b(và|của|trong|là|có|được|để|này|những|các|với|cho|từ|hoặc|như|về|khi|nếu|đã|sẽ|còn|nhưng|cũng|bởi|vì|theo|sau|trước|đến|rồi|thì|nên|phải|không|chỉ|đang|vẫn|đều|cùng|hay)\b/i,
                ];

                this.englishPatterns = [
                        /\b(the|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|may|might|must|can|shall)\b/i,
                        /\b(and|or|but|if|then|else|when|where|what|who|which|how|why)\b/i,
                ];
        }

        detect(text) {
                if (!text || text.trim().length === 0) {
                        return "auto";
                }

                let vietnameseScore = 0;
                let englishScore = 0;

                this.vietnamesePatterns.forEach((pattern) => {
                        const matches = text.match(pattern);
                        if (matches) {
                                vietnameseScore += matches.length;
                        }
                });

                this.englishPatterns.forEach((pattern) => {
                        const matches = text.match(pattern);
                        if (matches) {
                                englishScore += matches.length;
                        }
                });

                if (vietnameseScore > englishScore * 1.5) {
                        return "vi";
                } else if (englishScore > vietnameseScore * 1.5) {
                        return "en";
                }

                const asciiRatio = this.getAsciiRatio(text);
                if (asciiRatio > 0.95) {
                        return "en";
                }
                if (asciiRatio < 0.7) {
                        return "vi";
                }

                return "auto";
        }

        getAsciiRatio(text) {
                if (!text || text.length === 0) return 1;
                
                const asciiChars = text.split("").filter((char) => {
                        const code = char.charCodeAt(0);
                        return code < 128;
                }).length;

                return asciiChars / text.length;
        }

        getLanguageName(code) {
                const languageNames = {
                        vi: "Tiếng Việt",
                        en: "English",
                        auto: "Auto-detect",
                };
                return languageNames[code] || "Unknown";
        }
}

module.exports = new LanguageDetector();
