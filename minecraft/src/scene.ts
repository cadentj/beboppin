import {
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { World } from './world';

export interface SceneBundle {
  scene: Scene;
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
  destroy: () => void;
}

export function createScene(container: HTMLElement, world: World): SceneBundle {
  const scene = new Scene();

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const center = new Vector3((world.sizeX - 1) / 2, (world.sizeY - 1) / 2, (world.sizeZ - 1) / 2);

  const worldDiag = Math.sqrt(world.sizeX ** 2 + world.sizeZ ** 2);
  const padding = 2;
  const viewSize = worldDiag + padding;
  const distance = viewSize * 1.6;
  const azimuth = Math.PI / 4;
  const elevation = Math.atan(1 / Math.sqrt(2));

  camera.position.set(
    center.x + distance * Math.cos(elevation) * Math.cos(azimuth),
    center.y + distance * Math.sin(elevation),
    center.z + distance * Math.cos(elevation) * Math.sin(azimuth),
  );
  camera.lookAt(center);

  const ambient = new AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const sun = new DirectionalLight(0xffffff, 1.0);
  sun.position.set(center.x + 8, center.y + 14, center.z - 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowRange = Math.max(world.sizeX, world.sizeY, world.sizeZ) + 4;
  sun.shadow.camera.left = -shadowRange;
  sun.shadow.camera.right = shadowRange;
  sun.shadow.camera.top = shadowRange;
  sun.shadow.camera.bottom = -shadowRange;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = shadowRange * 4;
  sun.target.position.copy(center);
  scene.add(sun.target);
  scene.add(sun);

  const resize = (): void => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const aspect = width / height;
    camera.left = (-viewSize * aspect) / 2;
    camera.right = (viewSize * aspect) / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize();
  const observer = new ResizeObserver(() => resize());
  observer.observe(container);

  return {
    scene,
    camera,
    renderer,
    destroy: () => {
      observer.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
