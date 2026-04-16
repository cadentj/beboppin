import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { WaterAnimator, computeSpriteFrameCountFromSize } from '../src/animations';

describe('computeSpriteFrameCountFromSize', () => {
  it('returns 1 for invalid dimensions', () => {
    expect(computeSpriteFrameCountFromSize(0, 512)).toBe(1);
    expect(computeSpriteFrameCountFromSize(16, 0)).toBe(1);
    expect(computeSpriteFrameCountFromSize(-1, 100)).toBe(1);
  });

  it('derives frame counts from vertical strips', () => {
    expect(computeSpriteFrameCountFromSize(16, 512)).toBe(32);
    expect(computeSpriteFrameCountFromSize(32, 1024)).toBe(32);
  });

  it('floors non-integer frame ratios', () => {
    expect(computeSpriteFrameCountFromSize(16, 530)).toBe(33);
  });
});

describe('WaterAnimator', () => {
  it('advances sprite offsets as texture-only animation', () => {
    const stillTexture = new Texture();
    stillTexture.image = { width: 16, height: 512 };
    const flowTexture = new Texture();
    flowTexture.image = { width: 32, height: 1024 };

    const animator = new WaterAnimator(stillTexture, flowTexture);
    animator.update(0.2, 1);

    expect(stillTexture.offset.y).toBeGreaterThan(0);
    expect(flowTexture.offset.y).toBeGreaterThan(0);

    animator.dispose();
  });
});
