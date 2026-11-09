import * as THREE from 'three';
import { EnvironmentState, WeatherCondition } from '../../common/types';

/**
 * Custom GLSL vertex & fragment shaders for the Windshield Droplet Distortion & Wiper Sweep effect.
 */
const WINDSHIELD_DROPLET_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const WINDSHIELD_DROPLET_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uRainIntensity;
  uniform float uSpeedKmh;
  uniform float uWiperAngle;
  uniform float uCockpitFactor;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Procedural raindrop layer with sliding trails
  vec3 dropletLayer(vec2 uv, float t, float scale) {
    vec2 aspect = vec2(2.0, 1.0);
    vec2 gridUv = uv * scale * aspect;
    // Airflow pushes droplets upward at high speed, gravity pulls downward at low speed
    float verticalFlow = mix(1.2, -1.8, clamp(uSpeedKmh / 220.0, 0.0, 1.0));
    gridUv.y += t * verticalFlow;

    vec2 id = floor(gridUv);
    vec2 localUv = fract(gridUv) - 0.5;

    float n = hash21(id);
    t += n * 6.283185;

    float dropX = (n - 0.5) * 0.65;
    float wiggle = sin(t + sin(t + sin(t) * 0.5)) * 0.15;
    dropX += wiggle * (0.5 - abs(dropX));

    float dropY = -sin(t * 0.85) * 0.35;
    vec2 dropPos = vec2(dropX, dropY);
    vec2 delta = (localUv - dropPos) / aspect;
    float d = length(delta);

    float mainDrop = smoothstep(0.18, 0.02, d);

    // Micro bead trail
    vec2 trailDelta = (localUv - vec2(dropX, t * 0.15)) / aspect;
    trailDelta.y = (fract(trailDelta.y * 4.0) - 0.5) / 4.0;
    float trailDrop = smoothstep(0.09, 0.01, length(trailDelta)) *
                      smoothstep(-0.05, 0.35, localUv.y - dropPos.y) *
                      smoothstep(0.45, dropPos.y, localUv.y);

    float combined = max(mainDrop, trailDrop * 0.75);
    vec2 normalOffset = delta * combined * 6.0;
    return vec3(normalOffset, combined);
  }

  void main() {
    if (uRainIntensity <= 0.01 || uCockpitFactor <= 0.5) {
      discard;
    }

    // Keep the lower cockpit (steering wheel, dashboard, center console: vUv.y < 0.50)
    // and the central road sightline 100% clear so rain never obscures driving visibility
    if (vUv.y < 0.50) {
      discard;
    }
    vec2 sightCenter = vec2(0.5, 0.66);
    float distFromSight = length((vUv - sightCenter) * vec2(1.1, 1.6));
    float peripheralMask = smoothstep(0.32, 0.68, distFromSight);
    if (peripheralMask <= 0.01) {
      discard;
    }

    vec3 layer1 = dropletLayer(vUv, uTime * 1.15, 14.0);
    vec3 layer2 = dropletLayer(vUv + vec2(0.37, 0.61), uTime * 1.55, 22.0);
    vec2 normal = layer1.xy + layer2.xy * 0.7;
    float mask = clamp(layer1.z + layer2.z * 0.75, 0.0, 1.0) * uRainIntensity * peripheralMask;

    float fresnel = clamp(length(normal) * 1.6, 0.0, 1.0);
    vec3 dropColor = mix(vec3(0.76, 0.86, 0.96), vec3(0.95, 0.98, 1.0), fresnel);
    float alpha = clamp(mask * 0.12, 0.0, 0.14);

    gl_FragColor = vec4(dropColor, alpha);
  }
