import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

type Fiat = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD';

type SimplePriceResp = Record<string, Record<string, number>>;
interface MarketChartResp {
  prices?: [number, number][];          // [ms, price]
  market_caps?: [number, number][];
  total_volumes?: [number, number][];
}

function isSimplePriceResp(x: unknown): x is SimplePriceResp {
  return !!x && typeof x === 'object';
}

function getPricesArray(x: unknown): [number, number][] {
  if (x && typeof x === 'object' && 'prices' in x) {
    const arr = (x as MarketChartResp).prices;
    if (Array.isArray(arr)) return arr as [number, number][];
  }
  return [];
}

class CoinGeckoApi implements PriceFeed {
  public name = 'CoinGecko';
  public currencies: Fiat[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD'];

  private id = 'meowcoin';
  private base = 'https://api.coingecko.com/api/v3';

  // keeping these for parity with your other feeds
  public url     = `${this.base}/simple/price?ids=${this.id}&vs_currencies={CURRENCY}`;
  public urlHist = `${this.base}/coins/${this.id}/market_chart?vs_currency={CURRENCY}&days={DAYS}&interval={INTERVAL}`;

  private toLower(c: string) { return c.toLowerCase(); }

  public async $fetchPrice(currency: Fiat): Promise<number> {
    if (!this.currencies.includes(currency)) return -1;

    const url = this.url.replace('{CURRENCY}', this.toLower(currency));
    const res = await query(url); // unknown/object

    if (isSimplePriceResp(res)) {
      const v = res?.[this.id]?.[this.toLower(currency)];
      return typeof v === 'number' ? v : -1;
    }
    return -1;
  }

  public async $fetchRecentPrice(
    currencies: Fiat[],
    type: 'hour' | 'day'
  ): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    for (const currency of currencies) {
      if (!this.currencies.includes(currency)) continue;

      const vs = this.toLower(currency);
      const days = type === 'hour' ? '1' : '30';
      const interval = type === 'hour' ? 'hourly' : 'daily';

      const url = this.urlHist
        .replace('{CURRENCY}', vs)
        .replace('{DAYS}', days)
        .replace('{INTERVAL}', interval);

      const res = await query(url); // unknown/object
      const points = getPricesArray(res); // [ms, price][]

      for (const [ms, price] of points) {
        const t = Math.round(ms / 1000); // seconds
        if (!priceHistory[t]) priceHistory[t] = priceUpdater.getEmptyPricesObj();
        priceHistory[t][currency] = price;
      }
    }

    return priceHistory;
  }
}

export default CoinGeckoApi;
