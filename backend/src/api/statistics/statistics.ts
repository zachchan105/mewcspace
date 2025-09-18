import memPool from '../mempool';
import logger from '../../logger';
import { TransactionExtended, OptimizedStatistic } from '../../mempool.interfaces';
import { Common } from '../common';
import statisticsApi from './statistics-api';

class Statistics {
  protected intervalTimer: NodeJS.Timer | undefined;
  protected newStatisticsEntryCallback: ((stats: OptimizedStatistic) => void) | undefined;

  public setNewStatisticsEntryCallback(fn: (stats: OptimizedStatistic) => void) {
    this.newStatisticsEntryCallback = fn;
  }

  public startStatistics(): void {
    logger.info('Starting statistics service');

    const now = new Date();
    const nextInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(),
      Math.floor(now.getMinutes() / 1) * 1 + 1, 0, 0);
    const difference = nextInterval.getTime() - now.getTime();

    setTimeout(() => {
      this.runStatistics();
      this.intervalTimer = setInterval(() => {
        this.runStatistics();
      }, 1 * 60 * 1000);
    }, difference);
  }

  private async runStatistics(): Promise<void> {
    if (!memPool.isInSync()) {
      return;
    }
    const currentMempool = memPool.getMempool();
    const txPerSecond = memPool.getTxPerSecond();
    const vBytesPerSecond = memPool.getVBytesPerSecond();

    logger.debug('Running statistics');

    let memPoolArray: TransactionExtended[] = [];
    for (const i in currentMempool) {
      if (currentMempool.hasOwnProperty(i)) {
        memPoolArray.push(currentMempool[i]);
      }
    }
    // Remove 0 and undefined
    memPoolArray = memPoolArray.filter((tx) => tx.effectiveFeePerVsize);

    if (!memPoolArray.length) {
      try {
        const insertIdZeroed = await statisticsApi.$createZeroedStatistic();
        if (this.newStatisticsEntryCallback && insertIdZeroed) {
          const newStats = await statisticsApi.$get(insertIdZeroed);
          if (newStats) {
            this.newStatisticsEntryCallback(newStats);
          }
        }
      } catch (e) {
        logger.err('Unable to insert zeroed statistics. ' + e);
      }
      return;
    }

    memPoolArray.sort((a, b) => a.effectiveFeePerVsize - b.effectiveFeePerVsize);
    const totalWeight = memPoolArray.map((tx) => tx.vsize).reduce((acc, curr) => acc + curr) * 4;
    const totalFee = memPoolArray.map((tx) => tx.fee).reduce((acc, curr) => acc + curr);

    // Meowcoin-appropriate fee thresholds (in MEWC/vB) - much lower than Bitcoin
    const logFees = [0.00001, 0.00002, 0.00003, 0.00004, 0.00005, 0.00006, 0.00008, 0.0001, 0.0002, 0.0003, 0.0004, 0.0005, 0.0006, 0.0008, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 2, 5];
    // Map to existing database field names (vsize_1, vsize_2, etc.)
    const dbFieldNames = ['vsize_1', 'vsize_2', 'vsize_3', 'vsize_4', 'vsize_5', 'vsize_6', 'vsize_8', 'vsize_10', 'vsize_12', 'vsize_15', 'vsize_20', 'vsize_30', 'vsize_40', 'vsize_50', 'vsize_60', 'vsize_70', 'vsize_80', 'vsize_90', 'vsize_100', 'vsize_125', 'vsize_150', 'vsize_175', 'vsize_200', 'vsize_250', 'vsize_300', 'vsize_350', 'vsize_400', 'vsize_500', 'vsize_600', 'vsize_700', 'vsize_800', 'vsize_900', 'vsize_1000', 'vsize_1200', 'vsize_1400', 'vsize_1600', 'vsize_1800', 'vsize_2000'];

    const weightVsizeFees: { [feePerWU: number]: number } = {};
    const lastItem = logFees.length - 1;

    memPoolArray.forEach((transaction) => {
      for (let i = 0; i < logFees.length; i++) {
        if (
          (Common.isLiquid() && (i === lastItem || transaction.effectiveFeePerVsize * 10 < logFees[i + 1]))
          ||
          (!Common.isLiquid() && (i === lastItem || transaction.effectiveFeePerVsize < logFees[i + 1]))
        ) {
          // Use database field names for storage
          const fieldName = dbFieldNames[i];
          if (weightVsizeFees[fieldName]) {
            weightVsizeFees[fieldName] += transaction.vsize;
          } else {
            weightVsizeFees[fieldName] = transaction.vsize;
          }
          break;
        }
      }
    });

    try {
      const insertId = await statisticsApi.$create({
        added: 'NOW()',
        unconfirmed_transactions: memPoolArray.length,
        tx_per_second: txPerSecond,
        vbytes_per_second: Math.round(vBytesPerSecond),
        mempool_byte_weight: totalWeight,
        total_fee: totalFee,
        fee_data: '',
        vsize_1: weightVsizeFees['1'] || 0,
        vsize_2: weightVsizeFees['2'] || 0,
        vsize_3: weightVsizeFees['3'] || 0,
        vsize_4: weightVsizeFees['4'] || 0,
        vsize_5: weightVsizeFees['5'] || 0,
        vsize_6: weightVsizeFees['6'] || 0,
        vsize_8: weightVsizeFees['8'] || 0,
        vsize_10: weightVsizeFees['10'] || 0,
        vsize_12: weightVsizeFees['12'] || 0,
        vsize_15: weightVsizeFees['15'] || 0,
        vsize_20: weightVsizeFees['20'] || 0,
        vsize_30: weightVsizeFees['30'] || 0,
        vsize_40: weightVsizeFees['40'] || 0,
        vsize_50: weightVsizeFees['50'] || 0,
        vsize_60: weightVsizeFees['60'] || 0,
        vsize_70: weightVsizeFees['70'] || 0,
        vsize_80: weightVsizeFees['80'] || 0,
        vsize_90: weightVsizeFees['90'] || 0,
        vsize_100: weightVsizeFees['100'] || 0,
        vsize_125: weightVsizeFees['125'] || 0,
        vsize_150: weightVsizeFees['150'] || 0,
        vsize_175: weightVsizeFees['175'] || 0,
        vsize_200: weightVsizeFees['200'] || 0,
        vsize_250: weightVsizeFees['250'] || 0,
        vsize_300: weightVsizeFees['300'] || 0,
        vsize_350: weightVsizeFees['350'] || 0,
        vsize_400: weightVsizeFees['400'] || 0,
        vsize_500: weightVsizeFees['500'] || 0,
        vsize_600: weightVsizeFees['600'] || 0,
        vsize_700: weightVsizeFees['700'] || 0,
        vsize_800: weightVsizeFees['800'] || 0,
        vsize_900: weightVsizeFees['900'] || 0,
        vsize_1000: weightVsizeFees['1000'] || 0,
        vsize_1200: weightVsizeFees['1200'] || 0,
        vsize_1400: weightVsizeFees['1400'] || 0,
        vsize_1600: weightVsizeFees['1600'] || 0,
        vsize_1800: weightVsizeFees['1800'] || 0,
        vsize_2000: weightVsizeFees['2000'] || 0,
      });

      if (this.newStatisticsEntryCallback && insertId) {
        const newStats = await statisticsApi.$get(insertId);
        if (newStats) {
          this.newStatisticsEntryCallback(newStats);
        }
      }
    } catch (e) {
      logger.err('Unable to insert statistics. ' + e);
    }
  }
}

export default new Statistics();
