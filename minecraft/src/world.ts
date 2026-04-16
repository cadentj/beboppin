export type BlockType =
  | 'air'
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'water'
  | 'log'
  | 'leaves'
  | 'planks'
  | 'sand'
  | 'dandelion'
  | 'poppy'
  | 'cornflower'
  | 'allium';

export const FLOWER_TYPES: BlockType[] = ['dandelion', 'poppy', 'cornflower', 'allium'];

export function isFlowerBlock(type: BlockType): boolean {
  return (FLOWER_TYPES as string[]).includes(type);
}

export interface Block {
  type: BlockType;
}

export interface World {
  version: 1;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blocks: Block[][][]; // [x][y][z]
}

export type Vec3 = [number, number, number];

export interface BlockChange {
  pos: Vec3;
  previous: BlockType;
  next: BlockType;
}

export function createWorld(sizeX = 8, sizeY = 5, sizeZ = 8): World {
  const blocks: Block[][][] = [];

  for (let x = 0; x < sizeX; x += 1) {
    const xLayer: Block[][] = [];
    for (let y = 0; y < sizeY; y += 1) {
      const yLayer: Block[] = [];
      for (let z = 0; z < sizeZ; z += 1) {
        yLayer.push({ type: 'air' });
      }
      xLayer.push(yLayer);
    }
    blocks.push(xLayer);
  }

  return {
    version: 1,
    sizeX,
    sizeY,
    sizeZ,
    blocks,
  };
}

type Rng = () => number;

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function seedToRng(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

function generateHeightmap(sizeX: number, sizeZ: number, rng: Rng): number[][] {
  const minHeight = 1;
  const maxHeight = 5;
  const octaves = [
    { gridSize: 6, amplitude: 1.0 },
    { gridSize: 3, amplitude: 0.5 },
  ];

  const grids = octaves.map(({ gridSize }) => {
    const gw = Math.ceil(sizeX / gridSize) + 2;
    const gh = Math.ceil(sizeZ / gridSize) + 2;
    const grid: number[][] = [];
    for (let i = 0; i < gw; i++) {
      grid[i] = [];
      for (let j = 0; j < gh; j++) {
        grid[i][j] = rng();
      }
    }
    return grid;
  });

  const heightmap: number[][] = [];
  for (let x = 0; x < sizeX; x++) {
    heightmap[x] = [];
    for (let z = 0; z < sizeZ; z++) {
      let noise = 0;
      let totalAmp = 0;
      for (let o = 0; o < octaves.length; o++) {
        const { gridSize, amplitude } = octaves[o];
        const grid = grids[o];
        const gx = x / gridSize;
        const gz = z / gridSize;
        const x0 = Math.floor(gx);
        const z0 = Math.floor(gz);
        const fx = gx - x0;
        const fz = gz - z0;
        const sx = fx * fx * (3 - 2 * fx);
        const sz = fz * fz * (3 - 2 * fz);
        const top = grid[x0][z0] + (grid[x0 + 1][z0] - grid[x0][z0]) * sx;
        const bot = grid[x0][z0 + 1] + (grid[x0 + 1][z0 + 1] - grid[x0][z0 + 1]) * sx;
        noise += (top + (bot - top) * sz) * amplitude;
        totalAmp += amplitude;
      }
      noise /= totalAmp;
      heightmap[x][z] = Math.round(minHeight + noise * (maxHeight - minHeight));
    }
  }
  return heightmap;
}

function placeTree(world: World, x: number, surfaceY: number, z: number): void {
  for (let dy = 1; dy <= 3; dy++) {
    unsafeSetBlockType(world, x, surfaceY + dy, z, 'log');
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      unsafeSetBlockType(world, x + dx, surfaceY + 3, z + dz, 'leaves');
    }
  }
  const capOffsets: Vec3[] = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const [dx, , dz] of capOffsets) {
    unsafeSetBlockType(world, x + dx, surfaceY + 4, z + dz, 'leaves');
  }
}

const SEA_LEVEL = 2;
const TREE_CHANCE = 0.08;
const TREE_MIN_SPACING = 4;
const FLOWER_CHANCE = 0.12;

