import type { BlockType, Vec3, World } from '../world';

export interface ToolAction {
  type: string;
  pos: Vec3;
  blockType?: BlockType;
  [key: string]: unknown;
}

export interface BlockIntersection {
  pos: Vec3;
  normal: Vec3;
  blockType: BlockType;
}

export interface Tool {
  id: string;
  label: string;
  icon: string;
  onPrimary(target: BlockIntersection, world: World): ToolAction | null;
  onSecondary?(target: BlockIntersection, world: World): ToolAction | null;
}

export interface Reactor {
  handle(action: ToolAction, world: World): void;
}
