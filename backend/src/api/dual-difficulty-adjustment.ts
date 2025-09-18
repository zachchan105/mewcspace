import config from '../config';
import blocks from './blocks';
import bitcoinClient from './bitcoin/bitcoin-client';
import logger from '../logger';

export interface DualDifficultyAdjustment {
  meowpow: {
    currentDifficulty: number;
    difficultyChange: number;
    slope: number;
    timingRatio: number;
    avgBlockTime: number;
    algorithm: string;
    lastUpdate: number;
    auxpowActive: boolean;
  };
  scrypt: {
    currentDifficulty: number;
    difficultyChange: number;
    slope: number;
    timingRatio: number;
    avgBlockTime: number;
    algorithm: string;
    lastUpdate: number;
    auxpowActive: boolean;
  };
}

class DualDifficultyAdjustmentApi {
  private cachedData: DualDifficultyAdjustment | null = null;
  private lastUpdateTime = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  public getDualDifficultyAdjustment(): DualDifficultyAdjustment | null {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (this.cachedData && (now - this.lastUpdateTime) < this.CACHE_DURATION) {
      return this.cachedData;
    }

    // Calculate fresh data
    this.cachedData = this.calculateDualDifficultyAdjustment();
    this.lastUpdateTime = now;
    
    return this.cachedData;
  }

  private calculateDualDifficultyAdjustment(): DualDifficultyAdjustment {
    const blocksCache = blocks.getBlocks();
    const latestBlock = blocksCache[blocksCache.length - 1];
    
    if (!latestBlock) {
      return this.getDefaultData();
    }

    // Debug: Log some block versions to understand the pattern
    if (blocksCache.length > 0) {
      const recentVersions = blocksCache.slice(-5).map(b => ({ height: b.height, version: b.version.toString(16) }));
      logger.debug(`Recent block versions: ${JSON.stringify(recentVersions)}`);
    }

    // Get MeowPow blocks (version 0x30090000)
    const meowpowBlocks = blocksCache.filter(block => block.version === 0x30090000);
    // Get Scrypt blocks (version 0x30090100) 
    const scryptBlocks = blocksCache.filter(block => block.version === 0x30090100);
    
    logger.debug(`Found ${meowpowBlocks.length} MeowPow blocks, ${scryptBlocks.length} Scrypt blocks out of ${blocksCache.length} total blocks`);

    return {
      meowpow: this.calculateAlgorithmData(meowpowBlocks, 'MeowPow', true),
      scrypt: this.calculateAlgorithmData(scryptBlocks, 'Scrypt', scryptBlocks.length > 0)
    };
  }

  private calculateAlgorithmData(algorithmBlocks: any[], algorithmName: string, auxpowActive: boolean): any {
    if (algorithmBlocks.length < 2) {
      logger.debug(`${algorithmName}: Not enough blocks (${algorithmBlocks.length}), returning default values`);
      return {
        currentDifficulty: 0,
        difficultyChange: 0,
        slope: 0,
        timingRatio: 1.0,
        avgBlockTime: 120,
        algorithm: algorithmName,
        lastUpdate: Math.floor(Date.now() / 1000),
        auxpowActive
      };
    }

    // Sort by height descending to get most recent first
    const sortedBlocks = algorithmBlocks.sort((a, b) => b.height - a.height);
    const recentBlocks = sortedBlocks.slice(0, 12);

    // Calculate difficulty change vs previous block
    const currentDifficulty = recentBlocks[0].difficulty;
    const previousDifficulty = recentBlocks[1].difficulty;
    const difficultyChange = previousDifficulty > 0 ? 
      ((currentDifficulty / previousDifficulty) - 1) * 100 : 0;

    // Calculate average block time from recent blocks
    let avgBlockTime = 120; // Target time
    if (recentBlocks.length >= 2) {
      const timeDiffs: number[] = [];
      for (let i = 0; i < recentBlocks.length - 1; i++) {
        const timeDiff = recentBlocks[i].timestamp - recentBlocks[i + 1].timestamp;
        if (timeDiff > 0) {
          timeDiffs.push(timeDiff);
        }
      }
      if (timeDiffs.length > 0) {
        avgBlockTime = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      }
    }

    // Calculate timing ratio and slope
    const timingRatio = avgBlockTime / 120;
    const slope = Math.max(-0.1, Math.min(0.1, timingRatio - 1));

    return {
      currentDifficulty: Number(currentDifficulty),
      difficultyChange: Number(difficultyChange),
      slope: Number(slope),
      timingRatio: Number(timingRatio),
      avgBlockTime: Number(avgBlockTime),
      algorithm: algorithmName,
      lastUpdate: Math.floor(Date.now() / 1000),
      auxpowActive
    };
  }

  private getDefaultData(): DualDifficultyAdjustment {
    return {
      meowpow: {
        currentDifficulty: 0,
        difficultyChange: 0,
        slope: 0,
        timingRatio: 1.0,
        avgBlockTime: 120,
        algorithm: 'MeowPow',
        lastUpdate: Math.floor(Date.now() / 1000),
        auxpowActive: true
      },
      scrypt: {
        currentDifficulty: 0,
        difficultyChange: 0,
        slope: 0,
        timingRatio: 1.0,
        avgBlockTime: 120,
        algorithm: 'Scrypt',
        lastUpdate: Math.floor(Date.now() / 1000),
        auxpowActive: false
      }
    };
  }

  // Method to invalidate cache when new blocks arrive
  public invalidateCache(): void {
    this.cachedData = null;
    this.lastUpdateTime = 0;
  }
}

export default new DualDifficultyAdjustmentApi();
