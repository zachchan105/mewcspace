// src/services/feeds/coingecko-api.ts

import logger from '../../logger';
import PricesRepository from '../../repositories/PricesRepository';
import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

type Fiat = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD';

type SimplePriceResp = Record<string, Record<string, number>>;
interface MarketChartResp {
  prices?: [number, number][];      // [ms, price]
  market_caps?: [number, number][];
  total_volumes?: [number, number][];
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

function isSimplePriceResp(x: unknown): x is SimplePriceResp {
  return isObject(x);
}

function getPricesArray(x: unknown): [number, number][] {
  if (isObject(x) && 'prices' in x) {
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

  // Parity with your other feeds
  public url     = `${this.base}/simple/price?ids=${this.id}&vs_currencies={CURRENCY}`;
  public urlHist = `${this.base}/coins/${this.id}/market_chart?vs_currency={CURRENCY}&days={DAYS}&interval={INTERVAL}`;

  private toLower(c: string) { return c.toLowerCase(); }

  public async $fetchPrice(currency: Fiat): Promise<number> {
    if (!this.currencies.includes(currency)) return -1;

    const url = this.url.replace('{CURRENCY}', this.toLower(currency));
    const res = await query(url);

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

      const res = await query(url);
      const points = getPricesArray(res); // [ms, price][]

      for (const [ms, price] of points) {
        const t = Math.round(ms / 1000); // seconds
        if (!priceHistory[t]) priceHistory[t] = priceUpdater.getEmptyPricesObj();
        priceHistory[t][currency] = price;
      }
    }

    return priceHistory;
  }

  // ---------- Optional: weekly historical backfill (CoinGecko -> DB) ----------

  private weekBucket(tsSec: number): number {
    // Align to 7-day bucket (604800s)
    return Math.floor(tsSec / 604800) * 604800;
  }

  private async fetchDailyPointsAll(vs: string): Promise<[number, number][]> {
    // Full backfill (daily) – CoinGecko "max" history
    const url = `${this.base}/coins/${this.id}/market_chart?vs_currency=${vs}&days=max&interval=daily`;
    const res = await query(url);
    return getPricesArray(res);
  }

  private async fetchDailyPointsRange(vs: string, fromSec: number, toSec: number): Promise<[number, number][]> {
    // Incremental (range) – returns [ms, price] points
    const url = `${this.base}/coins/${this.id}/market_chart/range?vs_currency=${vs}&from=${fromSec}&to=${toSec}`;
    const res = await query(url);
    return getPricesArray(res);
  }

  /**
   * Fetch weekly price and save it into the database (USD required),
   * mirroring the pattern in your Kraken feed.
   *
   * - First run: full backfill with `days=max` (daily resolution).
   * - Subsequent runs: incremental using the range endpoint.
   * - For each week, we take the LAST daily price in that week (weekly close).
   */
  public async $insertHistoricalPrice(): Promise<void> {
    const existingPriceTimes = await PricesRepository.$getPricesTimes(); // number[] of weekly epoch seconds
    const nowSec = Math.floor(Date.now() / 1000);

    const isInitialBackfill = existingPriceTimes.length === 0;
    const lastExisting = isInitialBackfill ? 0 : Math.max(...existingPriceTimes);

    // Build a map: weekEpoch -> Prices object
    const weekly: Record<number, ReturnType<typeof priceUpdater.getEmptyPricesObj>> = {};

    for (const currency of this.currencies) {
      const vs = this.toLower(currency);

      let points: [number, number][] = [];
      if (isInitialBackfill) {
        points = await this.fetchDailyPointsAll(vs); // [ms, price]
      } else {
        // Fetch only new data since last stored week; subtract a week to catch boundary overlaps
        const fromSec = Math.max(0, lastExisting - 604800);
        points = await this.fetchDailyPointsRange(vs, fromSec, nowSec);
      }

      // Convert to seconds, bucket into weeks, and keep the LAST price per week (weekly close)
      const weeklyLast: Map<number, number> = new Map();
      for (const [ms, price] of points) {
        const tSec = Math.round(ms / 1000);
        const bucket = this.weekBucket(tSec);
        weeklyLast.set(bucket, price); // the latest point in the bucket wins
      }

      // Merge into multi-currency weekly map
      for (const [bucket, price] of weeklyLast.entries()) {
        if (!weekly[bucket]) weekly[bucket] = priceUpdater.getEmptyPricesObj();
        weekly[bucket][currency] = price;
      }
    }

    // Prepare rows to insert: skip existing buckets; require USD present
    const toInsert: Array<[number, ReturnType<typeof priceUpdater.getEmptyPricesObj>]> = [];
    for (const timeStr of Object.keys(weekly)) {
      const time = parseInt(timeStr, 10);
      if (existingPriceTimes.includes(time)) continue;

      const row = weekly[time];
      if (row.USD === -1) continue; // require USD like Kraken logic

      toInsert.push([time, row]);
    }

    for (const [time, row] of toInsert) {
      await PricesRepository.$savePrices(time, row);
    }

    if (toInsert.length > 0) {
      logger.info(
        `Inserted ${toInsert.length} CoinGecko (MEWC) weekly price rows into db`,
        logger.tags.mining
      );
    }
  }
}

export default CoinGeckoApi;
