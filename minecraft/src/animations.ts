import { Mesh, Texture } from 'three';

export interface Animator {
  update(deltaTime: number, elapsed: number): void;
  dispose(): void;
}

export class AnimationSystem {
  private animators: Map<string, Animator> = new Map();

  register(id: string, animator: Animator): void {
    const existing = this.animators.get(id);
    if (existing) {
      existing.dispose();
    }
    this.animators.set(id, animator);
  }

  unregister(id: string): void {
    const animator = this.animators.get(id);
    if (!animator) {
      return;
    }
    animator.dispose();
    this.animators.delete(id);
  }

  update(deltaTime: number, elapsed: number): void {
    for (const animator of this.animators.values()) {
      animator.update(deltaTime, elapsed);
    }
  }

  disposeAll(): void {
    for (const [id, animator] of this.animators) {
      animator.dispose();
      this.animators.delete(id);
    }
  }
}

export class LeafSwayAnimator implements Animator {
  private readonly mesh: Mesh;
  private readonly offset: number;

  constructor(mesh: Mesh, x: number, z: number) {
    this.mesh = mesh;
    this.offset = x * 7 + z * 13;
  }

  update(_deltaTime: number, elapsed: number): void {
    this.mesh.rotation.z = Math.sin(elapsed * 1.5 + this.offset) * 0.04;
    this.mesh.rotation.x = Math.cos(elapsed * 1.2 + this.offset) * 0.03;
  }

  dispose(): void {
    this.mesh.rotation.x = 0;
    this.mesh.rotation.z = 0;
  }
}

export class WaterAnimator implements Animator {
  private readonly stillTexture: Texture;
  private readonly flowTexture: Texture;
  private readonly stillFrames: number;
  private readonly flowFrames: number;
  private frameTimer = 0;
  private readonly frameStep = 0.1;
  private stillFrameIndex = 0;
  private flowFrameIndex = 0;

  constructor(stillTexture: Texture, flowTexture: Texture) {
    this.stillTexture = stillTexture;
    this.flowTexture = flowTexture;
    this.stillFrames = computeSpriteFrameCount(stillTexture);
    this.flowFrames = computeSpriteFrameCount(flowTexture);

    this.stillTexture.repeat.set(1, 1 / this.stillFrames);
    this.flowTexture.repeat.set(1, 1 / this.flowFrames);
  }

  update(deltaTime: number, _elapsed: number): void {
    this.frameTimer += deltaTime;
    while (this.frameTimer >= this.frameStep) {
      this.frameTimer -= this.frameStep;
      this.stillFrameIndex = (this.stillFrameIndex + 1) % this.stillFrames;
      this.flowFrameIndex = (this.flowFrameIndex + 1) % this.flowFrames;
      this.stillTexture.offset.y = this.stillFrameIndex / this.stillFrames;
      this.flowTexture.offset.y = this.flowFrameIndex / this.flowFrames;
    }
  }

  dispose(): void {
    // No persistent resources to dispose.
  }
}

export function computeSpriteFrameCount(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  return computeSpriteFrameCountFromSize(image?.width ?? 0, image?.height ?? 0);
}

export function computeSpriteFrameCountFromSize(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }
  const frameCount = Math.floor(height / width);
  return Math.max(1, frameCount);
}
