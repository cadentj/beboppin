import type { ToolRegistry } from './tools/registry';
import type { Tool } from './tools/types';

interface ToolbarHandle {
  element: HTMLDivElement;
  destroy: () => void;
  refresh: () => void;
}

interface PlaceCycler extends Tool {
  cycleBlockType: () => void;
}

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

      button.textContent = `${tool.icon} ${tool.label}`;
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
