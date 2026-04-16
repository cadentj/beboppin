import type { Tool, ToolAction } from './types';
import { isInBounds } from '../world';

export class DestroyTool implements Tool {
  public readonly id = 'destroy';
  public readonly icon = '⛏️';
  public label = 'Destroy';

  onPrimary(target: Parameters<Tool['onPrimary']>[0], world: Parameters<Tool['onPrimary']>[1]): ToolAction | null {
    const [x, y, z] = target.pos;
    if (!isInBounds(world, x, y, z) || target.blockType === 'air') {
      return null;
    }

    return {
      type: 'destroy',
      pos: [x, y, z],
      blockType: target.blockType,
    };
  }
}
