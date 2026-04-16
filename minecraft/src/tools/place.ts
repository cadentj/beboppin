import type { BlockType } from '../world';
import { getBlockType, isInBounds } from '../world';
import type { Tool, ToolAction } from './types';

export class PlaceTool implements Tool {
  public readonly id = 'place';
  public readonly icon = '🧱';
  public label = 'Place';
  public placeBlockType: BlockType;

  private readonly placeableTypes: BlockType[];
  private placeIndex: number;

  constructor(placeableTypes: BlockType[], initialType: BlockType = placeableTypes[0] ?? 'grass') {
    this.placeableTypes = [...placeableTypes];
    this.placeIndex = Math.max(0, this.placeableTypes.findIndex((type) => type === initialType));
    this.placeBlockType = this.placeableTypes[this.placeIndex] ?? 'grass';
    this.refreshLabel();
  }

  onPrimary(target: Parameters<Tool['onPrimary']>[0], world: Parameters<Tool['onPrimary']>[1]): ToolAction | null {
    const [x, y, z] = target.pos;
    const [nx, ny, nz] = target.normal;
    const placePos: [number, number, number] = [x + nx, y + ny, z + nz];

    if (!isInBounds(world, placePos[0], placePos[1], placePos[2])) {
      return null;
    }

    if (getBlockType(world, placePos[0], placePos[1], placePos[2]) !== 'air') {
      return null;
    }

    return {
      type: 'place',
      pos: placePos,
      blockType: this.placeBlockType,
    };
  }

  cycleBlockType(): void {
    if (this.placeableTypes.length === 0) {
      return;
    }
    this.placeIndex = (this.placeIndex + 1) % this.placeableTypes.length;
    this.placeBlockType = this.placeableTypes[this.placeIndex]!;
    this.refreshLabel();
  }

  private refreshLabel(): void {
    this.label = `Place (${this.placeBlockType})`;
  }
}
