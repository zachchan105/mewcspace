import { Application, Request, Response } from 'express';
import config from "../../config";
import logger from '../../logger';
import BlocksAuditsRepository from '../../repositories/BlocksAuditsRepository';
import BlocksRepository from '../../repositories/BlocksRepository';
import DifficultyAdjustmentsRepository from '../../repositories/DifficultyAdjustmentsRepository';
import HashratesRepository from '../../repositories/HashratesRepository';
import bitcoinClient from '../bitcoin/bitcoin-client';
import mining from "./mining";
import PricesRepository from '../../repositories/PricesRepository';
import blocks from '../blocks';

class MiningRoutes {
  public initRoutes(app: Application) {
    app
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/:interval', this.$getPools)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/hashrate', this.$getPoolHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks', this.$getPoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks/:height', this.$getPoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug', this.$getPool)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/pools/:interval', this.$getPoolsHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/:interval', this.$getHistoricalHashrate)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/difficulty-adjustments', this.$getDifficultyAdjustments)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/reward-stats/:blockCount', this.$getRewardStats)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fees/:interval', this.$getHistoricalBlockFees)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/rewards/:interval', this.$getHistoricalBlockRewards)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fee-rates/:interval', this.$getHistoricalBlockFeeRates)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/sizes-weights/:interval', this.$getHistoricalBlockSizeAndWeight)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/difficulty-adjustments/:interval', this.$getDifficultyAdjustments)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/predictions/:interval', this.$getHistoricalBlocksHealth)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/audit/scores', this.$getBlockAuditScores)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/audit/scores/:height', this.$getBlockAuditScores)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/audit/score/:hash', this.$getBlockAuditScore)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/audit/:hash', this.$getBlockAudit)
      .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/timestamp/:timestamp', this.$getHeightFromTimestamp)
      .get(config.MEMPOOL.API_URL_PREFIX + 'historical-price', this.$getHistoricalPrice)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/dual-pow-stats', this.$getDualPowStats)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/dual-difficulty-adjustment', this.$getDualDifficultyAdjustment)
    ;
  }

  private async $getHistoricalPrice(req: Request, res: Response): Promise<void> {
    try {
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      if (req.query.timestamp) {
        res.status(200).send(await PricesRepository.$getNearestHistoricalPrice(
          parseInt(<string>req.query.timestamp ?? 0, 10)
        ));
      } else {
        res.status(200).send(await PricesRepository.$getHistoricalPrices());
      }
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getPool(req: Request, res: Response): Promise<void> {
    try {
      const stats = await mining.$getPoolStat(req.params.slug);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getPoolBlocks(req: Request, res: Response) {
    try {
      const poolBlocks = await BlocksRepository.$getBlocksByPool(
        req.params.slug,
        req.params.height === undefined ? undefined : parseInt(req.params.height, 10),
      );
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(poolBlocks);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getPools(req: Request, res: Response) {
    try {
      const stats = await mining.$getPoolsStats(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(stats);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getPoolsHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolsWeeklyHashrate(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getPoolHistoricalHashrate(req: Request, res: Response) {
    try {
      const hashrates = await HashratesRepository.$getPoolWeeklyHashrate(req.params.slug);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(hashrates);
    } catch (e) {
      if (e instanceof Error && e.message.indexOf('This mining pool does not exist') > -1) {
        res.status(404).send(e.message);
      } else {
        res.status(500).send(e instanceof Error ? e.message : e);
      }
    }
  }

  private async $getHistoricalHashrate(req: Request, res: Response) {
    let currentHashrate = 0, currentDifficulty = 0;
    try {
      currentHashrate = await bitcoinClient.getNetworkHashPs();
      currentDifficulty = await bitcoinClient.getDifficulty();
    } catch (e) {
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate and difficulty');
    }

    try {
      const hashrates = await HashratesRepository.$getNetworkDailyHashrate(req.params.interval);
      const difficulty = await DifficultyAdjustmentsRepository.$getAdjustments(req.params.interval, false);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json({
        hashrates: hashrates,
        difficulty: difficulty,
        currentHashrate: currentHashrate,
        currentDifficulty: currentDifficulty,
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockFees(req: Request, res: Response) {
    try {
      const blockFees = await mining.$getHistoricalBlockFees(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockFees);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockRewards(req: Request, res: Response) {
    try {
      const blockRewards = await mining.$getHistoricalBlockRewards(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockRewards);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockFeeRates(req: Request, res: Response) {
    try {
      const blockFeeRates = await mining.$getHistoricalBlockFeeRates(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blockFeeRates);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHistoricalBlockSizeAndWeight(req: Request, res: Response) {
    try {
      const blockSizes = await mining.$getHistoricalBlockSizes(req.params.interval);
      const blockWeights = await mining.$getHistoricalBlockWeights(req.params.interval);
      const blockCount = await BlocksRepository.$blockCount(null, null);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json({
        sizes: blockSizes,
        weights: blockWeights
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getDifficultyAdjustments(req: Request, res: Response) {
    try {
      const difficulty = await DifficultyAdjustmentsRepository.$getRawAdjustments(req.params.interval, true);
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(difficulty.map(adj => [adj.time, adj.height, adj.difficulty, adj.adjustment]));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getRewardStats(req: Request, res: Response) {
    try {
      const response = await mining.$getRewardStats(parseInt(req.params.blockCount, 10));
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(response);
    } catch (e) {
      res.status(500).end();
    }
  }

  private async $getHistoricalBlocksHealth(req: Request, res: Response) {
    try {
      const blocksHealth = await mining.$getBlocksHealthHistory(req.params.interval);
      const blockCount = await BlocksAuditsRepository.$getBlocksHealthCount();
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.header('X-total-count', blockCount.toString());
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(blocksHealth.map(health => [health.time, health.height, health.match_rate]));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getBlockAudit(req: Request, res: Response) {
    try {
      const audit = await BlocksAuditsRepository.$getBlockAudit(req.params.hash);

      if (!audit) {
        res.status(204).send(`This block has not been audited.`);
        return;
      }

      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 3600 * 24).toUTCString());
      res.json(audit);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getHeightFromTimestamp(req: Request, res: Response) {
    try {
      const timestamp = parseInt(req.params.timestamp, 10);
      // This will prevent people from entering milliseconds etc.
      // Block timestamps are allowed to be up to 2 hours off, so 24 hours
      // will never put the maximum value before the most recent block
      const nowPlus1day = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      // Prevent non-integers that are not seconds
      if (!/^[1-9][0-9]*$/.test(req.params.timestamp) || timestamp > nowPlus1day) {
        throw new Error(`Invalid timestamp, value must be Unix seconds`);
      }
      const result = await BlocksRepository.$getBlockHeightFromTimestamp(
        timestamp,
      );
      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 300).toUTCString());
      res.json(result);
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getBlockAuditScores(req: Request, res: Response) {
    try {
      let height = req.params.height === undefined ? undefined : parseInt(req.params.height, 10);
      if (height == null) {
        height = await BlocksRepository.$mostRecentBlockHeight();
      }
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString());
      res.json(await BlocksAuditsRepository.$getBlockAuditScores(height, height - 15));
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  public async $getBlockAuditScore(req: Request, res: Response) {
    try {
      const audit = await BlocksAuditsRepository.$getBlockAuditScore(req.params.hash);

      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 3600 * 24).toUTCString());
      res.json(audit || 'null');
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getDualPowStats(req: Request, res: Response): Promise<void> {
    try {
      let meowpowDifficulty = 0, scryptDifficulty = 0;
      let meowpowHashrate = 0, scryptHashrate = 0;

      try {
        meowpowDifficulty = await bitcoinClient.getDifficulty(0);
        scryptDifficulty = await bitcoinClient.getDifficulty(1);
        meowpowHashrate = await bitcoinClient.getNetworkHashPs(0, -1, 0);
        scryptHashrate = await bitcoinClient.getNetworkHashPs(0, -1, 1);
      } catch (e) {
        logger.debug('Bitcoin Core is not available, using zeroed values for dual PoW stats');
      }

      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 60).toUTCString()); // 1 minute cache
      res.json({
        meowpow: { 
          difficulty: meowpowDifficulty, 
          hashrate: meowpowHashrate,
          algorithm: 'MeowPow'
        },
        scrypt: { 
          difficulty: scryptDifficulty, 
          hashrate: scryptHashrate,
          algorithm: 'Scrypt',
          // If scrypt hashrate is 0, auxpow hasn't started yet
          auxpowActive: scryptHashrate > 0
        }
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private async $getDualDifficultyAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const currentHeight = blocks.getCurrentBlockHeight();
      const nowSeconds = Math.floor(new Date().getTime() / 1000);
      
      // Get difficulty adjustment data for MeowPow (algorithm 0)
      const meowpowDA = this.calculateDifficultyAdjustment(0, currentHeight, nowSeconds);
      
      // Get difficulty adjustment data for Scrypt (algorithm 1) 
      const scryptDA = this.calculateDifficultyAdjustment(1, currentHeight, nowSeconds);

      // Check if Scrypt is active by getting hashrate
      let scryptHashrate = 0;
      try {
        scryptHashrate = await bitcoinClient.getNetworkHashPs(0, -1, 1);
      } catch (e) {
        // If we can't get hashrate, assume it's not active
      }

      res.header('Pragma', 'public');
      res.header('Cache-control', 'public');
      res.setHeader('Expires', new Date(Date.now() + 1000 * 30).toUTCString()); // 30 second cache
      res.json({
        meowpow: { ...meowpowDA, auxpowActive: true },
        scrypt: { ...scryptDA, auxpowActive: scryptHashrate > 0 }
      });
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : e);
    }
  }

  private calculateDifficultyAdjustment(algorithm: number, blockHeight: number, nowSeconds: number): any {
    const EPOCH_BLOCK_LENGTH = 2016;
    const BLOCK_SECONDS_TARGET = 60; // Meowcoin block time
    
    // For now, we'll use the same difficulty adjustment logic for both algorithms
    // In the future, this should be algorithm-specific
    const DATime = blocks.getLastDifficultyAdjustmentTime();
    const previousRetarget = blocks.getPreviousDifficultyRetarget();
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];
    
    if (!latestBlock) {
      return {
        progressPercent: 0,
        difficultyChange: 0,
        estimatedRetargetDate: 0,
        remainingBlocks: 0,
        remainingTime: 0,
        previousRetarget: 0,
        previousTime: 0,
        nextRetargetHeight: 0,
        timeAvg: 0,
        timeOffset: 0,
        expectedBlocks: 0,
        algorithm: algorithm === 0 ? 'MeowPow' : 'Scrypt'
      };
    }

    const diffSeconds = Math.max(0, nowSeconds - DATime);
    const blocksInEpoch = (blockHeight >= 0) ? blockHeight % EPOCH_BLOCK_LENGTH : 0;
    const progressPercent = (blockHeight >= 0) ? blocksInEpoch / EPOCH_BLOCK_LENGTH * 100 : 100;
    const remainingBlocks = EPOCH_BLOCK_LENGTH - blocksInEpoch;
    const nextRetargetHeight = (blockHeight >= 0) ? blockHeight + remainingBlocks : 0;
    const expectedBlocks = diffSeconds / BLOCK_SECONDS_TARGET;
    const actualTimespan = (blocksInEpoch === 2015 ? latestBlock.timestamp : nowSeconds) - DATime;

    let difficultyChange = 0;
    let timeAvgSecs = blocksInEpoch ? diffSeconds / blocksInEpoch : BLOCK_SECONDS_TARGET;

    difficultyChange = (BLOCK_SECONDS_TARGET / (actualTimespan / (blocksInEpoch + 1)) - 1) * 100;
    
    // Max increase is x4 (+300%)
    if (difficultyChange > 300) {
      difficultyChange = 300;
    }
    // Max decrease is /4 (-75%)
    if (difficultyChange < -75) {
      difficultyChange = -75;
    }

    const timeAvg = Math.floor(timeAvgSecs * 1000);
    const remainingTime = remainingBlocks * timeAvg;
    const estimatedRetargetDate = remainingTime + nowSeconds * 1000;

    return {
      progressPercent,
      difficultyChange,
      estimatedRetargetDate,
      remainingBlocks,
      remainingTime,
      previousRetarget,
      previousTime: 0, // Not used in current implementation
      nextRetargetHeight,
      timeAvg,
      timeOffset: 0, // Not used in current implementation
      expectedBlocks,
      algorithm: algorithm === 0 ? 'MeowPow' : 'Scrypt'
    };
  }
}

export default new MiningRoutes();