export function createDefaultWorld(seed = 'sinnoh'): World {
  const sizeX = 16;
  const sizeY = 10;
  const sizeZ = 16;
  const world = createWorld(sizeX, sizeY, sizeZ);
  const rng = seedToRng(seed);
  const heightmap = generateHeightmap(sizeX, sizeZ, rng);

  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      const h = heightmap[x][z];
      for (let y = 0; y <= h; y++) {
        if (y < h - 1) unsafeSetBlockType(world, x, y, z, 'stone');
        else if (y < h) unsafeSetBlockType(world, x, y, z, 'dirt');
        else unsafeSetBlockType(world, x, y, z, 'grass');
      }
    }
  }

  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let y = 0; y <= SEA_LEVEL; y++) {
        if (getBlockType(world, x, y, z) === 'air') {
          unsafeSetBlockType(world, x, y, z, 'water');
        }
      }
    }
  }

  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      const h = heightmap[x][z];
      const surface = getBlockType(world, x, h, z);
      if (surface !== 'grass') continue;

      if (h < SEA_LEVEL && getBlockType(world, x, h + 1, z) === 'water') {
        unsafeSetBlockType(world, x, h, z, 'dirt');
        continue;
      }

      const neighborHasWater =
        (isInBounds(world, x + 1, 0, z) && heightmap[x + 1]?.[z] < SEA_LEVEL) ||
        (isInBounds(world, x - 1, 0, z) && heightmap[x - 1]?.[z] < SEA_LEVEL) ||
        (isInBounds(world, x, 0, z + 1) && heightmap[x]?.[z + 1] < SEA_LEVEL) ||
        (isInBounds(world, x, 0, z - 1) && heightmap[x]?.[z - 1] < SEA_LEVEL);

      if (neighborHasWater) {
        unsafeSetBlockType(world, x, h, z, 'sand');
      }
    }
  }

  const trunks: Vec3[] = [];
  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      const h = heightmap[x][z];
      if (getBlockType(world, x, h, z) !== 'grass') continue;
      if (h + 4 >= sizeY) continue;
      if (x < 2 || x >= sizeX - 2 || z < 2 || z >= sizeZ - 2) continue;
      if (rng() > TREE_CHANCE) continue;

      const tooClose = trunks.some(
        ([tx, , tz]) => Math.abs(tx - x) + Math.abs(tz - z) < TREE_MIN_SPACING,
      );
      if (tooClose) continue;

      trunks.push([x, h, z]);
      placeTree(world, x, h, z);
    }
  }

  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      const h = heightmap[x][z];
      if (getBlockType(world, x, h, z) !== 'grass') continue;
      if (h + 1 >= sizeY || getBlockType(world, x, h + 1, z) !== 'air') continue;
      if (rng() > FLOWER_CHANCE) continue;
      const flower = FLOWER_TYPES[Math.floor(rng() * FLOWER_TYPES.length)];
      unsafeSetBlockType(world, x, h + 1, z, flower);
    }
  }

  return world;
}

export function posKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function isInBounds(world: World, x: number, y: number, z: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < world.sizeX && y < world.sizeY && z < world.sizeZ;
}

export function getBlockType(world: World, x: number, y: number, z: number): BlockType {
  if (!isInBounds(world, x, y, z)) {
    return 'air';
  }
  return world.blocks[x][y][z].type;
}

export function setBlockType(world: World, pos: Vec3, next: BlockType): BlockChange | null {
  const [x, y, z] = pos;
  if (!isInBounds(world, x, y, z)) {
    return null;
  }

  const previous = world.blocks[x][y][z].type;
  if (previous === next) {
    return null;
  }

  world.blocks[x][y][z].type = next;

  return {
    pos,
    previous,
    next,
  };
}

export function getNeighborPositions(pos: Vec3): Vec3[] {
  const [x, y, z] = pos;
  return [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ];
}

export function getNeighborhoodInBounds(world: World, pos: Vec3): Vec3[] {
  const neighbors = [pos, ...getNeighborPositions(pos)];
  return neighbors.filter(([x, y, z]) => isInBounds(world, x, y, z));
}

function unsafeSetBlockType(world: World, x: number, y: number, z: number, type: BlockType): void {
  if (!isInBounds(world, x, y, z)) {
    return;
  }
  world.blocks[x][y][z].type = type;
}
