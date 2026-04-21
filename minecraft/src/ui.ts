import dirtUrl from '../assets/dirt.png';
import grassBlockTopUrl from '../assets/grass_block_top.png';
import oakLeavesUrl from '../assets/oak_leaves.png';
import oakLogUrl from '../assets/oak_log.png';
import oakPlanksUrl from '../assets/oak_planks.png';
import sandUrl from '../assets/sand.png';
import stoneUrl from '../assets/stone.png';
import waterStillUrl from '../assets/water_still.png';
import type { BlockType } from './world';
import type { ToolRegistry } from './tools/registry';
import type { Tool } from './tools/types';

interface ToolbarHandle {
  element: HTMLDivElement;
  destroy: () => void;
  refresh: () => void;
}

interface PlaceCycler extends Tool {
  placeBlockType: BlockType;
  cycleBlockType: () => void;
}

const PLACE_SPRITES: Record<BlockType, string> = {
  air: grassBlockTopUrl,
  grass: grassBlockTopUrl,
  dirt: dirtUrl,
  stone: stoneUrl,
  water: waterStillUrl,
  log: oakLogUrl,
  leaves: oakLeavesUrl,
  planks: oakPlanksUrl,
  sand: sandUrl,
  dandelion: grassBlockTopUrl,
  poppy: grassBlockTopUrl,
  cornflower: grassBlockTopUrl,
  allium: grassBlockTopUrl,
};

export function createToolbar(container: HTMLElement, registry: ToolRegistry): ToolbarHandle {
  const toolbar = document.createElement('div');
  toolbar.className = 'farm-toolbar';
  container.appendChild(toolbar);

  const render = (): void => {
    toolbar.innerHTML = '';
    const tools = registry.getAll();
    const activeTool = registry.getActive();

    for (const tool of tools) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'farm-toolbar__button';
      if (tool.id === activeTool.id) {
        button.classList.add('is-active');
      }

      if (isPlaceCycler(tool)) {
        button.appendChild(createPlaceButtonContent(tool));
      } else {
        button.textContent = `${tool.icon} ${tool.label}`;
      }

      button.addEventListener('click', () => {
        const currentActive = registry.getActive();
        if (currentActive.id === tool.id && isPlaceCycler(tool)) {
          tool.cycleBlockType();
          render();
          return;
        }
        registry.setActive(tool.id);
      });
      toolbar.appendChild(button);
    }
  };

  const unsubscribe = registry.subscribe(render);
  render();

  return {
    element: toolbar,
    destroy: () => {
      unsubscribe();
      if (toolbar.parentElement === container) {
        container.removeChild(toolbar);
      }
    },
    refresh: render,
  };
}

function isPlaceCycler(tool: Tool): tool is PlaceCycler {
  return typeof (tool as Partial<PlaceCycler>).cycleBlockType === 'function';
}

function createPlaceButtonContent(tool: PlaceCycler): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const label = document.createElement('span');
  label.textContent = tool.label;

  const sprite = document.createElement('img');
  sprite.className = 'farm-toolbar__sprite';
  sprite.src = PLACE_SPRITES[tool.placeBlockType];
  sprite.alt = `${tool.placeBlockType} block`;
  sprite.width = 16;
  sprite.height = 16;

  fragment.append(sprite, label);
  return fragment;
}
