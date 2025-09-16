import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class CoinPaprikaApi implements PriceFeed {
  public name = 'CoinPaprika';
  public currencies = ['USD'];

  private base = 'https://api.coinpaprika.com/v1';
  private coinId = 'mewc-meowcoin'; // MeowCoin ID on CoinPaprika

  // For parity with other feeds:
  public url = `${this.base}/tickers/${this.coinId}`;
  public urlHist = `${this.base}/tickers/${this.coinId}/historical?start={START_DATE}&interval={GRANULARITY}`;

  private parseLast(json: any): number | null {
    // CoinPaprika API response format: { "quotes": { "USD": { "price": 0.0000642, ... } } }
    const price = json?.quotes?.USD?.price;
    const n = typeof price === 'string' ? parseFloat(price) : price;
    return Number.isFinite(n) ? n : null;
  }

  private parseHistorical(json: any): Array<{ t: number; close: number }> {
    // CoinPaprika historical format: [{ "timestamp": "2025-09-16T00:00:00Z", "price": 0.0000642, ... }]
    if (!Array.isArray(json)) return [];
    const out: Array<{ t: number; close: number }> = [];
    for (const row of json) {
      if (!row.timestamp || !row.price) continue;
      const t = Math.round(new Date(row.timestamp).getTime() / 1000);
      const close = Number(row.price);
      if (Number.isFinite(t) && Number.isFinite(close)) out.push({ t, close });
    }
    return out;
  }

  public async $fetchPrice(currency: 'USD'): Promise<number> {
    if (currency !== 'USD') return -1;
    const res = await query(this.url);
    const last = this.parseLast(res);
    return last ?? -1;
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};
    if (!currencies.includes('USD')) return priceHistory;

    try {
      // Calculate start date based on type
      const now = new Date();
      const startDate = new Date(now.getTime() - (type === 'hour' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000));
      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const gran = type === 'hour' ? '1h' : '1d';
      const res = await query(this.urlHist.replace('{START_DATE}', startDateStr).replace('{GRANULARITY}', gran));
      const historical = this.parseHistorical(res);

      for (const { t, close } of historical) {
        if (!priceHistory[t]) priceHistory[t] = priceUpdater.getEmptyPricesObj();
        priceHistory[t]['USD'] = close;
      }
    } catch (error) {
      // CoinPaprika historical data requires paid plan (402 error)
      // Return empty history - the current price will still work
      console.log('CoinPaprika historical data requires paid plan:', error);
    }
    return priceHistory;
  }
}

export default CoinPaprikaApi;
