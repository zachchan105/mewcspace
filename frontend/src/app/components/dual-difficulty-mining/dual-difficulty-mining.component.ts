import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '../../services/state.service';
import { LwmaCardData } from '../pow-card/pow-card.component';

interface DualPowStats {
  meowpow: LwmaCardData;
  scrypt: LwmaCardData;
}

@Component({
  selector: 'app-dual-difficulty-mining',
  templateUrl: './dual-difficulty-mining.component.html',
  styleUrls: ['./dual-difficulty-mining.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DualDifficultyMiningComponent implements OnInit {
  dualPowStats$: Observable<DualPowStats>;
  isLoading$: Observable<boolean>;
  selectedAlgorithm: 'meowpow' | 'scrypt' = 'meowpow';
  showChart = false;

  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = false;
  @Input() showChartToggle = false;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.isLoading$ = this.stateService.isLoadingWebSocket$;
    
    // Use WebSocket data directly (no HTTP requests, no loading states)
    this.dualPowStats$ = this.stateService.dualDifficultyAdjustment$.pipe(
      map((stats) => this.addDifficultyAdjustmentData(stats))
    );
  }

  selectAlgorithm(algorithm: 'meowpow' | 'scrypt'): void {
    this.selectedAlgorithm = algorithm;
  }

  toggleChart(): void {
    this.showChart = !this.showChart;
  }

  getAlgorithmDisplayName(algorithm: 'meowpow' | 'scrypt'): string {
    return algorithm === 'scrypt' ? 'Scrypt' : 'MeowPow';
  }

  formatHashrate(hashrate: number): string {
    if (hashrate === 0) return '0 H/s';
    
    const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
    let unitIndex = 0;
    let value = hashrate;
    
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }


  getDifficultyChangeColor(difficultyChange: number): string {
    if (difficultyChange > 0.3) {
      return '#3bcc49'; // Green for increase
    } else if (difficultyChange < -0.3) {
      return '#dc3545'; // Red for decrease
    } else {
      return '#ffffff66'; // Gray for no change
    }
  }

  getNextBlockImpactColor(nextBlockImpact: number): string {
    if (nextBlockImpact > 0.3) {
      return '#3bcc49'; // Green for increase
    } else if (nextBlockImpact < -0.3) {
      return '#dc3545'; // Red for decrease
    } else {
      return '#ffffff66'; // Gray for no change
    }
  }

  getTrendBarWidth(slope: number): string {
    // Convert slope (-0.1 to +0.1) to percentage (0 to 100)
    const percentage = ((slope + 0.1) / 0.2) * 100;
    return `${Math.min(100, Math.max(0, percentage))}%`;
  }

  getTrendBarDirection(slope: number): string {
    return slope > 0 ? 'right' : 'left';
  }

  getTrendBarColor(slope: number): string {
    if (slope > 0.05) {
      return '#3bcc49'; // Green for upward trend
    } else if (slope < -0.05) {
      return '#dc3545'; // Red for downward trend
    } else {
      return '#ffffff66'; // Gray for neutral
    }
  }

  formatDifficulty(difficulty: number): string {
    if (!difficulty || typeof difficulty !== 'number' || isNaN(difficulty)) {
      return '0';
    }
    
    if (difficulty >= 1e12) {
      return (difficulty / 1e12).toFixed(2) + 'T';
    } else if (difficulty >= 1e9) {
      return (difficulty / 1e9).toFixed(2) + 'B';
    } else if (difficulty >= 1e6) {
      return (difficulty / 1e6).toFixed(2) + 'M';
    } else if (difficulty >= 1e3) {
      return (difficulty / 1e3).toFixed(2) + 'K';
    } else {
      return difficulty.toFixed(2);
    }
  }

  formatLastUpdate(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) {
      return `${diff}s ago`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)}m ago`;
    } else {
      return `${Math.floor(diff / 3600)}h ago`;
    }
  }

  private addDifficultyAdjustmentData(stats: any): DualPowStats {
    if (!stats) {
      return {
        meowpow: this.getDefaultAlgorithmData('MeowPow', true),
        scrypt: this.getDefaultAlgorithmData('Scrypt', false)
      };
    }

    return {
      meowpow: {
        currentDifficulty: stats.meowpow?.currentDifficulty || 0,
        difficultyChange: stats.meowpow?.difficultyChange || 0,
        slope: stats.meowpow?.slope || 0,
        timingRatio: stats.meowpow?.timingRatio || 1.0,
        avgBlockTime: stats.meowpow?.avgBlockTime || 120,
        lastUpdate: stats.meowpow?.lastUpdate || Math.floor(Date.now() / 1000),
        auxpowActive: true
      },
      scrypt: {
        currentDifficulty: stats.scrypt?.currentDifficulty || 0,
        difficultyChange: stats.scrypt?.difficultyChange || 0,
        slope: stats.scrypt?.slope || 0,
        timingRatio: stats.scrypt?.timingRatio || 1.0,
        avgBlockTime: stats.scrypt?.avgBlockTime || 120,
        lastUpdate: stats.scrypt?.lastUpdate || Math.floor(Date.now() / 1000),
        auxpowActive: stats.scrypt?.auxpowActive || false
      }
    };
  }

  private getDefaultAlgorithmData(algorithm: string, auxpowActive: boolean): LwmaCardData {
    return {
      currentDifficulty: 0,
      difficultyChange: 0,
      slope: 0,
      timingRatio: 1.0,
      avgBlockTime: 120,
      lastUpdate: Math.floor(Date.now() / 1000),
      auxpowActive
    };
  }
}
