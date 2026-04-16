import { BoxGeometry, BufferAttribute, Group, Mesh, MeshLambertMaterial, Vector2 } from 'three';

/** Maps Minecraft Bedrock entity cuboid texture layout onto Three.js BoxGeometry UVs. */
function applyMinecraftCuboidUVs(
  box: BoxGeometry,
  u: number,
  v: number,
  width: number,
  height: number,
  depth: number,
  textureWidth: number,
  textureHeight: number,
): void {
  const toFaceVertices = (x1: number, y1: number, x2: number, y2: number): Vector2[] => [
    new Vector2(x1 / textureWidth, 1.0 - y2 / textureHeight),
    new Vector2(x2 / textureWidth, 1.0 - y2 / textureHeight),
    new Vector2(x2 / textureWidth, 1.0 - y1 / textureHeight),
    new Vector2(x1 / textureWidth, 1.0 - y1 / textureHeight),
  ];

  const top = toFaceVertices(u + depth, v, u + width + depth, v + depth);
  const bottom = toFaceVertices(u + width + depth, v, u + width * 2 + depth, v + depth);
  const left = toFaceVertices(u, v + depth, u + depth, v + depth + height);
  const front = toFaceVertices(u + depth, v + depth, u + width + depth, v + depth + height);
  const right = toFaceVertices(u + width + depth, v + depth, u + width + depth * 2, v + height + depth);
  const back = toFaceVertices(u + width + depth * 2, v + depth, u + width * 2 + depth * 2, v + height + depth);

  const reorder = (face: Vector2[]): number[] => {
    const [a, b, c, d] = face;
    return [d.x, d.y, c.x, c.y, a.x, a.y, b.x, b.y];
  };

  const uvRight = reorder([right[3], right[2], right[0], right[1]]);
  const uvLeft = reorder([left[3], left[2], left[0], left[1]]);
  const uvTop = reorder([top[3], top[2], top[0], top[1]]);
  const uvBottom = reorder([bottom[0], bottom[1], bottom[3], bottom[2]]);
  const uvFront = reorder([front[3], front[2], front[0], front[1]]);
  const uvBack = reorder([back[3], back[2], back[0], back[1]]);

  const newUVData: number[] = [];
  for (const block of [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack]) {
    newUVData.push(...block);
  }

  const uvAttr = box.attributes.uv as BufferAttribute;
  uvAttr.set(new Float32Array(newUVData));
  uvAttr.needsUpdate = true;
}

// --- Bedrock Geometry Loader ---

type Vec3 = number[] | [number, number, number];
type Vec2 = number[] | [number, number];

interface BedrockCube {
  origin: Vec3;
  size: Vec3;
  uv: Vec2;
  pivot?: Vec3;
  rotation?: Vec3;
}

interface BedrockBone {
  name: string;
  parent?: string;
  pivot: Vec3;
  cubes?: BedrockCube[];
  locators?: Record<string, unknown>;
}

interface BedrockGeometryDef {
  description: {
    identifier: string;
    texture_width: number;
    texture_height: number;
    [key: string]: unknown;
  };
  bones: BedrockBone[];
}

export interface BedrockGeometry {
  format_version: string;
  'minecraft:geometry': BedrockGeometryDef[];
}

export interface LoadedModel {
  root: Group;
  bones: Map<string, Group>;
}

const DEG2RAD = Math.PI / 180;

/**
 * Builds a Three.js scene graph from a Bedrock Edition geometry file.
 *
 * Handles bone hierarchy, per-cube UV mapping, and per-cube rotations
 * (converting Bedrock's left-hand-rule rotations to Three.js right-hand-rule).
 */
export function loadBedrockModel(
  geo: BedrockGeometry,
  material: MeshLambertMaterial,
  scale = 1 / 16,
): LoadedModel {
  const def = geo['minecraft:geometry'][0]!;
  const { texture_width: tw, texture_height: th } = def.description;

  const root = new Group();
  const bones = new Map<string, Group>();
  const boneDefs = new Map<string, BedrockBone>();

  for (const bone of def.bones) {
    const group = new Group();
    group.name = bone.name;
    bones.set(bone.name, group);
    boneDefs.set(bone.name, bone);
  }

  for (const bone of def.bones) {
    const group = bones.get(bone.name)!;
    const [px, py, pz] = bone.pivot;

    if (bone.parent) {
      const parentGroup = bones.get(bone.parent)!;
      const parentDef = boneDefs.get(bone.parent)!;
      group.position.set(
        (px - parentDef.pivot[0]) * scale,
        (py - parentDef.pivot[1]) * scale,
        (pz - parentDef.pivot[2]) * scale,
      );
      parentGroup.add(group);
    } else {
      group.position.set(px * scale, py * scale, pz * scale);
      root.add(group);
    }

    if (!bone.cubes) continue;

    for (const cube of bone.cubes) {
      const [w, h, d] = cube.size;
      const geometry = new BoxGeometry(w * scale, h * scale, d * scale);
      applyMinecraftCuboidUVs(geometry, cube.uv[0], cube.uv[1], w, h, d, tw, th);

      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const cx = cube.origin[0] + w / 2;
      const cy = cube.origin[1] + h / 2;
      const cz = cube.origin[2] + d / 2;

      if (cube.rotation) {
        const cpx = cube.pivot?.[0] ?? cx;
        const cpy = cube.pivot?.[1] ?? cy;
        const cpz = cube.pivot?.[2] ?? cz;

        mesh.position.set(
          (cx - cpx) * scale,
          (cy - cpy) * scale,
          (cz - cpz) * scale,
        );

        const wrapper = new Group();
        wrapper.position.set(
          (cpx - px) * scale,
          (cpy - py) * scale,
          (cpz - pz) * scale,
        );
        wrapper.rotation.order = 'ZYX';
        wrapper.rotation.set(
          -cube.rotation[0] * DEG2RAD,
          -cube.rotation[1] * DEG2RAD,
          -cube.rotation[2] * DEG2RAD,
        );
        wrapper.add(mesh);
        group.add(wrapper);
      } else {
        mesh.position.set(
          (cx - px) * scale,
          (cy - py) * scale,
          (cz - pz) * scale,
        );
        group.add(mesh);
      }
    }
  }

  return { root, bones };
}
