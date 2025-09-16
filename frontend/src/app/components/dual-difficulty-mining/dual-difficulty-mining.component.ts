import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';

interface DualPowData {
  difficulty: number;
  hashrate: number;
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
    this.dualPowStats$ = this.apiService.getDualPowStats$();
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
}
