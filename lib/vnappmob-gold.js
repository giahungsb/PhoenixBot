const axios = require('axios');

class VNAppMobGoldAPI {
        constructor() {
                this.baseURL = 'https://vapi.vnappmob.com/api';
                this.apiKey = process.env.VNAPPMOB_API_KEY || null;
                this.apiKeyExpiresAt = process.env.VNAPPMOB_API_KEY_EXPIRES_AT || null;
                this.isRequestingKey = false;
                this.keyRequestPromise = null;
        }

        async requestAPIKey() {
                if (this.isRequestingKey && this.keyRequestPromise) {
                        return this.keyRequestPromise;
                }

                this.isRequestingKey = true;
                this.keyRequestPromise = (async () => {
                        try {
                                const response = await axios.get(`${this.baseURL}/request_api_key`, {
                                        params: { scope: 'gold' },
                                        timeout: 10000,
                                });

                                if (response.data && response.data.results) {
                                        this.apiKey = response.data.results;
                                        const expiresAt = new Date();
                                        expiresAt.setDate(expiresAt.getDate() + 14);
                                        this.apiKeyExpiresAt = expiresAt.toISOString();

                                        console.log('[GOLD API] ✅ Successfully requested API key from VNAppMob');
                                        console.log('[GOLD API] 🔑 API Key expires at:', expiresAt.toLocaleString('vi-VN'));
                                        
                                        return {
                                                apiKey: this.apiKey,
                                                expiresAt: this.apiKeyExpiresAt
                                        };
                                }

                                throw new Error('Invalid API response');
                        } catch (error) {
                                console.error('[GOLD API] ❌ Failed to request API key:', error.message);
                                throw error;
                        } finally {
                                this.isRequestingKey = false;
                                this.keyRequestPromise = null;
                        }
                })();

                return this.keyRequestPromise;
        }

        isKeyExpired() {
                if (!this.apiKeyExpiresAt) return true;
                const expiresAt = new Date(this.apiKeyExpiresAt);
                const now = new Date();
                const daysLeft = (expiresAt - now) / (1000 * 60 * 60 * 24);
                return daysLeft < 1;
        }

        async ensureValidAPIKey() {
                if (!this.apiKey || this.isKeyExpired()) {
                        console.log('[GOLD API] 🔄 API key missing or expired, requesting new key...');
                        await this.requestAPIKey();
                }
                return this.apiKey;
        }

        async fetchGoldPrices(source = 'sjc', retryCount = 0) {
                const MAX_RETRIES = 2;

                try {
                        await this.ensureValidAPIKey();

                        const response = await axios.get(`${this.baseURL}/v2/gold/${source.toLowerCase()}`, {
                                params: {
                                        api_key: this.apiKey
                                },
                                timeout: 15000,
                        });

                        if (response.data && response.data.results) {
                                return {
                                        source: source.toUpperCase(),
                                        data: response.data.results,
                                        fetchedAt: new Date(),
                                };
                        }

                        throw new Error('Invalid API response');
                } catch (error) {
                        if (error.response?.status === 403 && retryCount < MAX_RETRIES) {
                                console.log(`[GOLD API] ⚠️ API key invalid for ${source}, requesting new key (retry ${retryCount + 1}/${MAX_RETRIES})...`);
                                this.apiKey = null;
                                
                                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                                
                                await this.ensureValidAPIKey();
                                return this.fetchGoldPrices(source, retryCount + 1);
                        }

                        console.error(`[GOLD API] ❌ Failed to fetch ${source} prices:`, error.message);
                        throw error;
                }
        }

        async fetchAllPrices() {
                try {
                        await this.ensureValidAPIKey();

                        const [sjc, pnj, doji] = await Promise.all([
                                this.fetchGoldPrices('sjc').catch(err => ({ error: err.message, source: 'SJC' })),
                                this.fetchGoldPrices('pnj').catch(err => ({ error: err.message, source: 'PNJ' })),
                                this.fetchGoldPrices('doji').catch(err => ({ error: err.message, source: 'DOJI' })),
                        ]);

                        return {
                                sjc,
                                pnj,
                                doji,
                                fetchedAt: new Date(),
                        };
                } catch (error) {
                        console.error('[GOLD API] ❌ Failed to fetch all prices:', error.message);
                        throw error;
                }
        }

        formatPrice(price) {
                if (!price) return 'N/A';
                return new Intl.NumberFormat('vi-VN').format(price) + ' ₫';
        }
}

module.exports = new VNAppMobGoldAPI();
