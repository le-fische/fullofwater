import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  public rapier!: typeof RAPIER;
  public world!: RAPIER.World;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await RAPIER.init();
    this.rapier = RAPIER;

    // Standard gravity 9.81 m/s^2 downwards
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);

    // Fixed timestep 240 Hz per spec (dt = 0.0041666s)
    this.world.timestep = 1.0 / 240.0;
    this.initialized = true;
  }

  step(): void {
    if (!this.initialized) return;
    this.world.step();
  }

  isReady(): boolean {
    return this.initialized;
  }
}
