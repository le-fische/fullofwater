import { CockpitRig } from './types';
import { GtCockpit } from './gt-cockpit';
import { F1Cockpit } from './f1-cockpit';
import { PrototypeCockpit } from './prototype-cockpit';

export class CockpitFactory {
  static createCockpit(typeOrClass: string): CockpitRig {
    const normalized = typeOrClass.toLowerCase();

    if (normalized.includes('f1') || normalized.includes('formula') || normalized.includes('open')) {
      return new F1Cockpit();
    }

    if (
      normalized.includes('hypercar') ||
      normalized.includes('prototype') ||
      normalized.includes('lmdh') ||
      normalized.includes('lmp')
    ) {
      return new PrototypeCockpit();
    }

    // Default to GT Cockpit (GTE, GT3, GT4, Touring cars, Porsche 911 RSR)
    return new GtCockpit();
  }
}
