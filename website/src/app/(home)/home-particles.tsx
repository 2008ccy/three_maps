'use client';

import { useEffect, useId, useRef } from 'react';
import { withBasePath } from '@/lib/shared';
import styles from './home.module.css';

const artwork = withBasePath('/images/home/particle-surfaces.png');
// The source is a full-page mockup. These regions exclude its page copy and
// buttons even if a browser drops the decorative SVG mask or WebGL context.
const artworkRegions = [
  { x: 700, y: 90, width: 787, height: 660 },
  { x: 430, y: 500, width: 270, height: 250 },
  { x: 280, y: 600, width: 150, height: 150 },
];
const vertexSource = `
attribute vec2 a_position;
attribute vec2 a_offset;
varying vec2 v_point;
varying vec2 v_offset;
void main() {
  v_point = vec2(a_position.x * 1487.0, 90.0 + a_position.y * 660.0);
  v_offset = a_offset;
  gl_Position = vec4(a_position.x * 2.0 - 1.0, 1.0 - a_position.y * 2.0, 0.0, 1.0);
}`;
const fragmentSource = `
precision highp float;
uniform sampler2D u_image;
varying vec2 v_point;
varying vec2 v_offset;
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 d = b - a;
  return length(p - a - d * clamp(dot(p - a, d) / dot(d, d), 0.0, 1.0));
}
float rectGuard(vec2 p, vec4 r) {
  return smoothstep(0.0, 12.0, length(max(max(r.xy - p, p - r.zw), 0.0)));
}
void main() {
  vec2 p = v_point;
  float left = 680.0 - 390.0 * smoothstep(515.0, 665.0, p.y);
  float alpha = smoothstep(left, left + 105.0, p.x) * smoothstep(91.0, 130.0, p.y) * (1.0 - smoothstep(719.0, 749.0, p.y));
  float labels = max(max(1.0 - rectGuard(p,vec4(800.0,123.0,857.0,151.0)),1.0 - rectGuard(p,vec4(1300.0,268.0,1360.0,309.0))),1.0 - rectGuard(p,vec4(716.0,479.0,778.0,512.0)));
  alpha = max(alpha,labels);
  float motion = alpha * (1.0 - smoothstep(1420.0, 1487.0, p.x));
  motion *= rectGuard(p, vec4(800.0,123.0,857.0,151.0));
  motion *= rectGuard(p, vec4(1300.0,268.0,1360.0,309.0));
  motion *= rectGuard(p, vec4(716.0,479.0,778.0,512.0));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(849.0,146.0),vec2(883.0,146.0)));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(883.0,146.0),vec2(916.0,194.0)));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(1305.0,291.0),vec2(1274.0,291.0)));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(1274.0,291.0),vec2(1229.0,357.0)));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(766.0,502.0),vec2(791.0,502.0)));
  motion *= smoothstep(4.0,12.0,segmentDistance(p,vec2(791.0,502.0),vec2(821.0,566.0)));
  motion *= smoothstep(14.0,32.0,distance(p,vec2(916.0,194.0)));
  motion *= smoothstep(14.0,32.0,distance(p,vec2(1229.0,357.0)));
  motion *= smoothstep(14.0,32.0,distance(p,vec2(821.0,566.0)));
  vec2 uv = clamp((p + v_offset * motion) / vec2(1487.0,1058.0), vec2(0.0), vec2(1.0));
  vec4 pixel = texture2D(u_image,uv);
  gl_FragColor = vec4(pixel.rgb,alpha * pixel.a);
}`;

