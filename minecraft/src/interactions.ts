import {
  BoxGeometry,
  Camera,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import type { ToolRegistry } from './tools/registry';
import type { BlockIntersection, ToolAction } from './tools/types';
import type { World } from './world';
import { getBlockType } from './world';

interface RaycastBlockSource {
  getRaycastTargets(): Object3D[];
}

interface InteractionManagerParams {
  domElement: HTMLElement;
  camera: Camera;
  scene: Scene;
  world: World;
  tools: ToolRegistry;
  blockSource: RaycastBlockSource;
  onAction: (action: ToolAction) => void;
}

export class InteractionManager {
  private readonly domElement: HTMLElement;
  private readonly camera: Camera;
  private readonly world: World;
  private readonly tools: ToolRegistry;
  private readonly blockSource: RaycastBlockSource;
  private readonly onAction: (action: ToolAction) => void;
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private hoverDirty = false;
  private readonly hoverOutline: LineSegments;
  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerLeaveBound: () => void;

  constructor(params: InteractionManagerParams) {
    this.domElement = params.domElement;
    this.camera = params.camera;
    this.world = params.world;
    this.tools = params.tools;
    this.blockSource = params.blockSource;
    this.onAction = params.onAction;

    const hoverGeometry = new EdgesGeometry(new BoxGeometry(1.02, 1.02, 1.02));
    const hoverMaterial = new LineBasicMaterial({ color: 0xfff176, transparent: true, opacity: 0.9 });
    this.hoverOutline = new LineSegments(hoverGeometry, hoverMaterial);
    this.hoverOutline.visible = false;
    this.hoverOutline.renderOrder = 2;
    params.scene.add(this.hoverOutline);

    this.onPointerMoveBound = (event) => this.onPointerMove(event);
    this.onPointerDownBound = (event) => this.onPointerDown(event);
    this.onPointerLeaveBound = () => {
      this.hoverDirty = false;
      this.hoverOutline.visible = false;
    };

    this.domElement.addEventListener('pointermove', this.onPointerMoveBound);
    this.domElement.addEventListener('pointerdown', this.onPointerDownBound);
    this.domElement.addEventListener('pointerleave', this.onPointerLeaveBound);
  }

  update(): void {
    if (!this.hoverDirty) {
      return;
    }
    const hit = this.raycastFromNdc(this.pointerNdc);
    if (!hit) {
      this.hoverOutline.visible = false;
      return;
    }

    const pos = hit.object.userData.voxelPos as [number, number, number] | undefined;
    if (!pos) {
      this.hoverOutline.visible = false;
      return;
    }

    this.hoverOutline.visible = true;
    this.hoverOutline.position.set(pos[0], pos[1], pos[2]);
  }

  destroy(): void {
    this.domElement.removeEventListener('pointermove', this.onPointerMoveBound);
    this.domElement.removeEventListener('pointerdown', this.onPointerDownBound);
    this.domElement.removeEventListener('pointerleave', this.onPointerLeaveBound);
    this.hoverOutline.geometry.dispose();
    (this.hoverOutline.material as LineBasicMaterial).dispose();
    this.hoverOutline.removeFromParent();
  }

  private onPointerMove(event: PointerEvent): void {
    this.updatePointer(event);
    this.hoverDirty = true;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.updatePointer(event);
    const hit = this.raycastFromNdc(this.pointerNdc);
    if (!hit) {
      return;
    }

    const intersection = this.toBlockIntersection(hit);
    if (!intersection) {
      return;
    }

    const activeTool = this.tools.getActive();
    const action = activeTool.onPrimary(intersection, this.world);
    if (action) {
      this.onAction(action);
    }
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerNdc.set(x, y);
  }

  private raycastFromNdc(pointerNdc: Vector2) {
    this.raycaster.setFromCamera(pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.blockSource.getRaycastTargets(), false);
    return hits[0];
  }

  private toBlockIntersection(hit: ReturnType<Raycaster['intersectObjects']>[number]): BlockIntersection | null {
    const pos = hit.object.userData.voxelPos as [number, number, number] | undefined;
    if (!pos) {
      return null;
    }

    const [x, y, z] = pos;
    const blockType = getBlockType(this.world, x, y, z);
    const normal = alignToAxis(hit.face?.normal ?? new Vector3(0, 1, 0), hit.object);

    return {
      pos,
      normal,
      blockType,
    };
  }
}

function alignToAxis(localNormal: Vector3, object: Object3D): [number, number, number] {
  const worldNormal = localNormal.clone().transformDirection(object.matrixWorld);
  const absX = Math.abs(worldNormal.x);
  const absY = Math.abs(worldNormal.y);
  const absZ = Math.abs(worldNormal.z);

  if (absX >= absY && absX >= absZ) {
    return [Math.sign(worldNormal.x) || 1, 0, 0];
  }
  if (absY >= absX && absY >= absZ) {
    return [0, Math.sign(worldNormal.y) || 1, 0];
  }
  return [0, 0, Math.sign(worldNormal.z) || 1];
}
