import { describe, expect, it } from 'vitest';
import { getFaceUvCorners, isFaceVisibleForTest } from '../src/blocks';

describe('face UV orientation', () => {
  it('keeps the +X face mapped without the previous 90-degree-left rotation', () => {
    const uv = getFaceUvCorners(0);
    expect(uv).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });
});

describe('leaf face visibility', () => {
  it('culls leaf-to-leaf internal faces', () => {
    expect(isFaceVisibleForTest('leaves', 'leaves')).toBe(false);
  });

  it('renders leaves against solid neighbors so cutout pixels show geometry behind', () => {
    expect(isFaceVisibleForTest('leaves', 'dirt')).toBe(true);
    expect(isFaceVisibleForTest('leaves', 'stone')).toBe(true);
    expect(isFaceVisibleForTest('dirt', 'leaves')).toBe(true);
    expect(isFaceVisibleForTest('stone', 'leaves')).toBe(true);
  });

  it('renders leaves against air and water', () => {
    expect(isFaceVisibleForTest('leaves', 'air')).toBe(true);
    expect(isFaceVisibleForTest('leaves', 'water')).toBe(true);
  });
});

describe('water face visibility', () => {
  it('culls internal water-water faces', () => {
    expect(isFaceVisibleForTest('water', 'water')).toBe(false);
  });
});