/** Preserve the selected artwork's point-cloud depth; animate its local currents on a small mesh. */
export function ParticleSurface() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const maskId = `particle-mask-${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const element = canvas.current, wrapper = host.current;
    if (!element || !wrapper) return;
    let gl: WebGLRenderingContext | null;
    try { gl = element.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { return; }
    if (!gl) return;
    const gpu = gl;
    const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
    let program: WebGLProgram | null = null, texture: WebGLTexture | null = null;
    let frame = 0, elapsed = 0, last = 0, loaded = false, disposed = false, visible = true, lost = false;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    function release() {
      buffers.forEach((buffer) => gpu.deleteBuffer(buffer));
      shaders.forEach((shader) => gpu.deleteShader(shader));
      if (texture) gpu.deleteTexture(texture);
      if (program) gpu.deleteProgram(program);
    }
    function compile(type: number, source: string) {
      const shader = gpu.createShader(type);
      if (!shader) throw new Error('Shader unavailable');
      shaders.push(shader); gpu.shaderSource(shader, source); gpu.compileShader(shader);
      if (!gpu.getShaderParameter(shader, gpu.COMPILE_STATUS)) throw new Error('Shader compilation failed');
      return shader;
    }
    const columns = 69, rows = 32;
    const positions = new Float32Array(columns * rows * 2), offsets = new Float32Array(positions.length);
    const indices = new Uint16Array((columns - 1) * (rows - 1) * 6);
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 2; positions[i] = x / (columns - 1); positions[i + 1] = y / (rows - 1);
      if (x < columns - 1 && y < rows - 1) {
        const a = y * columns + x, at = (y * (columns - 1) + x) * 6;
        indices.set([a,a + 1,a + columns,a + 1,a + columns + 1,a + columns], at);
      }
    }
    let offsetBuffer: WebGLBuffer | null = null;
    try {
      program = gpu.createProgram(); if (!program) throw new Error('Program unavailable');
      gpu.attachShader(program, compile(gpu.VERTEX_SHADER,vertexSource));
      gpu.attachShader(program, compile(gpu.FRAGMENT_SHADER,fragmentSource));
      gpu.linkProgram(program);
      if (!gpu.getProgramParameter(program,gpu.LINK_STATUS)) throw new Error('Program linking failed');
      gpu.useProgram(program);
      for (const [name,data,usage] of [['a_position',positions,gpu.STATIC_DRAW],['a_offset',offsets,gpu.DYNAMIC_DRAW]] as const) {
        const buffer = gpu.createBuffer(); if (!buffer) throw new Error('Buffer unavailable'); buffers.push(buffer);
        gpu.bindBuffer(gpu.ARRAY_BUFFER,buffer); gpu.bufferData(gpu.ARRAY_BUFFER,data,usage);
        const attr = gpu.getAttribLocation(program,name); gpu.enableVertexAttribArray(attr); gpu.vertexAttribPointer(attr,2,gpu.FLOAT,false,0,0);
        if (name === 'a_offset') offsetBuffer = buffer;
      }
      const indexBuffer = gpu.createBuffer(); if (!indexBuffer) throw new Error('Index buffer unavailable'); buffers.push(indexBuffer);
      gpu.bindBuffer(gpu.ELEMENT_ARRAY_BUFFER,indexBuffer); gpu.bufferData(gpu.ELEMENT_ARRAY_BUFFER,indices,gpu.STATIC_DRAW);
      texture = gpu.createTexture(); if (!texture) throw new Error('Texture unavailable');
      gpu.activeTexture(gpu.TEXTURE0); gpu.bindTexture(gpu.TEXTURE_2D,texture);
      gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_WRAP_S,gpu.CLAMP_TO_EDGE); gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_WRAP_T,gpu.CLAMP_TO_EDGE);
      gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_MIN_FILTER,gpu.LINEAR); gpu.texParameteri(gpu.TEXTURE_2D,gpu.TEXTURE_MAG_FILTER,gpu.LINEAR);
      gpu.uniform1i(gpu.getUniformLocation(program,'u_image'),0);
    } catch { release(); return; }

    let seed = 932617;
    const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const modes = Array.from({length:3}, () => Array.from({length:9},(_,k) => ({
      kx:(.0018 + random() * .008) * (random() > .5 ? 1 : -1), ky:(.003 + random() * .012) * (random() > .5 ? 1 : -1),
      frequency:1 + Math.floor(random() * 4), phase:random() * Math.PI * 2, amplitude:(1.1 + random() * 1.3) / (1 + k * .16),
    })));
    function paint(time: number) {
      if (!loaded || disposed || lost) return;
      const phase = time * Math.PI / 4;
      for (let i = 0; i < positions.length; i += 2) {
        const x = positions[i] * 1487, y = 90 + positions[i + 1] * 660;
        const centers = [205 - 25 * Math.sin(x * .005),380 - 25 * Math.sin(x * .006 + 1),603 + 36 * Math.sin(x * .005 + 2)];
        const bands = centers.map((c,j) => Math.exp(-.5 * ((y - c) / [60,93,105][j]) ** 2));
        const norm = bands.reduce((a,b) => a + b,0) + 1e-9;
        let dx = 0, dy = 0;
        for (let j = 0; j < 3; j++) {
          let ux = 0, uy = 0;
          for (const m of modes[j]) {
            const base = x * m.kx + y * m.ky + m.phase;
            const delta = Math.sin(base + phase * m.frequency) - Math.sin(base), length = Math.hypot(m.kx,m.ky);
            ux += delta * m.amplitude * m.ky / length; uy -= delta * m.amplitude * m.kx / length;
          }
          const ex = x - [925,1230,1040][j] - 28 * Math.sin(phase + j * 1.6), ey = y - centers[j] - 13 * Math.sin(phase * 2 + j);
          const q = Math.exp(-(ex * ex / 54000 + ey * ey / 5500));
          const strength = .022 * (Math.sin(phase + j * .9) - Math.sin(j * .9));
          ux -= ey * q * strength; uy += ex * q * strength;
          dx += ux * bands[j] / norm; dy += uy * bands[j] / norm;
        }
        offsets[i] = dx * 2.6; offsets[i + 1] = dy * 2.1;
      }
      gpu.bindBuffer(gpu.ARRAY_BUFFER,offsetBuffer); gpu.bufferSubData(gpu.ARRAY_BUFFER,0,offsets);
      gpu.clearColor(0,0,0,0); gpu.clear(gpu.COLOR_BUFFER_BIT); gpu.drawElements(gpu.TRIANGLES,indices.length,gpu.UNSIGNED_SHORT,0);
    }
    function draw(now: number) {
      frame = 0;
      if (disposed || lost || media.matches || document.hidden || !visible) return;
      const interval = window.innerWidth <= 650 ? 48 : 31;
      if (last && now - last < interval) { frame = requestAnimationFrame(draw); return; }
      elapsed += last ? Math.min((now - last) / 1000,.1) : 0; last = now;
      paint(elapsed); frame = requestAnimationFrame(draw);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (!loaded || disposed || lost) return;
      paint(media.matches ? 0 : elapsed);
      if (!media.matches && !document.hidden && visible) frame = requestAnimationFrame(draw);
    }
    function resize() {
      const rect = wrapper!.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1,1.5);
      element!.width = Math.round(rect.width * ratio); element!.height = Math.round(rect.height * ratio);
      gpu.viewport(0,0,element!.width,element!.height); sync();
    }
    function contextLost(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); wrapper!.dataset.ready = 'false'; }
    image.onload = () => {
      if (disposed || lost) return;
      try {
        const textureSource = document.createElement('canvas');
        textureSource.width = image.naturalWidth;
        textureSource.height = image.naturalHeight;
        const context = textureSource.getContext('2d');
        if (!context) return;
        for (const { x, y, width, height } of artworkRegions) {
          context.drawImage(image, x, y, width, height, x, y, width, height);
        }
        gpu.bindTexture(gpu.TEXTURE_2D,texture);
        gpu.texImage2D(gpu.TEXTURE_2D,0,gpu.RGBA,gpu.RGBA,gpu.UNSIGNED_BYTE,textureSource);
        loaded = true; resize(); wrapper.dataset.ready = 'true';
      } catch { wrapper.dataset.ready = 'false'; }
    };
    image.src = artwork;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); observer.observe(wrapper);
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(wrapper);
    element.addEventListener('webglcontextlost',contextLost); document.addEventListener('visibilitychange',sync); media.addEventListener('change',sync);
    return () => {
      disposed = true; cancelAnimationFrame(frame); image.onload = null; observer.disconnect(); resizeObserver.disconnect();
      element.removeEventListener('webglcontextlost',contextLost); document.removeEventListener('visibilitychange',sync); media.removeEventListener('change',sync);
      wrapper.dataset.ready = 'false'; release();
    };
  }, []);
  return <div ref={host} className={styles.scene} aria-hidden="true" data-ready="false">
    <svg className={styles.fallback} viewBox="0 90 1487 660" preserveAspectRatio="none" focusable="false">
      <defs>
        <filter id={`${maskId}-blur`} filterUnits="userSpaceOnUse" x="0" y="90" width="1487" height="660">
          <feGaussianBlur stdDeviation="15" />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="90" width="1487" height="660">
          <path d="M720 90H1510V750H290V665C290 595 650 570 680 500V90Z" fill="white" filter={`url(#${maskId}-blur)`} />
          <rect x="710" y="475" width="72" height="40" fill="white" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {artworkRegions.map(({ x, y, width, height }) => <svg key={x}
          x={x} y={y} width={width} height={height} viewBox={`${x} ${y} ${width} ${height}`}
          overflow="hidden" focusable="false">
          <image href={artwork} width="1487" height="1058" />
        </svg>)}
      </g>
    </svg>
    <canvas ref={canvas} className={styles.particles} aria-hidden="true" />
  </div>;
}
