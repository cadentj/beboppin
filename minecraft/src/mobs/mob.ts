import type { Group, Scene } from 'three';
import type { AnimationSystem, Animator } from '../animations';
import type { World } from '../world';
import { getBlockType, isInBounds } from '../world';

export interface Mob extends Animator {
  readonly id: string;
  readonly group: Group;
}

export class MobManager {
  private readonly scene: Scene;
  private readonly animationSystem: AnimationSystem;
  private readonly mobs = new Map<string, Mob>();

  constructor(scene: Scene, animationSystem: AnimationSystem) {
    this.scene = scene;
    this.animationSystem = animationSystem;
  }

  add(mob: Mob): void {
    this.mobs.set(mob.id, mob);
    this.scene.add(mob.group);
    this.animationSystem.register(mob.id, mob);
  }

  remove(id: string): void {
    const mob = this.mobs.get(id);
    if (!mob) {
      return;
    }
    this.animationSystem.unregister(id);
    mob.group.removeFromParent();
    mob.dispose();
    this.mobs.delete(id);
  }

  dispose(): void {
    for (const id of [...this.mobs.keys()]) {
      this.remove(id);
    }
  }
}

/** Solid ground for walking (not air/water). */
export function isWalkableSupport(world: World, x: number, y: number, z: number): boolean {
  if (!isInBounds(world, x, y, z)) {
    return false;
  }
  const t = getBlockType(world, x, y, z);
  return t !== 'air' && t !== 'water';
}

/** True if mob can stand in cell (x, footY, z): air at feet and solid below. */
export function isStandableCell(world: World, x: number, footY: number, z: number): boolean {
  if (!isInBounds(world, x, footY, z)) {
    return false;
  }
  if (getBlockType(world, x, footY, z) !== 'air') {
    return false;
  }
  return isWalkableSupport(world, x, footY - 1, z);
}

export function findRandomStandableCell(world: World, rng: () => number): [number, number, number] | null {
  const candidates: Array<[number, number, number]> = [];
  for (let x = 0; x < world.sizeX; x += 1) {
    for (let z = 0; z < world.sizeZ; z += 1) {
      for (let y = 1; y < world.sizeY; y += 1) {
        if (isStandableCell(world, x, y, z)) {
          candidates.push([x, y, z]);
        }
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const i = Math.floor(rng() * candidates.length);
  return candidates[i]!;
}

/** World Y for feet standing on top of block whose center is at `blockY`. */
export function feetWorldY(blockY: number): number {
  return blockY + 0.5;
}
