import { OneEuroFilter } from '../../common/math';

export class SteeringFilter {
  private filter: OneEuroFilter;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.filter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  process(steerValue: number, timestampSec: number): number {
    return this.filter.filter(steerValue, timestampSec);
  }

  reset(): void {
    this.filter.reset();
  }
}
