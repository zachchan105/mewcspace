import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface LwmaCardData {
  // from your fixed backend
  currentDifficulty: number;      // e.g. 123456
  difficultyChange: number;       // % vs previous block (can be +/-)
  nextBlockImpact: number;        // % estimate (sign = direction)
  slope: number;                  // normalized momentum, e.g. -0.1..+0.1
  timingRatio: number;            // avgSolve / targetSecs, e.g. 0.95..1.05
  avgBlockTime: number;           // seconds
  lastUpdate: number;             // epoch seconds
  auxpowActive?: boolean;         // for scrypt card
  stale?: boolean;                // if backend fell back
}

@Component({
  selector: 'app-pow-card',
  templateUrl: './pow-card.component.html',
  styleUrls: ['./pow-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PowCardComponent {
  @Input() label = '';
  @Input() icon = '';
  @Input() targetSecs = 60;
  @Input() windowSize = 45;
  @Input() data!: LwmaCardData;

  // center-out momentum bar: slope ∈ [-0.1, +0.1]
  // intensity is how far from center we fill, 0..50% (not 0..100%)
  intensityPercent(d: LwmaCardData): number {
    const s = Math.max(-0.1, Math.min(0.1, d.slope ?? 0));
    return Math.min(50, (Math.abs(s) / 0.1) * 50); // 0..50
  }
  momentumSide(d: LwmaCardData) { return (d.slope ?? 0) >= 0 ? 'right' : 'left'; }

  pacePercent(d: LwmaCardData): number {
    // map timingRatio 0.5..1.5 to 0..100 (needle position on subtle pace axis)
    const r = Math.max(0.5, Math.min(1.5, d.timingRatio || 1));
    return (r - 0.5) * 100;
  }

  fmtDiff(x = 0): string {
    if (!isFinite(x) || x <= 0) return '0';
    if (x >= 1e12) return (x / 1e12).toFixed(2) + 'T';
    if (x >= 1e9)  return (x / 1e9 ).toFixed(2) + 'B';
    if (x >= 1e6)  return (x / 1e6 ).toFixed(2) + 'M';
    if (x >= 1e3)  return (x / 1e3 ).toFixed(2) + 'K';
    return x.toFixed(2);
  }
  fmtAgo(ts = 0): string {
    const s = Math.max(0, Math.floor(Date.now()/1000) - ts);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  }
  upClass(v = 0)   { return v >  0 ? 'up'   : v < 0 ? 'down' : 'flat'; }
  muted(d: LwmaCardData) { return !!d.stale || d.auxpowActive === false; }
}
