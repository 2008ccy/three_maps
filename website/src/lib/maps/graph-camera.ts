type GraphSize = { width: number; height: number };
type GraphCamera = { x: number; y: number; scale: number };

export function zoomGraphCamera(camera: GraphCamera, factor: number, viewport: GraphSize, graph: GraphSize) {
  // A fitted mobile overview can be smaller than the desktop zoom minimum.
  // Keep that overview reachable without making the minus button zoom in.
  const minimum = Math.min(.4, viewport.width / graph.width, viewport.height / graph.height);
  const scale = Math.min(1.8, Math.max(minimum, camera.scale * factor));
  const ratio = scale / camera.scale;
  return {
    scale,
    x: viewport.width / 2 - (viewport.width / 2 - camera.x) * ratio,
    y: viewport.height / 2 - (viewport.height / 2 - camera.y) * ratio,
  };
}
