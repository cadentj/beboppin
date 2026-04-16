import { Clock } from 'three';
import { AnimationSystem, LeafSwayAnimator, WaterAnimator } from './animations';
import { BlockMeshManager, type BlockAssets, loadBlockAssets } from './blocks';
import { InteractionManager } from './interactions';
import { createScene, type SceneBundle } from './scene';
import { DestroyTool } from './tools/destroy';
import { PlaceTool } from './tools/place';
import { ToolRegistry } from './tools/registry';
import type { Reactor, ToolAction } from './tools/types';
import { ChickenMob } from './mobs/chicken';
import { findRandomStandableCell, MobManager } from './mobs/mob';
import { createToolbar } from './ui';
import type { BlockType, Vec3 } from './world';
import { createDefaultWorld, getBlockType, getNeighborhoodInBounds, isFlowerBlock, setBlockType } from './world';
import './style.css';

export interface MountFarmOptions {
  width?: number;
  height?: number;
}

const PLACEABLE_TYPES: BlockType[] = ['grass', 'dirt', 'stone', 'water', 'log', 'leaves', 'planks', 'sand'];

export function mountFarm(
  container: HTMLElement,
  options: MountFarmOptions = {},
): {
  destroy: () => void;
} {
  const host = document.createElement('div');
  host.className = 'farm-root';
  host.style.position = 'relative';
  host.style.width = options.width ? `${options.width}px` : '100%';
  host.style.height = options.height ? `${options.height}px` : '460px';
  container.appendChild(host);

  let world = createDefaultWorld();
  const animationSystem = new AnimationSystem();
  const reactors: Reactor[] = [];
  const clock = new Clock();

  const toolRegistry = new ToolRegistry();
  const destroyTool = new DestroyTool();
  const placeTool = new PlaceTool(PLACEABLE_TYPES, 'grass');
  toolRegistry.register(destroyTool);
  toolRegistry.register(placeTool);
  toolRegistry.setActive(destroyTool.id);

  const toolbar = createToolbar(host, toolRegistry);

  let disposed = false;
  let frameId = 0;
  let sceneBundle: SceneBundle | undefined;
  let blockManager: BlockMeshManager | undefined;
  let interaction: InteractionManager | undefined;
  let waterAnimator: WaterAnimator | undefined;
  let assets: BlockAssets | undefined;
  let mobManager: MobManager | undefined;

  const syncSwayAnimatorAt = (x: number, y: number, z: number): void => {
    const animatorId = `sway:${x},${y},${z}`;
    animationSystem.unregister(animatorId);

    if (!blockManager) {
      return;
    }

    const blockType = getBlockType(world, x, y, z);
    if (blockType !== 'leaves' && !isFlowerBlock(blockType)) {
      return;
    }

    const mesh = blockManager.getMeshAt(x, y, z);
    if (!mesh) {
      return;
    }

    animationSystem.register(animatorId, new LeafSwayAnimator(mesh, x, z));
  };

  const syncSwayAnimatorsAround = (pos: Vec3): void => {
    for (const [x, y, z] of getNeighborhoodInBounds(world, pos)) {
      syncSwayAnimatorAt(x, y, z);
    }
  };

  const runReactors = (action: ToolAction): void => {
    for (const reactor of reactors) {
      reactor.handle(action, world);
    }
  };

  const applyAction = (action: ToolAction): void => {
    let nextType: BlockType | null = null;
    if (action.type === 'destroy') {
      nextType = 'air';
    } else if (action.type === 'place' && action.blockType) {
      nextType = action.blockType;
    }

    if (!nextType || !blockManager) {
      return;
    }

    const change = setBlockType(world, action.pos, nextType);
    if (!change) {
      return;
    }

    const [x, y, z] = action.pos;
    blockManager.updateBlockAndNeighbors(x, y, z);
    syncSwayAnimatorsAround(action.pos);
    runReactors(action);
  };

  const startLoop = (): void => {
    const tick = (): void => {
      if (disposed || !sceneBundle) {
        return;
      }

      frameId = window.requestAnimationFrame(tick);
      const deltaTime = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      animationSystem.update(deltaTime, elapsed);
      interaction?.update();
      sceneBundle.renderer.render(sceneBundle.scene, sceneBundle.camera);
    };

    tick();
  };

  let regenerating = false;

  const buildWorld = (): void => {
    if (!sceneBundle || !assets) return;

    blockManager = new BlockMeshManager(sceneBundle.scene, world, assets);
    blockManager.buildInitial();

    for (let x = 0; x < world.sizeX; x += 1) {
      for (let y = 0; y < world.sizeY; y += 1) {
        for (let z = 0; z < world.sizeZ; z += 1) {
          syncSwayAnimatorAt(x, y, z);
        }
      }
    }

    interaction = new InteractionManager({
      domElement: sceneBundle.renderer.domElement,
      camera: sceneBundle.camera,
      scene: sceneBundle.scene,
      world,
      tools: toolRegistry,
      blockSource: blockManager,
      onAction: applyAction,
    });
  };

  const spawnMobs = async (): Promise<void> => {
    if (!sceneBundle) return;
    mobManager = new MobManager(sceneBundle.scene, animationSystem);
    for (let i = 0; i < 3; i += 1) {
      const cell = findRandomStandableCell(world, Math.random);
      if (!cell) break;
      const [gx, footY, gz] = cell;
      const chicken = await ChickenMob.create(world, gx, footY, gz);
      mobManager.add(chicken);
    }
  };

  const teardownWorld = (): void => {
    interaction?.destroy();
    interaction = undefined;
    mobManager?.dispose();
    mobManager = undefined;

    for (let x = 0; x < world.sizeX; x += 1) {
      for (let y = 0; y < world.sizeY; y += 1) {
        for (let z = 0; z < world.sizeZ; z += 1) {
          animationSystem.unregister(`sway:${x},${y},${z}`);
        }
      }
    }

    blockManager?.dispose();
    blockManager = undefined;
  };

  const regenerate = async (): Promise<void> => {
    if (regenerating || disposed || !sceneBundle || !assets) return;
    regenerating = true;
    try {
      teardownWorld();
      const seed = Math.random().toString(36).slice(2, 8);
      Object.assign(world, createDefaultWorld(seed));
      buildWorld();
      await spawnMobs();
    } finally {
      regenerating = false;
    }
  };

  const shuffleButton = document.createElement('button');
  shuffleButton.type = 'button';
  shuffleButton.className = 'farm-toolbar__button farm-shuffle';
  shuffleButton.textContent = '🎲 New World';
  shuffleButton.addEventListener('click', () => void regenerate());
  host.appendChild(shuffleButton);

  const initialize = async (): Promise<void> => {
    sceneBundle = createScene(host, world);
    assets = await loadBlockAssets();

    if (disposed || !sceneBundle) {
      assets.dispose();
      assets = undefined;
      return;
    }

    waterAnimator = new WaterAnimator(assets.textures.waterStill, assets.textures.waterFlow);
    animationSystem.register('water:global', waterAnimator);

    buildWorld();
    await spawnMobs();
    startLoop();
  };

  void initialize();

  return {
    destroy: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      window.cancelAnimationFrame(frameId);
      interaction?.destroy();
      mobManager?.dispose();
      mobManager = undefined;
      animationSystem.disposeAll();
      blockManager?.dispose();
      assets?.dispose();
      sceneBundle?.destroy();
      toolbar.destroy();
      shuffleButton.remove();
      if (host.parentElement === container) {
        container.removeChild(host);
      }
    },
  };
}