`;

/**
 * Phase 3.3 Dynamic Environment & Weather Manager:
 * - Modular day/night lighting cycle via directional sun progression
 * - Working vehicle headlight integration & automatic dusk/rain trigger
 * - Procedural 3D rain particle emitter around the active camera
 * - Windshield droplet distortion & animated wiper shader overlay
 */
export class EnvironmentManager {
  private scene: THREE.Scene;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;

  private state: EnvironmentState = {
    timeOfDayHours: 14.0,     // 14:00 afternoon start
    timeScale: 60.0,          // 1 real second = 1 game minute when cycling
    weather: 'clear',
    rainIntensity: 0.0,
    ambientTrackWetness: 0.0,
    headlightsOn: false,
  };

  private autoCycleTime = false;
  private manualHeadlightOverride: boolean | null = null;
  private elapsedShaderTime = 0;

  // Procedural 3D Rain Particle Emitter (LineSegments around camera)
  private rainCount = 1600;
  private rainSegments!: THREE.LineSegments;
  private rainPositions!: Float32Array;
  private rainBasePositions!: Float32Array;
  private rainMaterial!: THREE.LineBasicMaterial;

  // Windshield Droplet Shader Overlay
  private windshieldQuad!: THREE.Mesh;
  private windshieldMaterial!: THREE.ShaderMaterial;

  // Color reusable scratchpad
  private skyColor = new THREE.Color();
  private sunColor = new THREE.Color();
  private groundColor = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    dirLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight
  ) {
    this.scene = scene;
    this.dirLight = dirLight;
    this.hemiLight = hemiLight;

    if (scene.fog instanceof THREE.FogExp2) {
      this.fog = scene.fog;
    } else {
      this.fog = new THREE.FogExp2(0x94a3b8, 0.00055);
      this.scene.fog = this.fog;
    }

    this.initRainEmitter();
    this.initWindshieldShader();
    this.applyLightingForState(new THREE.Vector3(0, 0, 0));
  }

  private sampleExteriorRainXZ(): [number, number] {
    // Spawn strictly OUTSIDE the vehicle cabin (annulus radius 4.8m to 34.0m)
    // so rain streaks NEVER appear inside the cockpit or in front of the steering wheel.
    const angle = Math.random() * Math.PI * 2.0;
    const radius = 4.8 + Math.random() * 29.2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }

  private initRainEmitter(): void {
    // Each raindrop is a 2-vertex line streak (rainCount * 2 * 3 floats)
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainBasePositions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      const [x, z] = this.sampleExteriorRainXZ();
      const y = Math.random() * 18.0;

      this.rainBasePositions[i * 3 + 0] = x;
      this.rainBasePositions[i * 3 + 1] = y;
      this.rainBasePositions[i * 3 + 2] = z;

      const idx = i * 6;
      this.rainPositions[idx + 0] = x;
      this.rainPositions[idx + 1] = y;
      this.rainPositions[idx + 2] = z;
      this.rainPositions[idx + 3] = x;
      this.rainPositions[idx + 4] = y - 0.65;
      this.rainPositions[idx + 5] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.0,
      depthTest: true,
      depthWrite: false,
    });

    this.rainSegments = new THREE.LineSegments(geo, this.rainMaterial);
    this.rainSegments.frustumCulled = false;
    this.rainSegments.visible = false;
    this.rainSegments.name = 'Procedural_Rain_Emitter';
    this.scene.add(this.rainSegments);
  }

  private initWindshieldShader(): void {
    this.windshieldMaterial = new THREE.ShaderMaterial({
      vertexShader: WINDSHIELD_DROPLET_VERTEX_SHADER,
      fragmentShader: WINDSHIELD_DROPLET_FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0.0 },
        uRainIntensity: { value: 0.0 },
        uSpeedKmh: { value: 0.0 },
        uWiperAngle: { value: 0.0 },
        uCockpitFactor: { value: 1.0 },
      },
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.windshieldQuad = new THREE.Mesh(quadGeo, this.windshieldMaterial);
    this.windshieldQuad.frustumCulled = false;
    this.windshieldQuad.renderOrder = 999;
    this.windshieldQuad.visible = false;
    this.windshieldQuad.name = 'Windshield_Droplet_Shader_Overlay';
    this.scene.add(this.windshieldQuad);
  }

  public getState(): EnvironmentState {
    return { ...this.state };
  }

  /**
   * Sets the weather condition ('clear' | 'drizzle' | 'heavy_rain') and updates rain intensity.
   */
  public setWeather(weather: WeatherCondition): EnvironmentState {
    this.state.weather = weather;
    if (weather === 'clear') {
      this.state.rainIntensity = 0.0;
    } else if (weather === 'drizzle') {
      this.state.rainIntensity = 0.45;
    } else {
      this.state.rainIntensity = 1.0;
    }
    return this.getState();
  }

  /**
   * Cycles between Clear -> Drizzle -> Heavy Rain.
   */
  public cycleWeather(): EnvironmentState {
    const order: WeatherCondition[] = ['clear', 'drizzle', 'heavy_rain'];
    const idx = order.indexOf(this.state.weather);
    return this.setWeather(order[(idx + 1) % order.length]);
  }

  /**
   * Sets the time of day in hours [0, 24).
   */
  public setTimeOfDay(hours: number): EnvironmentState {
    this.state.timeOfDayHours = ((hours % 24) + 24) % 24;
    return this.getState();
  }

  /**
   * Cycles through signature endurance time-of-day presets:
   * Afternoon (14:00) -> Golden Sunset (19:15) -> Midnight (23:30) -> Eifel Dawn (06:30)
   */
  public cycleTimePreset(): EnvironmentState {
    const presets = [14.0, 19.25, 23.5, 6.5];
    let closestIdx = 0;
    let bestDiff = 999;
    for (let i = 0; i < presets.length; i++) {
      const diff = Math.abs(this.state.timeOfDayHours - presets[i]);
      if (diff < bestDiff) {
        bestDiff = diff;
        closestIdx = i;
      }
    }
    const nextHours = presets[(closestIdx + 1) % presets.length];
    return this.setTimeOfDay(nextHours);
  }

  public setAutoCycleTime(enabled: boolean): void {
    this.autoCycleTime = enabled;
  }

  public setManualHeadlights(enabled: boolean | null): void {
    this.manualHeadlightOverride = enabled;
    if (enabled !== null) {
      this.state.headlightsOn = enabled;
    }
  }

  /**
   * Computes solar elevation sine [-1, 1] for a given hour of day [0, 24).
   * Peak noon at 12:00 (+1), midnight at 00:00 (-1), sunrise at 06:00 (0), sunset at 18:00 (0).
   */
  public getSolarElevationFactor(): number {
    const angle = ((this.state.timeOfDayHours - 6.0) / 12.0) * Math.PI;
    return Math.sin(angle);
  }

  /**
   * Steps time of day, directional sun progression, rain emitter, and windshield droplet shader.
   */
  public update(
    dt: number,
    cameraPos: THREE.Vector3,
    carVelocityWorld: THREE.Vector3,
    speedKmh: number,
    isCockpitOrHoodView: boolean,
    ambientTrackWetness: number
  ): EnvironmentState {
    this.state.ambientTrackWetness = ambientTrackWetness;

    if (this.autoCycleTime && dt > 0) {
      this.state.timeOfDayHours =
        (this.state.timeOfDayHours + (dt * this.state.timeScale) / 3600.0) % 24.0;
    }

    this.elapsedShaderTime += dt;

    // 1. Update directional sun progression & sky/fog lighting
    this.applyLightingForState(cameraPos);

    // 2. Step procedural rain particle emitter strictly outside the cabin
    if (this.state.rainIntensity > 0.01) {
      this.rainSegments.visible = true;
      this.rainMaterial.opacity = 0.14 + 0.16 * this.state.rainIntensity;
      this.stepRainParticles(dt, cameraPos, carVelocityWorld);
    } else {
      this.rainSegments.visible = false;
    }

    // 3. Step windshield droplet distortion & wiper shader
    if (this.state.rainIntensity > 0.01) {
      this.windshieldQuad.visible = true;
      this.windshieldMaterial.uniforms.uTime.value = this.elapsedShaderTime;
      this.windshieldMaterial.uniforms.uRainIntensity.value = this.state.rainIntensity;
      this.windshieldMaterial.uniforms.uSpeedKmh.value = speedKmh;
      this.windshieldMaterial.uniforms.uCockpitFactor.value = isCockpitOrHoodView ? 1.0 : 0.45;
      // Wiper sweeps back and forth between -0.75 rad and +0.75 rad
      const wiperFreq = 1.6 + 1.4 * this.state.rainIntensity;
      this.windshieldMaterial.uniforms.uWiperAngle.value =
        Math.sin(this.elapsedShaderTime * wiperFreq) * 0.72;
    } else {
      this.windshieldQuad.visible = false;
    }

    return this.state;
  }

  private applyLightingForState(focusPos: THREE.Vector3): void {
    const sunElev = this.getSolarElevationFactor(); // [-1, 1]
    const azimuth = ((this.state.timeOfDayHours - 6.0) / 12.0) * Math.PI;

    // Position DirectionalLight on an orbital hemisphere around the vehicle/camera
    const radius = 160.0;
    const sunY = Math.max(12.0, Math.abs(sunElev) * radius + 16.0);
    const sunX = Math.cos(azimuth) * radius;
    const sunZ = Math.sin(azimuth) * radius * 0.75;

    this.dirLight.position.set(focusPos.x + sunX, focusPos.y + sunY, focusPos.z + sunZ);
    this.dirLight.target.position.copy(focusPos);
    this.dirLight.target.updateMatrixWorld();

    // Cloud cover attenuation during drizzle/heavy rain (kept moderate so track remains clear)
    const cloudDimming = 1.0 - this.state.rainIntensity * 0.25;

    if (sunElev > 0.22) {
      // Daylight
      const dayT = Math.min(1.0, (sunElev - 0.22) / 0.78);
      this.skyColor.setHex(0x87ceeb).lerp(new THREE.Color(0x475569), this.state.rainIntensity * 0.7);
      this.sunColor.setHex(0xfffbeb).lerp(new THREE.Color(0xcbd5e1), this.state.rainIntensity * 0.5);
      this.groundColor.setHex(0x1e293b);

      this.dirLight.intensity = (1.6 + 1.2 * dayT) * cloudDimming;
      this.hemiLight.intensity = (0.80 + 0.35 * dayT) * cloudDimming;
    } else if (sunElev > -0.18) {
      // Golden Hour Dawn / Sunset transition [-0.18, 0.22]
      const twilightT = (sunElev + 0.18) / 0.4; // 0 at night edge, 1 at day edge
      this.skyColor
        .setHex(0x0b1120)
        .lerp(new THREE.Color(0xf97316), Math.sin(twilightT * Math.PI) * 0.65)
        .lerp(new THREE.Color(0x64748b), twilightT * 0.5);
      this.sunColor.setHex(0xfb923c).lerp(new THREE.Color(0xfef08a), twilightT);
      this.groundColor.setHex(0x0f172a);

      this.dirLight.intensity = (0.45 + 1.35 * twilightT) * cloudDimming;
      this.hemiLight.intensity = (0.35 + 0.45 * twilightT) * cloudDimming;
    } else {
      // Nighttime endurance conditions
      this.skyColor.setHex(0x060b16);
      this.sunColor.setHex(0x60a5fa); // Crisp moonlight rim so terrain & track silhouette remain readable
      this.groundColor.setHex(0x090d16);

      this.dirLight.intensity = 0.28 * cloudDimming;
      this.hemiLight.intensity = 0.26;
    }

    this.dirLight.color.copy(this.sunColor);
    this.hemiLight.color.copy(this.skyColor);
    this.hemiLight.groundColor.copy(this.groundColor);
    this.scene.background = this.skyColor.clone();
    this.fog.color.copy(this.skyColor);
    this.fog.density = 0.00038 + this.state.rainIntensity * 0.00042;

    // Auto-headlight control unless manually overridden
    if (this.manualHeadlightOverride === null) {
      this.state.headlightsOn = sunElev < 0.16 || this.state.rainIntensity >= 0.4;
    } else {
      this.state.headlightsOn = this.manualHeadlightOverride;
    }
  }

  private stepRainParticles(
    dt: number,
    cameraPos: THREE.Vector3,
    carVelocityWorld: THREE.Vector3
  ): void {
    const fallSpeed = 22.0 + 10.0 * this.state.rainIntensity;
    const streakScale = 0.032;
    const vx = -carVelocityWorld.x * 0.28;
    const vy = -fallSpeed;
    const vz = -carVelocityWorld.z * 0.28;

    for (let i = 0; i < this.rainCount; i++) {
      const bIdx = i * 3;
      let rx = this.rainBasePositions[bIdx + 0];
      let ry = this.rainBasePositions[bIdx + 1] - fallSpeed * dt;
      let rz = this.rainBasePositions[bIdx + 2];

      if (ry < -3.0 || rx * rx + rz * rz < 4.6 * 4.6) {
        ry = 14.0 + Math.random() * 6.0;
        const [nx, nz] = this.sampleExteriorRainXZ();
        rx = nx;
        rz = nz;
      }

      this.rainBasePositions[bIdx + 0] = rx;
      this.rainBasePositions[bIdx + 1] = ry;
      this.rainBasePositions[bIdx + 2] = rz;

      const wx = cameraPos.x + rx;
      const wy = cameraPos.y + ry;
      const wz = cameraPos.z + rz;

      const pIdx = i * 6;
      this.rainPositions[pIdx + 0] = wx;
      this.rainPositions[pIdx + 1] = wy;
      this.rainPositions[pIdx + 2] = wz;
      this.rainPositions[pIdx + 3] = wx + vx * streakScale;
      this.rainPositions[pIdx + 4] = wy + vy * streakScale;
      this.rainPositions[pIdx + 5] = wz + vz * streakScale;
    }

    const posAttr = this.rainSegments.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }

  public formatTimeOfDay(): string {
    const totalMinutes = Math.floor(this.state.timeOfDayHours * 60) % (24 * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }
}
