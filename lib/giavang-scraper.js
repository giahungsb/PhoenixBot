const axios = require('axios');
const cheerio = require('cheerio');

class GiaVangScraper {
        constructor() {
                this.baseURL = 'https://giavang.org';
                this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }

        async fetchHTML() {
                try {
                        const response = await axios.get(this.baseURL, {
                                headers: {
                                        'User-Agent': this.userAgent,
                                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                                        'Accept-Encoding': 'gzip, deflate, br',
                                        'Connection': 'keep-alive',
                                        'Upgrade-Insecure-Requests': '1',
                                },
                                timeout: 15000,
                        });

                        return response.data;
                } catch (error) {
                        console.error('[GIAVANG SCRAPER] ❌ Failed to fetch HTML:', error.message);
                        throw error;
                }
        }

        parsePrice(priceText) {
                if (!priceText) return null;
                const match = priceText.match(/^[\d.,]+/);
                if (!match) return null;
                const cleanPrice = match[0].replace(/\./g, '').replace(',', '.');
                const price = parseFloat(cleanPrice);
                return isNaN(price) ? null : price * 1000;
        }

        async scrapeSystemDetail(systemUrl, filterSystem = null) {
                try {
                        const response = await axios.get(systemUrl, {
                                headers: {
                                        'User-Agent': this.userAgent,
                                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                                        'Accept-Encoding': 'gzip, deflate, br',
                                        'Connection': 'keep-alive',
                                },
                                timeout: 10000,
                        });

                        const $ = cheerio.load(response.data);
                        const allGoldTypes = [];
                        let lastRegion = null;

                        const table = $('table.table-bordered').first();
                        const rows = table.find('tbody tr');

                        rows.each((index, row) => {
                                const cells = $(row).find('th, td');
                                
                                let region, goldType, buyPrice, sellPrice;
                                
                                if (cells.length === 4) {
                                        region = $(cells[0]).text().trim();
                                        goldType = $(cells[1]).text().trim();
                                        buyPrice = this.parsePrice($(cells[2]).text());
                                        sellPrice = this.parsePrice($(cells[3]).text());
                                        
                                        if (region) {
                                                lastRegion = region;
                                        }
                                } else if (cells.length === 3) {
                                        goldType = $(cells[0]).text().trim();
                                        buyPrice = this.parsePrice($(cells[1]).text());
                                        sellPrice = this.parsePrice($(cells[2]).text());
                                        region = lastRegion;
                                }

                                if (!goldType || goldType.length === 0) {
                                        return;
                                }

                                if (buyPrice === null || sellPrice === null || isNaN(buyPrice) || isNaN(sellPrice)) {
                                        return;
                                }

                                if (filterSystem) {
                                        const normalizedGoldType = goldType.toUpperCase();
                                        const normalizedFilter = filterSystem.toUpperCase();
                                        
                                        if (!normalizedGoldType.includes(normalizedFilter)) {
                                                return;
                                        }
                                }

                                allGoldTypes.push({
                                        label: goldType,
                                        region: region,
                                        buy: buyPrice,
                                        sell: sellPrice
                                });
                        });

                        return allGoldTypes;
                } catch (error) {
                        console.error(`[GIAVANG SCRAPER] ❌ Failed to scrape ${systemUrl}:`, error.message);
                        return [];
                }
        }

