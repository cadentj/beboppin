import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LoadingManager,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  NearestMipmapNearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
} from 'three';
import type { MeshLambertMaterialParameters } from 'three';
import alliumUrl from '../assets/allium.png';
import cornflowerUrl from '../assets/cornflower.png';
import dandelionUrl from '../assets/dandelion.png';
import dirtUrl from '../assets/dirt.png';
import grassBlockSideUrl from '../assets/grass_block_side.png';
import grassBlockTopUrl from '../assets/grass_block_top.png';
import oakLeavesUrl from '../assets/oak_leaves.png';
import oakLogUrl from '../assets/oak_log.png';
import oakLogTopUrl from '../assets/oak_log_top.png';
import oakPlanksUrl from '../assets/oak_planks.png';
import poppyUrl from '../assets/poppy.png';
import sandUrl from '../assets/sand.png';
import stoneUrl from '../assets/stone.png';
import waterFlowUrl from '../assets/water_flow.png';
import waterStillUrl from '../assets/water_still.png';
import type { BlockType, Vec3, World } from './world';
import { getBlockType, isFlowerBlock, isInBounds, posKey } from './world';

type RenderableBlockType = Exclude<BlockType, 'air'>;

interface BlockTextures {
  grassTop: Texture;
  grassSide: Texture;
  dirt: Texture;
  stone: Texture;
  waterStill: Texture;
  waterFlow: Texture;
  logSide: Texture;
  logTop: Texture;
  leaves: Texture;
  planks: Texture;
  sand: Texture;
  dandelion: Texture;
  poppy: Texture;
  cornflower: Texture;
  allium: Texture;
}

type MaterialSet = [
  MeshLambertMaterial,
  MeshLambertMaterial,
  MeshLambertMaterial,
  MeshLambertMaterial,
  MeshLambertMaterial,
  MeshLambertMaterial,
];

interface BlockMaterials {
  grass: MaterialSet;
  dirt: MaterialSet;
  stone: MaterialSet;
  water: MaterialSet;
  log: MaterialSet;
  leaves: MaterialSet;
  planks: MaterialSet;
  sand: MaterialSet;
  dandelion: MaterialSet;
  poppy: MaterialSet;
  cornflower: MaterialSet;
  allium: MaterialSet;
}

export interface BlockAssets {
  textures: BlockTextures;
  materials: BlockMaterials;
  dispose: () => void;
}

interface FaceDefinition {
  materialIndex: 0 | 1 | 2 | 3 | 4 | 5;
  neighborOffset: Vec3;
  normal: Vec3;
  corners: [Vec3, Vec3, Vec3, Vec3];
  uvCorners: UvQuad;
}

type Uv = [number, number];
type UvQuad = [Uv, Uv, Uv, Uv];

