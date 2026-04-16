import { describe, expect, it } from 'vitest';
import { PlaceTool } from '../src/tools/place';
import type { BlockType, World } from '../src/world';
import { createDefaultWorld, createWorld, getBlockType, isFlowerBlock, setBlockType } from '../src/world';

function forEachBlock(world: World, fn: (x: number, y: number, z: number, type: BlockType) => void): void {
  for (let x = 0; x < world.sizeX; x++) {
    for (let y = 0; y < world.sizeY; y++) {
      for (let z = 0; z < world.sizeZ; z++) {
        fn(x, y, z, getBlockType(world, x, y, z));
      }
    }
  }
}

describe('default world generation', () => {
  it('creates the expected world dimensions', () => {
    const world = createDefaultWorld();
    expect(world.sizeX).toBe(16);
    expect(world.sizeY).toBe(10);
    expect(world.sizeZ).toBe(16);
  });

  it('same seed produces identical worlds', () => {
    const a = createDefaultWorld('sinnoh');
    const b = createDefaultWorld('sinnoh');
    forEachBlock(a, (x, y, z, type) => {
      expect(getBlockType(b, x, y, z)).toBe(type);
    });
  });

  it('different seeds produce different worlds', () => {
    const a = createDefaultWorld('sinnoh');
    const b = createDefaultWorld('johto');
    let differences = 0;
    forEachBlock(a, (x, y, z, type) => {
      if (getBlockType(b, x, y, z) !== type) differences++;
    });
    expect(differences).toBeGreaterThan(0);
  });

  it('grass only appears with air, leaves, log, or a flower above it', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (type !== 'grass') return;
      const above = getBlockType(world, x, y + 1, z);
      expect(
        above === 'air' || above === 'leaves' || above === 'log' || isFlowerBlock(above),
        `grass at (${x},${y},${z}) has ${above} above`,
      ).toBe(true);
    });
  });

  it('sand is always adjacent to at least one water column', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (type !== 'sand') return;
      const neighbors = [
        [x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1],
      ] as const;
      const hasWater = neighbors.some(([nx, nz]) => {
        for (let ny = 0; ny < world.sizeY; ny++) {
          if (getBlockType(world, nx, ny, nz) === 'water') return true;
        }
        return false;
      });
      expect(hasWater, `sand at (${x},${y},${z}) has no adjacent water`).toBe(true);
    });
  });

  it('log blocks have solid ground below their base', () => {
    const world = createDefaultWorld();
    const logColumns = new Set<string>();
    forEachBlock(world, (x, y, z, type) => {
      if (type === 'log') logColumns.add(`${x},${z}`);
    });

    for (const key of logColumns) {
      const [x, z] = key.split(',').map(Number);
      let lowestLog = world.sizeY;
      for (let y = 0; y < world.sizeY; y++) {
        if (getBlockType(world, x, y, z) === 'log') { lowestLog = y; break; }
      }
      const below = getBlockType(world, x, lowestLog - 1, z);
      expect(
        below === 'grass' || below === 'dirt' || below === 'stone',
        `log at (${x},${lowestLog},${z}) has ${below} below`,
      ).toBe(true);
    }
  });

  it('leaves are near a log (Chebyshev distance 1)', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (type !== 'leaves') return;
      let hasLog = false;
      for (let dx = -1; dx <= 1 && !hasLog; dx++) {
        for (let dy = -1; dy <= 1 && !hasLog; dy++) {
          for (let dz = -1; dz <= 1 && !hasLog; dz++) {
            if (getBlockType(world, x + dx, y + dy, z + dz) === 'log') hasLog = true;
          }
        }
      }
      expect(hasLog, `leaves at (${x},${y},${z}) not near any log`).toBe(true);
    });
  });

  it('stone is never floating above air', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (type !== 'stone' || y === 0) return;
      const below = getBlockType(world, x, y - 1, z);
      expect(
        below !== 'air',
        `stone at (${x},${y},${z}) is floating above air`,
      ).toBe(true);
    });
  });

  it('flowers only appear on top of grass blocks', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (!isFlowerBlock(type)) return;
      const below = getBlockType(world, x, y - 1, z);
      expect(below, `flower ${type} at (${x},${y},${z}) has ${below} below instead of grass`).toBe('grass');
    });
  });

  it('flowers have air above them', () => {
    const world = createDefaultWorld();
    forEachBlock(world, (x, y, z, type) => {
      if (!isFlowerBlock(type)) return;
      const above = getBlockType(world, x, y + 1, z);
      expect(above, `flower ${type} at (${x},${y},${z}) has ${above} above`).toBe('air');
    });
  });

  it('at least one flower exists in the default world', () => {
    const world = createDefaultWorld();
    let flowerCount = 0;
    forEachBlock(world, (_x, _y, _z, type) => {
      if (isFlowerBlock(type)) flowerCount++;
    });
    expect(flowerCount).toBeGreaterThan(0);
  });
});

describe('world mutation', () => {
  it('places and removes blocks with change records', () => {
    const world = createWorld(4, 4, 4);
    const place = setBlockType(world, [1, 1, 1], 'stone');
    expect(place?.previous).toBe('air');
    expect(place?.next).toBe('stone');
    expect(getBlockType(world, 1, 1, 1)).toBe('stone');

    const destroy = setBlockType(world, [1, 1, 1], 'air');
    expect(destroy?.previous).toBe('stone');
    expect(getBlockType(world, 1, 1, 1)).toBe('air');
  });
});

describe('place tool', () => {
  it('cycles place types and wraps around', () => {
    const tool = new PlaceTool(['grass', 'stone', 'sand'], 'stone');
    expect(tool.placeBlockType).toBe('stone');

    tool.cycleBlockType();
    expect(tool.placeBlockType).toBe('sand');

    tool.cycleBlockType();
    expect(tool.placeBlockType).toBe('grass');
  });
});
