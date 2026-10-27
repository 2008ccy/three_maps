'use client';

import { useEffect, useRef } from 'react';
import type { HomePhase } from '@/lib/home-scene';
import styles from './home.module.css';

type Pixel = {
  x: number; y: number; drawX: number; drawY: number; offsetX: number; offsetY: number;
  size: number; grain: number; depth: number; speed: number;
  sinA: number; cosA: number; sinB: number; cosB: number; sinC: number; cosC: number;
};

/** 三层淡紫像素随同向缓流穿过画布，明暗纹理叠加其上。 */
export function DigitalParticleField({ phase }: { phase: HomePhase }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const targetGain = useRef(1);
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    targetGain.current = phase === 'intro' ? 1 : .9;
    refresh.current?.();
  }, [phase]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let context: CanvasRenderingContext2D | null;
    try { context = element.getContext('2d', { alpha: true }); } catch { return; }
    if (!context) return;
    const ctx = context;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const pointer = { x: 0, y: 0, active: false };
    let width = 0, height = 0, mobile = false, frame = 0, last = 0, elapsed = 0, gain = targetGain.current;
    let visible = true, disposed = false;
    let pixels: Pixel[] = [];
    const buckets: Pixel[][] = Array.from({ length: 48 }, () => []);
    const maxAlpha = .56;
    const shades = Array.from({ length: 48 }, (_, level) => `rgba(176,168,255,${level / 47 * maxAlpha})`);
    const margin = 24;
    const pointerRadius = 110;

    function clearPointer() { pointer.active = false; }
    function movePointer(event: PointerEvent) {
      if (event.pointerType !== 'mouse') { clearPointer(); return; }
      if (!finePointer.matches || media.matches) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
    }
    function leavePointer(event: PointerEvent) {
      if (!event.relatedTarget) clearPointer();
    }

    // 在可视区域外循环衔接，像素从边缘自然进入，不在画布内重生。
    function wrap(value: number, extent: number) {
      return value - Math.floor(value / extent) * extent - margin;
    }

    function resize() {
      clearPointer();
      width = window.innerWidth; height = window.innerHeight; mobile = width <= 768;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element!.width = Math.round(width * ratio); element!.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const pitch = mobile ? 10 : 11;
      const unit = Math.max(1, Math.min(width, height));
      pixels = [];
      let seed = 61027;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let y = -margin + pitch / 2; y < height + margin; y += pitch) {
        for (let x = -margin + pitch / 2; x < width + margin; x += pitch) {
          const noise = random();
          if (noise < .15) continue;
          const u = (x - width / 2) / unit, v = (y - height / 2) / unit;
          const a = u * 4.4 + v * 1.3, b = v * 4.2 - u * 1.1, c = (u + v) * 7.4;
          const depth = noise > .85 ? 2 : noise > .45 ? 1 : 0;
          pixels.push({ x, y, drawX: x, drawY: y, offsetX: 0, offsetY: 0, depth, speed: [2.2, 4.2, 7][depth],
            size: noise > .67 ? 3 : 2, grain: .6 + noise * .4,
            sinA: Math.sin(a), cosA: Math.cos(a), sinB: Math.sin(b), cosB: Math.cos(b), sinC: Math.sin(c), cosC: Math.cos(c) });
        }
      }
      sync();
    }

    function paint(time: number, dt = 0) {
      const sinA = Math.sin(time * .22), cosA = Math.cos(time * .22);
      const sinB = Math.sin(time * .15), cosB = Math.cos(time * .15);
      const sinC = Math.sin(time * .28), cosC = Math.cos(time * .28);
      const flowSin = Math.sin(time * .12), flowCos = Math.cos(time * .12);
      const driftScale = mobile ? .7 : 1;
      const spanX = width + margin * 2, spanY = height + margin * 2;
      const approach = 1 - Math.exp(-dt * 8), recover = 1 - Math.exp(-dt * 1.8);
      const canRepel = pointer.active && finePointer.matches && !media.matches;
      const core = document.querySelector('[data-home-core]')?.getBoundingClientRect();
      for (const bucket of buckets) bucket.length = 0;
      for (const pixel of pixels) {
        const travel = time * pixel.speed * driftScale;
        const sway = (5 + pixel.depth * 1.5) * driftScale;
        pixel.drawX = wrap(pixel.x + margin + travel
          + sway * (pixel.sinB * (flowCos - 1) + pixel.cosB * flowSin), spanX);
        pixel.drawY = wrap(pixel.y + margin - travel * (.3 + pixel.depth * .06)
          + sway * .6 * (pixel.sinA * (flowCos - 1) - pixel.cosA * flowSin), spanY);
        // 避让作为原流动轨迹上的小偏移，移开后缓慢归位，不改变基础速度。
        let targetX = 0, targetY = 0, nearby = false;
        if (canRepel) {
          const dx = pixel.drawX - pointer.x, dy = pixel.drawY - pointer.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < pointerRadius * pointerRadius) {
            nearby = true;
            const distance = Math.sqrt(distanceSquared);
            const proximity = 1 - distance / pointerRadius;
            const push = proximity * proximity * (3 - 2 * proximity) * (4 + pixel.depth * 3);
            targetX = (distance > .01 ? dx / distance : pixel.cosA) * push;
            targetY = (distance > .01 ? dy / distance : pixel.sinA) * push;
          }
        }
        if (media.matches) { pixel.offsetX = 0; pixel.offsetY = 0; }
        else {
          const blend = nearby ? approach : recover;
          pixel.offsetX += (targetX - pixel.offsetX) * blend;
          pixel.offsetY += (targetY - pixel.offsetY) * blend;
        }
        pixel.drawX += pixel.offsetX; pixel.drawY += pixel.offsetY;
        const current = .5 + .5 * (pixel.sinC * cosC + pixel.cosC * sinC);
        const field = Math.max(0, Math.min(1, .48 + .28 * (pixel.sinA * cosA + pixel.cosA * sinA)
          + .22 * (pixel.sinB * cosB - pixel.cosB * sinB)));
        // 按移动后的位置柔和降低文字周围的亮度，避免像素穿过边界时骤亮骤暗。
        const distance = core ? Math.max(core.left - pixel.drawX, pixel.drawX - core.right,
          core.top - pixel.drawY, pixel.drawY - core.bottom, 0) : 48;
        const fade = Math.min(1, distance / 48);
        const textGain = .1 + .9 * fade * fade * (3 - 2 * fade);
        // 宽阔的明暗纹理与较细的顺向亮带叠加，让整屏缓慢流动，避免整片同步闪烁。
        const alpha = (.065 + field * field * .36 + current ** 6 * .13) * pixel.grain * gain * textGain;
        const level = Math.max(0, Math.min(47, Math.round(alpha / maxAlpha * 47)));
        if (level) buckets[level].push(pixel);
      }
      ctx.clearRect(0, 0, width, height);
      for (let level = 1; level < buckets.length; level++) {
        ctx.fillStyle = shades[level];
        for (const pixel of buckets[level]) ctx.fillRect(Math.round(pixel.drawX - pixel.size / 2), Math.round(pixel.drawY - pixel.size / 2), pixel.size, pixel.size);
      }
    }

    function draw(now: number) {
      frame = 0;
      if (disposed || media.matches || document.hidden || !visible) return;
      // 纹理变化很慢，桌面约30fps、窄屏约20fps即可保持平稳。
      if (last && now - last < (mobile ? 48 : 31)) { frame = requestAnimationFrame(draw); return; }
      const dt = last ? Math.min((now - last) / 1000, .08) : 0;
      last = now;
      elapsed += dt;
      gain += (targetGain.current - gain) * (1 - Math.exp(-dt * 2.5));
      paint(elapsed, dt);
      frame = requestAnimationFrame(draw);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (disposed) return;
      if (media.matches || document.hidden || !visible) clearPointer();
      if (media.matches) { gain = targetGain.current; paint(0); }
      else if (visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    refresh.current = sync;
    const hero = document.querySelector('[data-home-hero]');
    const observer = typeof IntersectionObserver !== 'undefined' && hero ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }) : null;
    if (hero) observer?.observe(hero);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', movePointer, { passive: true });
    window.addEventListener('pointerout', leavePointer, { passive: true });
    window.addEventListener('blur', clearPointer);
    finePointer.addEventListener('change', clearPointer);
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', sync);
    return () => {
      disposed = true; refresh.current = null; cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
      window.removeEventListener('pointermove', movePointer); window.removeEventListener('pointerout', leavePointer);
      window.removeEventListener('blur', clearPointer); finePointer.removeEventListener('change', clearPointer);
    };
  }, []);

  return <canvas ref={canvas} className={styles.particles} aria-hidden="true" />;
}
