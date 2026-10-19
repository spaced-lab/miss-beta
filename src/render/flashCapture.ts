// WHAT: Dev-only driver for the flash meter (IDEAS 34): capture a canvas for a while and measure its flashes.
// WHY:  The measurement must use what actually reaches the screen; this copies frames as they are drawn.
// HOW:  Each animation frame the canvas is drawn into a 256-px-wide copy and read back; the frames go to
//       measureFlashes with the 10-degree field taken as 341 x 256 CSS px (WCAG's reference at 1024 x 768), scaled to
//       the copy. Nothing in the game imports this module, so it is not in the shipped bundle. Use from the dev console:
//         const { captureFlashes } = await import('/src/render/flashCapture.ts');
//         await captureFlashes(document.querySelector('canvas'), 5000);
//       Captures run at the page's frame rate (30 to 60 fps): enough for cuts and the 0.12 s hit flash; render a
//       cinematic frame by frame (renderScene at k / 60) when exact timing matters.
// LORE: G8 (the look, and the sound)

import { measureFlashes, type FlashFrame, type FlashReport } from './flashMeter';

export async function captureFlashes(canvas: HTMLCanvasElement, ms: number): Promise<FlashReport & { fps: number }> {
  const box = canvas.getBoundingClientRect();
  const W = 256;
  const H = Math.max(1, Math.round((W * box.height) / box.width));
  const copy = document.createElement('canvas');
  copy.width = W;
  copy.height = H;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  const frames: FlashFrame[] = [];
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const grab = (): void => {
      ctx.drawImage(canvas, 0, 0, W, H);
      frames.push({ t: performance.now() - t0, width: W, height: H, rgba: ctx.getImageData(0, 0, W, H).data });
      if (performance.now() - t0 < ms) requestAnimationFrame(grab);
      else done();
    };
    requestAnimationFrame(grab);
  });
  const scale = W / box.width;
  return { ...measureFlashes(frames, { w: 341 * scale, h: 256 * scale }), fps: Math.round(frames.length / (ms / 1000)) };
}
