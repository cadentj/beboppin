import {
  Group,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
import type { Animator } from '../animations';
import type { World } from '../world';
import { loadBedrockModel, type BedrockGeometry } from './mcModel';
import { feetWorldY, isStandableCell } from './mob';

import chickenTextureUrl from '../../assets/chicken_temperate.png';
import chickenGeo from '../../assets/model.geo.json';

export interface ChickenModelParts {
  root: Group;
  headPivot: Group;
  leftLegPivot: Group;
  rightLegPivot: Group;
  leftWingPivot: Group;
  rightWingPivot: Group;
}

let chickenIdCounter = 0;

function buildChickenGeometry(material: MeshLambertMaterial): ChickenModelParts {
  const { root, bones } = loadBedrockModel(chickenGeo as BedrockGeometry, material);
  root.name = 'chicken';

  return {
    root,
    headPivot: bones.get('head')!,
    rightLegPivot: bones.get('leg0')!,
    leftLegPivot: bones.get('leg1')!,
    rightWingPivot: bones.get('wing0')!,
    leftWingPivot: bones.get('wing1')!,
  };
}

async function loadChickenMaterial(): Promise<MeshLambertMaterial> {
  const texture = await new TextureLoader().loadAsync(chickenTextureUrl);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;

  return new MeshLambertMaterial({
    map: texture,
    alphaTest: 0.15,
  });
}

type AiState = 'idle' | 'peck' | 'walk';

export class ChickenMob implements Animator {
  readonly id: string;
  readonly group: Group;
  private readonly world: World;
  private readonly parts: ChickenModelParts;
  private readonly material: MeshLambertMaterial;
  private readonly rng: () => number;

  private aiState: AiState = 'idle';
  private stateTimer = 0;
  private walkDuration = 0.8;
  private walkElapsed = 0;
  private fromX = 0;
  private fromZ = 0;
  private toX = 0;
  private toZ = 0;
  private gridFootY = 1;
  private baseHeadRotX = 0;
  private disposed = false;

  private constructor(
    id: string,
    world: World,
    parts: ChickenModelParts,
    material: MeshLambertMaterial,
    startGx: number,
    startFootY: number,
    startGz: number,
    rng: () => number,
  ) {
    this.id = id;
    this.world = world;
    this.parts = parts;
    this.material = material;
    this.rng = rng;
    this.group = parts.root;
    this.gridFootY = startFootY;
    this.fromX = startGx;
    this.fromZ = startGz;
    this.toX = startGx;
    this.toZ = startGz;
    this.group.position.set(startGx, feetWorldY(startFootY - 1), startGz);
    this.pickIdleDuration();
  }

  static async create(
    world: World,
    startGx: number,
    startFootY: number,
    startGz: number,
    rng: () => number = Math.random,
  ): Promise<ChickenMob> {
    const material = await loadChickenMaterial();
    const parts = buildChickenGeometry(material);
    const id = `chicken:${chickenIdCounter++}`;
    return new ChickenMob(id, world, parts, material, startGx, startFootY, startGz, rng);
  }

  update(deltaTime: number, elapsed: number): void {
    if (this.disposed) {
      return;
    }

    this.stateTimer -= deltaTime;

    if (this.aiState === 'walk') {
      this.walkElapsed += deltaTime;
      const t = Math.min(1, this.walkElapsed / this.walkDuration);
      const e = t * t * (3 - 2 * t);
      const x = this.fromX + (this.toX - this.fromX) * e;
      const z = this.fromZ + (this.toZ - this.fromZ) * e;
      this.group.position.x = x;
      this.group.position.z = z;
      const hop = Math.sin(t * Math.PI) * 0.06;
      this.group.position.y = feetWorldY(this.gridFootY - 1) + hop;

      const swing = Math.sin((this.walkElapsed / this.walkDuration) * Math.PI * 4) * 0.35;
      this.parts.rightLegPivot.rotation.x = swing;
      this.parts.leftLegPivot.rotation.x = -swing;

      if (t >= 1) {
        this.fromX = this.toX;
        this.fromZ = this.toZ;
        this.aiState = 'idle';
        this.pickIdleDuration();
      }
    } else {
      this.parts.rightLegPivot.rotation.x *= 0.85;
      this.parts.leftLegPivot.rotation.x *= 0.85;
    }

    if (this.aiState === 'peck') {
      const phase = 1 - Math.max(0, this.stateTimer) / 0.45;
      this.baseHeadRotX = -Math.sin(phase * Math.PI) * 0.55;
    } else {
      this.baseHeadRotX *= 0.88;
    }

    this.parts.headPivot.rotation.x = this.baseHeadRotX;
    this.parts.leftWingPivot.rotation.z = Math.sin(elapsed * 3 + this.fromX) * 0.08;
    this.parts.rightWingPivot.rotation.z = -Math.sin(elapsed * 3 + this.fromZ) * 0.08;

    if (this.stateTimer <= 0 && this.aiState !== 'walk') {
      this.advanceAi();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.group.traverse((obj) => {
      const mesh = obj as { geometry?: { dispose: () => void } };
      mesh.geometry?.dispose();
    });
    this.material.map?.dispose();
    this.material.dispose();
  }

  private pickIdleDuration(): void {
    this.stateTimer = 1.5 + this.rng() * 2.5;
  }

  private advanceAi(): void {
    const roll = this.rng();
    if (roll < 0.25) {
      this.aiState = 'peck';
      this.stateTimer = 0.45;
      return;
    }
    if (roll < 0.65) {
      const moved = this.tryStartWalk();
      if (moved) {
        return;
      }
    }
    this.aiState = 'idle';
    this.pickIdleDuration();
  }

  private tryStartWalk(): boolean {
    const gx = Math.round(this.fromX);
    const gz = Math.round(this.fromZ);
    const footY = this.gridFootY;
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let i = dirs.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j]!, dirs[i]!];
    }
    for (const [dx, dz] of dirs) {
      const nx = gx + dx;
      const nz = gz + dz;
      if (isStandableCell(this.world, nx, footY, nz)) {
        this.aiState = 'walk';
        this.walkElapsed = 0;
        this.walkDuration = 0.65 + this.rng() * 0.35;
        this.toX = nx;
        this.toZ = nz;
        this.group.rotation.y = Math.atan2(-(nx - gx), -(nz - gz));
        return true;
      }
    }
    return false;
  }
}
