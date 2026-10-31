// The slice of three (0.187.0) and @mkkellogg/gaussian-splats-3d (0.4.7) that ./scene.ts calls
// (room-scene design S11). Neither package ships types and @types/three isn't installed, so this
// declares only those members. Only scene.ts imports these modules, and only by dynamic import.
declare module "three" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }
  export class PerspectiveCamera {
    constructor(fov: number, aspect: number, near: number, far: number);
    readonly position: Vector3;
    readonly up: Vector3;
    aspect: number;
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
  }
  export class WebGLRenderer {
    constructor(params: { canvas: HTMLCanvasElement; antialias?: boolean; alpha?: boolean; powerPreference?: string });
    readonly domElement: HTMLCanvasElement;
    setPixelRatio(r: number): void;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    setClearColor(color: number, alpha?: number): void;
    dispose(): void;
  }
}

declare module "@mkkellogg/gaussian-splats-3d" {
  import type { PerspectiveCamera, WebGLRenderer } from "three";
  export const SceneFormat: { readonly Splat: number };
  export const SceneRevealMode: { readonly Instant: number };
  export const LogLevel: { readonly None: number };
  export class Viewer {
    constructor(options: {
      selfDrivenMode?: boolean;
      renderer?: WebGLRenderer;
      camera?: PerspectiveCamera;
      useBuiltInControls?: boolean;
      sharedMemoryForWorkers?: boolean;
      gpuAcceleratedSort?: boolean;
      ignoreDevicePixelRatio?: boolean;
      sceneRevealMode?: number;
      logLevel?: number;
      dynamicScene?: boolean;
    });
    addSplatScene(path: string, options?: { showLoadingUI?: boolean; progressiveLoad?: boolean; format?: number }): PromiseLike<void>;
    update(): void;
    render(): void;
    dispose(): Promise<void> | void;
  }
}
