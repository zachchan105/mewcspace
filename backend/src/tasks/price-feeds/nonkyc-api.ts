import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class NonKYCApi implements PriceFeed {
  public name = 'NonKYC';
  public currencies = ['USD']; // via USDT

  private base = 'https://api.nonkyc.io/api/v2';
  private symbol = 'MEWC/USDT'; // Use slash format for NonKYC API

  // For parity with other feeds:
  public url    = `${this.base}/ticker/${encodeURIComponent(this.symbol)}`;
  public urlHist = `${this.base}/kline/${encodeURIComponent(this.symbol)}?interval={GRANULARITY}`;

  private parseLast(json: any): number | null {
    // NonKYC API response format: { "last_price": "0.00006416", ... }
    const cand = json?.last_price;
    const n = typeof cand === 'string' ? parseFloat(cand) : cand;
    return Number.isFinite(n) ? n : null;
  }

  private parseKlines(json: any): Array<{ t: number; close: number }> {
    // Expect array of [openTimeMs, open, high, low, close, volume, closeTimeMs?]
    if (!Array.isArray(json)) return [];
    const out: Array<{ t: number; close: number }> = [];
    for (const row of json) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const t = Math.round(Number(row[0]) / 1000);
      const close = Number(row[4]);
      if (Number.isFinite(t) && Number.isFinite(close)) out.push({ t, close });
    }
    return out;
  }

  public async $fetchPrice(currency: 'USD'): Promise<number> {
    if (currency !== 'USD') return -1;
    const res = await query(this.url);
    const last = this.parseLast(res);
    return last ?? -1; // USDT≈USD
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};
    if (!currencies.includes('USD')) return priceHistory;

    try {
      const gran = type === 'hour' ? '1h' : '1d';
      const res = await query(this.urlHist.replace('{GRANULARITY}', gran));
      const kl = this.parseKlines(res);

      for (const { t, close } of kl) {
        if (!priceHistory[t]) priceHistory[t] = priceUpdater.getEmptyPricesObj();
        priceHistory[t]['USD'] = close; // USDT≈USD
      }
    } catch (error) {
      // NonKYC historical data endpoints may not be available
      // Return empty history - the current price will still work
      console.log('NonKYC historical data not available:', error);
    }
    return priceHistory;
  }
}

export default NonKYCApi;
