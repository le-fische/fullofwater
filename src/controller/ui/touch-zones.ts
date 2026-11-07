export interface TouchState {
  throttle: number; // 0 or 1
  brake: number;    // 0 or 1
  rearView: boolean;
  resetTriggered: boolean;
  cameraTriggered: boolean;
}

export class TouchZones {
  private element: HTMLElement;
  private activeTouches = new Map<number, { x: number; y: number; zone: 'brake' | 'center' | 'throttle' }>();
  private rearViewHeld = false;
  private resetPendingTicks = 0;
  private cameraPendingTicks = 0;
  private onStateChange?: (state: TouchState) => void;

  constructor(element: HTMLElement, onStateChange?: (state: TouchState) => void) {
    this.element = element;
    this.onStateChange = onStateChange;

    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);

    this.bindEvents();
    this.setupRearViewButton();
  }

  private setupRearViewButton(): void {
    const btn = document.getElementById('btn-rear-view');
    if (!btn) return;

    const startHold = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.rearViewHeld = true;
      btn.classList.add('active');
      this.emitState();
    };

    const endHold = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.rearViewHeld = false;
      btn.classList.remove('active');
      this.emitState();
    };

    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', endHold);
    btn.addEventListener('pointercancel', endHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', endHold, { passive: false });
    btn.addEventListener('touchcancel', endHold, { passive: false });
    btn.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', endHold);
  }

  private bindEvents(): void {
    const el = this.element;
    el.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    el.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    el.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });

    // Desktop mouse click testing
    el.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, .ctrl-btn, .rear-view-btn')) return;

      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      let zone: 'brake' | 'center' | 'throttle' = 'center';
      if (relX < rect.width / 3) zone = 'brake';
      else if (relX > (rect.width * 2) / 3) zone = 'throttle';

      this.activeTouches.set(999, {
        x: e.clientX,
        y: e.clientY,
        zone,
      });
      this.emitState();
    });

    window.addEventListener('mouseup', () => {
      if (this.activeTouches.has(999)) {
        this.activeTouches.delete(999);
        this.emitState();
      }
    });
  }

  private classifyZone(clientX: number, rect: DOMRect): 'brake' | 'center' | 'throttle' {
    const relX = clientX - rect.left;
    const third = rect.width / 3;
    if (relX < third) return 'brake';
    if (relX > third * 2) return 'throttle';
    return 'center';
  }

  private handleTouchStart(e: TouchEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, .ctrl-btn, a, .rear-view-btn')) {
      // Let buttons receive touches directly
      return;
    }

    e.preventDefault();
    const rect = this.element.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const zone = this.classifyZone(touch.clientX, rect);
      this.activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        zone,
      });
    }

    this.emitState();
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.element.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const record = this.activeTouches.get(touch.identifier);
      if (record) {
        record.x = touch.clientX;
        record.y = touch.clientY;
        record.zone = this.classifyZone(touch.clientX, rect);
      }
    }

    this.emitState();
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
    this.emitState();
  }

  triggerReset(): void {
    this.resetPendingTicks = 6; // Latch for 6 ticks (~100ms) to guarantee arrival over network
  }

  triggerCamera(): void {
    this.cameraPendingTicks = 6; // Latch for 6 ticks (~100ms) to guarantee arrival over network
  }

  consumeButtons(): { reset: boolean; camera: boolean } {
    const res = {
      reset: this.resetPendingTicks > 0,
      camera: this.cameraPendingTicks > 0,
    };
    if (this.resetPendingTicks > 0) this.resetPendingTicks--;
    if (this.cameraPendingTicks > 0) this.cameraPendingTicks--;
    return res;
  }

  getState(): TouchState {
    let hasBrake = false;
    let hasThrottle = false;

    for (const touch of this.activeTouches.values()) {
      if (touch.zone === 'brake') hasBrake = true;
      if (touch.zone === 'throttle') hasThrottle = true;
    }

    let throttle = 0;
    let brake = 0;

    if (hasBrake) {
      brake = 1;
      throttle = 0; // Brake overrides
    } else if (hasThrottle) {
      throttle = 1;
    }

    return {
      throttle,
      brake,
      rearView: this.rearViewHeld,
      resetTriggered: this.resetPendingTicks > 0,
      cameraTriggered: this.cameraPendingTicks > 0,
    };
  }

  private emitState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}
