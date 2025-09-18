import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';

@Component({
  selector: 'app-dual-hashrate-chart',
  templateUrl: './dual-hashrate-chart.component.html',
  styleUrls: ['./dual-hashrate-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DualHashrateChartComponent implements OnInit {
  @Input() tableOnly = false;
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  selectedAlgorithm: 'meowpow' | 'scrypt' = 'meowpow';

  constructor(public stateService: StateService) { }

  ngOnInit(): void {
    // Subscribe to dual difficulty data to get current algorithm stats
    this.stateService.dualDifficultyAdjustment$.subscribe((data) => {
      if (data) {
        // Default to MeowPow if it's active, otherwise Scrypt
        this.selectedAlgorithm = data.meowpow.auxpowActive ? 'meowpow' : 'scrypt';
      }
    });
  }

  selectAlgorithm(algorithm: 'meowpow' | 'scrypt'): void {
    this.selectedAlgorithm = algorithm;
  }

  getAlgorithmDisplayName(algorithm: 'meowpow' | 'scrypt'): string {
    return algorithm === 'scrypt' ? 'Scrypt' : 'MeowPow';
  }
}
