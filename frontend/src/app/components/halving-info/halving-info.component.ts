import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '../../services/state.service';

interface HalvingInfo {
  blocksUntilHalving: number;
  timeUntilHalving: number;
}

@Component({
  selector: 'app-halving-info',
  templateUrl: './halving-info.component.html',
  styleUrls: ['./halving-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HalvingInfoComponent implements OnInit {
  halvingInfo$: Observable<HalvingInfo>;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.halvingInfo$ = this.stateService.blocks$.pipe(
      map(([block]) => {
        // Meowcoin halving every 2,100,000 blocks
        const blocksUntilHalving = 2100000 - (block.height % 2100000);
        // Meowcoin block time: 60 seconds (1 minute)
        const timeUntilHalving = new Date().getTime() + (blocksUntilHalving * 60000);

        return {
          blocksUntilHalving,
          timeUntilHalving,
        };
      })
    );
  }
}