const DEFAULT_UV_CORNERS: UvQuad = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const FACE_DEFINITIONS: FaceDefinition[] = [
  {
    materialIndex: 0,
    neighborOffset: [1, 0, 0],
    normal: [1, 0, 0],
    // Right (+X) face needs explicit orientation to avoid 90-degree left rotation.
    uvCorners: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    corners: [
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
  },
  {
    materialIndex: 1,
    neighborOffset: [-1, 0, 0],
    normal: [-1, 0, 0],
    uvCorners: DEFAULT_UV_CORNERS,
    corners: [
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, -0.5],
    ],
  },
  {
    materialIndex: 2,
    neighborOffset: [0, 1, 0],
    normal: [0, 1, 0],
    uvCorners: DEFAULT_UV_CORNERS,
    corners: [
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
  },
  {
    materialIndex: 3,
    neighborOffset: [0, -1, 0],
    normal: [0, -1, 0],
    uvCorners: DEFAULT_UV_CORNERS,
    corners: [
      [-0.5, -0.5, 0.5],
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
    ],
  },
  {
    materialIndex: 4,
    neighborOffset: [0, 0, 1],
    normal: [0, 0, 1],
    uvCorners: DEFAULT_UV_CORNERS,
    corners: [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
  },
  {
    materialIndex: 5,
    neighborOffset: [0, 0, -1],
    normal: [0, 0, -1],
    uvCorners: DEFAULT_UV_CORNERS,
    corners: [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
    ],
  },
];

const TEXTURE_TINTS = {
  grassTop: 0x7cbd6b,
  grassSide: 0x7cbd6b,
  leaves: 0x59ae30,
  waterStill: 0x3f76e4,
  waterFlow: 0x3f76e4,
} as const;

export class BlockMeshManager {
  private readonly scene: Scene;
  private readonly world: World;
  private readonly assets: BlockAssets;
  private readonly group = new Group();
  private readonly meshMap = new Map<string, Mesh>();

  constructor(scene: Scene, world: World, assets: BlockAssets) {
    this.scene = scene;
    this.world = world;
    this.assets = assets;
    this.group.name = 'voxel-blocks';
    this.scene.add(this.group);
  }

  buildInitial(): void {
    for (let x = 0; x < this.world.sizeX; x += 1) {
      for (let y = 0; y < this.world.sizeY; y += 1) {
        for (let z = 0; z < this.world.sizeZ; z += 1) {
          this.rebuildAt(x, y, z);
        }
      }
    }
  }

  updateBlockAndNeighbors(x: number, y: number, z: number): void {
    const positions: Vec3[] = [
      [x, y, z],
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];

    for (const [nx, ny, nz] of positions) {
      if (isInBounds(this.world, nx, ny, nz)) {
        this.rebuildAt(nx, ny, nz);
      }
    }
  }

  getMeshAt(x: number, y: number, z: number): Mesh | undefined {
    return this.meshMap.get(posKey(x, y, z));
  }

  getRaycastTargets(): Mesh[] {
    return Array.from(this.meshMap.values());
  }

  dispose(): void {
    for (const mesh of this.meshMap.values()) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.meshMap.clear();
    this.scene.remove(this.group);
  }

  private rebuildAt(x: number, y: number, z: number): void {
    const key = posKey(x, y, z);
    const existingMesh = this.meshMap.get(key);
    if (existingMesh) {
      existingMesh.geometry.dispose();
      this.group.remove(existingMesh);
      this.meshMap.delete(key);
    }

    const blockType = getBlockType(this.world, x, y, z);
    if (blockType === 'air') {
      return;
    }

    const isFlower = isFlowerBlock(blockType);
    const geometry = isFlower
      ? buildFlowerGeometry()
      : buildBlockGeometry(this.world, x, y, z, blockType);
    if (!geometry) {
      return;
    }

    const mesh = new Mesh(geometry, this.assets.materials[blockType]);
    mesh.position.set(x, y, z);
    mesh.castShadow = blockType !== 'water';
    mesh.receiveShadow = !isFlower;
    mesh.userData.voxelPos = [x, y, z] as Vec3;
    mesh.userData.blockType = blockType;

    this.group.add(mesh);
    this.meshMap.set(key, mesh);
  }
}

export async function loadBlockAssets(): Promise<BlockAssets> {
  const manager = new LoadingManager();
  const loader = new TextureLoader(manager);

  const [
    grassTop,
    grassSide,
    dirt,
    stone,
    waterStill,
    waterFlow,
    logSide,
    logTop,
    leaves,
    planks,
    sand,
    dandelion,
    poppy,
    cornflower,
    allium,
  ] = await Promise.all([
    loader.loadAsync(grassBlockTopUrl),
    loader.loadAsync(grassBlockSideUrl),
    loader.loadAsync(dirtUrl),
    loader.loadAsync(stoneUrl),
    loader.loadAsync(waterStillUrl),
    loader.loadAsync(waterFlowUrl),
    loader.loadAsync(oakLogUrl),
    loader.loadAsync(oakLogTopUrl),
    loader.loadAsync(oakLeavesUrl),
    loader.loadAsync(oakPlanksUrl),
    loader.loadAsync(sandUrl),
    loader.loadAsync(dandelionUrl),
    loader.loadAsync(poppyUrl),
    loader.loadAsync(cornflowerUrl),
    loader.loadAsync(alliumUrl),
  ]);

  const textures: BlockTextures = {
    grassTop,
    grassSide,
    dirt,
    stone,
    waterStill,
    waterFlow,
    logSide,
    logTop,
    leaves,
    planks,
    sand,
    dandelion,
    poppy,
    cornflower,
    allium,
  };

  configurePixelArtTextures(textures);

  const applyGrassTopTint = needsRuntimeTint(textures.grassTop);
  const applyGrassSideTint = needsRuntimeTint(textures.grassSide);
  const applyLeavesTint = needsRuntimeTint(textures.leaves);
  const applyWaterStillTint = needsRuntimeTint(textures.waterStill);
  const applyWaterFlowTint = needsRuntimeTint(textures.waterFlow);

  const grassTopMaterial = createMaterial(
    textures.grassTop,
    applyGrassTopTint ? TEXTURE_TINTS.grassTop : 0xffffff,
  );
  const grassSideMaterial = createMaterial(
    textures.grassSide,
    applyGrassSideTint ? TEXTURE_TINTS.grassSide : 0xffffff,
  );
  const dirtMaterial = createMaterial(textures.dirt, 0xffffff);
  const stoneMaterial = createMaterial(textures.stone, 0xffffff);
  const sandMaterial = createMaterial(textures.sand, 0xffffff);
  const planksMaterial = createMaterial(textures.planks, 0xffffff);
  const logSideMaterial = createMaterial(textures.logSide, 0xffffff);
  const logTopMaterial = createMaterial(textures.logTop, 0xffffff);
  const leavesMaterial = createMaterial(
    textures.leaves,
    applyLeavesTint ? TEXTURE_TINTS.leaves : 0xffffff,
    {
      alphaTest: 0.5,
    },
  );
  const waterStillMaterial = createMaterial(
    textures.waterStill,
    applyWaterStillTint ? TEXTURE_TINTS.waterStill : 0xffffff,
    {
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    },
  );
  const waterFlowMaterial = createMaterial(
    textures.waterFlow,
    applyWaterFlowTint ? TEXTURE_TINTS.waterFlow : 0xffffff,
    {
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    },
  );

  const flowerOpts: MeshLambertMaterialParameters = { alphaTest: 0.5, side: DoubleSide };
  const dandelionMaterial = createMaterial(textures.dandelion, 0xffffff, flowerOpts);
  const poppyMaterial = createMaterial(textures.poppy, 0xffffff, flowerOpts);
  const cornflowerMaterial = createMaterial(textures.cornflower, 0xffffff, flowerOpts);
  const alliumMaterial = createMaterial(textures.allium, 0xffffff, flowerOpts);

  const uniformSet = (m: MeshLambertMaterial): MaterialSet => [m, m, m, m, m, m];

  const materials: BlockMaterials = {
    grass: [
      grassSideMaterial,
      grassSideMaterial,
      grassTopMaterial,
      dirtMaterial,
      grassSideMaterial,
      grassSideMaterial,
    ],
    dirt: [dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial],
    stone: [stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial],
    water: [
      waterFlowMaterial,
      waterFlowMaterial,
      waterStillMaterial,
      waterStillMaterial,
      waterFlowMaterial,
      waterFlowMaterial,
    ],
    log: [logSideMaterial, logSideMaterial, logTopMaterial, logTopMaterial, logSideMaterial, logSideMaterial],
    leaves: [leavesMaterial, leavesMaterial, leavesMaterial, leavesMaterial, leavesMaterial, leavesMaterial],
    planks: [planksMaterial, planksMaterial, planksMaterial, planksMaterial, planksMaterial, planksMaterial],
    sand: [sandMaterial, sandMaterial, sandMaterial, sandMaterial, sandMaterial, sandMaterial],
    dandelion: uniformSet(dandelionMaterial),
    poppy: uniformSet(poppyMaterial),
    cornflower: uniformSet(cornflowerMaterial),
    allium: uniformSet(alliumMaterial),
  };

  return {
    textures,
    materials,
    dispose: () => {
      const uniqueMaterials = new Set<MeshLambertMaterial>();
      for (const list of Object.values(materials)) {
        for (const material of list) {
          uniqueMaterials.add(material);
        }
      }
      for (const material of uniqueMaterials) {
        material.dispose();
      }
      for (const texture of Object.values(textures)) {
        texture.dispose();
      }
    },
  };
}

function configurePixelArtTextures(textures: BlockTextures): void {
  for (const [name, texture] of Object.entries(textures)) {
    const isWaterTexture = name === 'waterStill' || name === 'waterFlow';

    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = isWaterTexture ? NearestFilter : NearestMipmapNearestFilter;
    texture.generateMipmaps = !isWaterTexture;

    if (isWaterTexture) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
    }

    texture.needsUpdate = true;
  }
}

function createMaterial(
  texture: Texture,
  color: number,
  options: MeshLambertMaterialParameters = {},
): MeshLambertMaterial {
  return new MeshLambertMaterial({
    map: texture,
    color,
    ...options,
  });
}

/**
 * Two axis-aligned cross quads forming an X when viewed from above.
 * With the isometric camera at azimuth π/4, both quads are seen at exactly 45°,
 * giving equal visibility to each. Diagonal-aligned quads would leave one edge-on.
 */
function buildFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const quads: { corners: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3 }[] = [
    {
      corners: [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]],
      normal: [0, 0, 1],
    },
    {
      corners: [[0, -0.5, -0.5], [0, -0.5, 0.5], [0, 0.5, 0.5], [0, 0.5, -0.5]],
      normal: [1, 0, 0],
    },
  ];

  for (const quad of quads) {
    const [v0, v1, v2, v3] = quad.corners;
    const triVerts = [v0, v1, v2, v0, v2, v3];
    const triUvs: Uv[] = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 6; i++) {
      positions.push(...triVerts[i]);
      normals.push(...quad.normal);
      uvs.push(...triUvs[i]);
    }
  }

  const geometry = new BufferGeometry();
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, 6, 0);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildBlockGeometry(world: World, x: number, y: number, z: number, blockType: RenderableBlockType): BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();

  let vertexOffset = 0;
  for (const face of FACE_DEFINITIONS) {
    const [dx, dy, dz] = face.neighborOffset;
    const neighborType = getBlockType(world, x + dx, y + dy, z + dz);
    if (!isFaceVisible(blockType, neighborType)) {
      continue;
    }

    geometry.addGroup(vertexOffset, 6, face.materialIndex);
    appendFace(positions, normals, uvs, face);
    vertexOffset += 6;
  }

  if (vertexOffset === 0) {
    geometry.dispose();
    return null;
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function appendFace(positions: number[], normals: number[], uvs: number[], face: FaceDefinition): void {
  const [v0, v1, v2, v3] = face.corners;
  const [uv0, uv1, uv2, uv3] = face.uvCorners;
  const [nx, ny, nz] = face.normal;
  const triangleVertices = [v0, v1, v2, v0, v2, v3];
  const triangleUvs: Uv[] = [uv0, uv1, uv2, uv0, uv2, uv3];

  for (let i = 0; i < triangleVertices.length; i += 1) {
    const [x, y, z] = triangleVertices[i]!;
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    const [u, v] = triangleUvs[i]!;
    uvs.push(u, v);
  }
}

export function getFaceUvCorners(materialIndex: FaceDefinition['materialIndex']): UvQuad {
  const face = FACE_DEFINITIONS.find((entry) => entry.materialIndex === materialIndex);
  if (!face) {
    return DEFAULT_UV_CORNERS;
  }
  return face.uvCorners;
}

function isFaceVisible(current: RenderableBlockType, neighbor: BlockType): boolean {
  if (current === 'water') {
    return neighbor !== 'water';
  }
  if (current === 'leaves') {
    return neighbor !== 'leaves';
  }
  if (neighbor === 'leaves') {
    // Leaves are cutout foliage; keep neighboring solid faces so leaf holes show geometry behind.
    return true;
  }
  return !isSolidBlock(neighbor);
}

function isSolidBlock(blockType: BlockType): boolean {
  return blockType !== 'air' && blockType !== 'water' && !isFlowerBlock(blockType);
}

export function isFaceVisibleForTest(current: RenderableBlockType, neighbor: BlockType): boolean {
  return isFaceVisible(current, neighbor);
}

function needsRuntimeTint(texture: Texture): boolean {
  const image = texture.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | { width?: number; height?: number }
    | undefined;
  if (!image || typeof image.width !== 'number' || typeof image.height !== 'number') {
    return true;
  }

  const canvas = document.createElement('canvas');
  const sampleSize = 16;
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return true;
  }

  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0, sampleSize, sampleSize);
  } catch {
    return true;
  }

  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
  let saturationTotal = 0;
  let sampleCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha < 10) {
      continue;
    }

    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max <= 0 ? 0 : (max - min) / max;

    saturationTotal += saturation;
    sampleCount += 1;
  }

  if (sampleCount === 0) {
    return true;
  }

  const meanSaturation = saturationTotal / sampleCount;
  return meanSaturation < 0.15;
}
