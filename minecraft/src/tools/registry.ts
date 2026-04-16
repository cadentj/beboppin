import type { Tool } from './types';

type RegistryListener = () => void;

export class ToolRegistry {
  private tools: Tool[] = [];
  private activeIndex = 0;
  private listeners = new Set<RegistryListener>();

  register(tool: Tool): void {
    this.tools.push(tool);
    this.emit();
  }

  getAll(): Tool[] {
    return [...this.tools];
  }

  getActive(): Tool {
    if (this.tools.length === 0) {
      throw new Error('No tools registered.');
    }
    return this.tools[this.activeIndex]!;
  }

  setActive(id: string): void {
    const nextIndex = this.tools.findIndex((tool) => tool.id === id);
    if (nextIndex === -1) {
      return;
    }
    this.activeIndex = nextIndex;
    this.emit();
  }

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