        async scrapeGoldPrices() {
                try {
                        const html = await this.fetchHTML();
                        const $ = cheerio.load(html);

                        const updateTime = $('h1.box-headline small').text().trim();
                        const updateMatch = updateTime.match(/Cập nhật lúc (.+)/);
                        const lastUpdate = updateMatch ? updateMatch[1] : null;

                        const sjcBars = {
                                mieng: null,
                                nhan: null,
                        };

                        const mainBox = $('.gold-price-box').first();
                        const allPrices = mainBox.find('.gold-price');

                        if (allPrices.length >= 4) {
                                sjcBars.mieng = {
                                        buy: this.parsePrice(allPrices.eq(0).text()),
                                        sell: this.parsePrice(allPrices.eq(1).text()),
                                };
                                
                                sjcBars.nhan = {
                                        buy: this.parsePrice(allPrices.eq(2).text()),
                                        sell: this.parsePrice(allPrices.eq(3).text()),
                                };
                        } else if (allPrices.length >= 2) {
                                sjcBars.mieng = {
                                        buy: this.parsePrice(allPrices.eq(0).text()),
                                        sell: this.parsePrice(allPrices.eq(1).text()),
                                };
                        }

                        const priceTable = [];
                        const firstTable = $('table.table-bordered').first();
                        const tableRows = firstTable.find('tbody tr');

                        tableRows.each((index, row) => {
                                const cells = $(row).find('td');
                                
                                if (cells.length === 3) {
                                        const system = $(cells[0]).find('a').text().trim() || $(cells[0]).text().trim();
                                        const buyPrice = this.parsePrice($(cells[1]).text());
                                        const sellPrice = this.parsePrice($(cells[2]).text());

                                        if (system && buyPrice && sellPrice) {
                                                priceTable.push({
                                                        system,
                                                        buy: buyPrice,
                                                        sell: sellPrice,
                                                });
                                        }
                                } else if (cells.length === 4) {
                                        const region = $(cells[0]).text().trim();
                                        const system = $(cells[1]).find('a').text().trim() || $(cells[1]).text().trim();
                                        const buyPrice = this.parsePrice($(cells[2]).text());
                                        const sellPrice = this.parsePrice($(cells[3]).text());

                                        if (region && system && buyPrice && sellPrice) {
                                                priceTable.push({
                                                        region,
                                                        system,
                                                        buy: buyPrice,
                                                        sell: sellPrice,
                                                });
                                        }
                                }
                        });

                        const sjcPrices = priceTable.filter(item => item.system.includes('SJC'));
                        const pnjPrices = priceTable.filter(item => item.system.includes('PNJ'));
                        const dojiPrices = priceTable.filter(item => item.system.includes('DOJI'));
                        const btmcPrices = priceTable.filter(item => item.system.includes('Bảo Tín Minh Châu'));
                        const btmhPrices = priceTable.filter(item => item.system.includes('Bảo Tín Mạnh Hải'));
                        const phuQuyPrices = priceTable.filter(item => item.system.includes('Phú Quý'));
                        const miHongPrices = priceTable.filter(item => item.system.includes('Mi Hồng'));
                        const ngocThamPrices = priceTable.filter(item => item.system.includes('Ngọc Thẩm'));

                        console.log('[GIAVANG SCRAPER] 📡 Fetching detailed prices from all systems...');
                        const [sjcDetail, pnjDetail, dojiDetail, btmcDetail, btmhDetail, phuQuyDetail, miHongDetail, ngocThamDetail] = await Promise.all([
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/sjc/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/pnj/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/doji/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/bao-tin-minh-chau/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/bao-tin-manh-hai/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/phu-quy/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/mi-hong/'),
                                this.scrapeSystemDetail('https://giavang.org/trong-nuoc/ngoc-tham/'),
                        ]);

                        const systems = {
                                sjc: {
                                        name: 'SJC',
                                        icon: '🏆',
                                        url: 'https://giavang.org',
                                        types: []
                                },
                                pnj: {
                                        name: 'PNJ',
                                        icon: '💎',
                                        url: 'https://giavang.org/trong-nuoc/pnj/',
                                        types: pnjDetail
                                },
                                doji: {
                                        name: 'DOJI',
                                        icon: '⭐',
                                        url: 'https://giavang.org/trong-nuoc/doji/',
                                        types: dojiDetail
                                },
                                btmc: {
                                        name: 'Bảo Tín Minh Châu',
                                        icon: '🏅',
                                        url: 'https://giavang.org/trong-nuoc/bao-tin-minh-chau/',
                                        types: btmcDetail
                                },
                                btmh: {
                                        name: 'Bảo Tín Mạnh Hải',
                                        icon: '🌊',
                                        url: 'https://giavang.org/trong-nuoc/bao-tin-manh-hai/',
                                        types: btmhDetail
                                },
                                miHong: {
                                        name: 'Mi Hồng',
                                        icon: '🌸',
                                        url: 'https://giavang.org/trong-nuoc/mi-hong/',
                                        types: miHongDetail
                                },
                                ngocTham: {
                                        name: 'Ngọc Thẩm',
                                        icon: '💠',
                                        url: 'https://giavang.org/trong-nuoc/ngoc-tham/',
                                        types: ngocThamDetail
                                },
                                phuQuy: {
                                        name: 'Phú Quý',
                                        icon: '🎯',
                                        url: 'https://giavang.org/trong-nuoc/phu-quy/',
                                        types: phuQuyDetail
                                }
                        };

                        if (sjcBars.mieng) {
                                systems.sjc.types.push({
                                        label: 'Vàng miếng SJC',
                                        buy: sjcBars.mieng.buy,
                                        sell: sjcBars.mieng.sell
                                });
                        }
                        if (sjcBars.nhan) {
                                systems.sjc.types.push({
                                        label: 'Nhẫn tròn trơn SJC',
                                        buy: sjcBars.nhan.buy,
                                        sell: sjcBars.nhan.sell
                                });
                        }

                        if (sjcDetail && sjcDetail.length > 0) {
                                sjcDetail.forEach(item => {
                                        systems.sjc.types.push(item);
                                });
                        }

                        console.log(`[GIAVANG SCRAPER] ✅ Scraped successfully from giavang.org`);
                        console.log(`[GIAVANG SCRAPER] 📊 Last update: ${lastUpdate || 'Unknown'}`);
                        console.log(`[GIAVANG SCRAPER] 💰 SJC Miếng: Mua ${sjcBars.mieng?.buy?.toLocaleString('vi-VN')}đ - Bán ${sjcBars.mieng?.sell?.toLocaleString('vi-VN')}đ`);
                        console.log(`[GIAVANG SCRAPER] 💍 SJC Nhẫn: Mua ${sjcBars.nhan?.buy?.toLocaleString('vi-VN')}đ - Bán ${sjcBars.nhan?.sell?.toLocaleString('vi-VN')}đ`);
                        console.log(`[GIAVANG SCRAPER] 📋 System data count:`);
                        console.log(`[GIAVANG SCRAPER]    - SJC: ${systems.sjc.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - PNJ: ${systems.pnj.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - DOJI: ${systems.doji.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - Bảo Tín Minh Châu: ${systems.btmc.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - Bảo Tín Mạnh Hải: ${systems.btmh.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - Mi Hồng: ${systems.miHong.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - Ngọc Thẩm: ${systems.ngocTham.types.length}`);
                        console.log(`[GIAVANG SCRAPER]    - Phú Quý: ${systems.phuQuy.types.length}`);

                        return {
                                lastUpdate,
                                fetchedAt: new Date(),
                                systems,
                                sjcBars,
                                prices: {
                                        all: priceTable,
                                        sjc: sjcPrices,
                                        pnj: pnjPrices,
                                        doji: dojiPrices,
                                        btmc: btmcPrices,
                                        btmh: btmhPrices,
                                        phuQuy: phuQuyPrices,
                                        miHong: miHongPrices,
                                        ngocTham: ngocThamPrices,
                                }
                        };
                } catch (error) {
                        console.error('[GIAVANG SCRAPER] ❌ Failed to scrape gold prices:', error.message);
                        throw error;
                }
        }

        formatPrice(price) {
                if (price === null || price === undefined) return 'N/A';
                return new Intl.NumberFormat('vi-VN').format(price) + ' ₫';
        }
}

module.exports = new GiaVangScraper();
