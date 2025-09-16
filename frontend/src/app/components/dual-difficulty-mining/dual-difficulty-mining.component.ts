import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';

interface DualPowData {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  previousTime: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
  expectedBlocks: number;
  algorithm: string;
  auxpowActive?: boolean;
}

interface DualPowStats {
  meowpow: DualPowData;
  scrypt: DualPowData;
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

  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = true;

  constructor(
    public stateService: StateService,
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.isLoading$ = this.stateService.isLoadingWebSocket$;
    this.dualPowStats$ = this.apiService.getDualDifficultyAdjustment$();
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

  formatDifficulty(difficulty: number): string {
    if (difficulty === 0) return '0';
    
    const units = ['', 'K', 'M', 'B', 'T'];
    let unitIndex = 0;
    let value = difficulty;
    
    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }
    
    return `${value.toFixed(2)}${units[unitIndex]}`;
  }

  getDifficultyChangeColor(difficultyChange: number): string {
    if (difficultyChange > 0) {
      return '#3bcc49'; // Green for increase
    } else if (difficultyChange < 0) {
      return '#dc3545'; // Red for decrease
    } else {
      return '#ffffff66'; // Gray for no change
    }
  }

  getPreviousRetargetColor(previousRetarget: number): string {
    if (previousRetarget > 0) {
      return '#3bcc49'; // Green for increase
    } else if (previousRetarget < 0) {
      return '#dc3545'; // Red for decrease
    } else {
      return '#ffffff66'; // Gray for no change
    }
  }

  getProgressBarWidth(progressPercent: number): string {
    return `${Math.min(100, Math.max(0, progressPercent))}%`;
  }

  formatTimeUntilRetarget(estimatedRetargetDate: number): string {
    const now = new Date().getTime();
    const timeUntil = estimatedRetargetDate - now;
    
    if (timeUntil <= 0) return 'Now';
    
    const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}
