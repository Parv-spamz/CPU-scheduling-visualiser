// Procedural canvas textures for the bedroom around the board (no image files, no network).
import * as THREE from 'three';
import { cache, canvas, finish, rng } from '../kit/canvasTexture';

function memo(key: string, build: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const t = build();
  cache.set(key, t);
  return t;
}

/** Soft dark blob for contact shadows (use as alpha under a black material). */
export function blobTexture(): THREE.CanvasTexture {
  return memo('blob', () => {
    const [c, ctx] = canvas(128, 128);
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(26, 26, 76, 76, 18);
    ctx.fill();
    return finish(new THREE.CanvasTexture(c), false);
  });
}

/** Round woven rug in muted cream and charcoal. */
export function rugTexture(): THREE.CanvasTexture {
  return memo('rug', () => {
    const S = 512;
    const [c, ctx] = canvas(S, S);
    const rings = ['#6b6357', '#d8cfbf', '#3a3d44', '#d8cfbf', '#a89f90'];
    for (let i = 0; i < rings.length; i++) {
      ctx.fillStyle = rings[i]!;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2 - i * 46, 0, 7);
      ctx.fill();
    }
    const g = rng(5);
    for (let i = 0; i < 26000; i++) {
      ctx.fillStyle = g() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(g() * S, g() * S, 2, 2);
    }
    return finish(new THREE.CanvasTexture(c), true);
  });
}

type PosterKind = 'sunset' | 'planet' | 'invader' | 'waves';

/** Wall posters drawn from shapes (no readable text). */
export function posterTexture(kind: PosterKind): THREE.CanvasTexture {
  return memo(`poster-${kind}`, () => {
    const W = 512;
    const H = 704;
    const [c, ctx] = canvas(W, H);
    const g = rng(kind.length * 17);
    if (kind === 'sunset') {
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
      sky.addColorStop(0, '#2a1250');
      sky.addColorStop(0.6, '#ff5f9e');
      sky.addColorStop(1, '#ffb347');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff0b0';
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.46, 120, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ff5f9e';
      for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 130, H * 0.46 + 10 + i * 20, 260, 4 + i * 2);
      ctx.fillStyle = '#12082a';
      ctx.fillRect(0, H * 0.62, W, H);
      ctx.strokeStyle = '#38e8ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const y = H * 0.62 + Math.pow(i / 13, 2) * (H * 0.38);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 14, H * 0.62);
        ctx.lineTo(W / 2 + i * 70, H);
        ctx.stroke();
      }
    } else if (kind === 'planet') {
      ctx.fillStyle = '#0a1230';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + g() * 0.7})`;
        ctx.fillRect(g() * W, g() * H, 1 + g() * 2, 1 + g() * 2);
      }
      const gr = ctx.createRadialGradient(W * 0.4, H * 0.42, 10, W * 0.5, H * 0.5, 150);
      gr.addColorStop(0, '#ffd89a');
      gr.addColorStop(1, '#c4552b');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 140, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,230,255,0.85)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, 230, 52, -0.35, 0, 7);
      ctx.stroke();
    } else if (kind === 'invader') {
      ctx.fillStyle = '#0d1f17';
      ctx.fillRect(0, 0, W, H);
      const sprite = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
      const px = 36;
      ctx.fillStyle = '#57ff8a';
      sprite.forEach((row, y) =>
        [...row].forEach((v, x) => {
          if (v === '1') ctx.fillRect(W / 2 - (11 * px) / 2 + x * px, 150 + y * px, px - 4, px - 4);
        }),
      );
      ctx.fillStyle = '#38e8ff';
      for (let i = 0; i < 5; i++) ctx.fillRect(70 + i * 90, 560, 56, 14);
    } else {
      ctx.fillStyle = '#f2e9d8';
      ctx.fillRect(0, 0, W, H);
      const cols = ['#e0603a', '#2f7a78', '#1c2a44', '#f2c14e'];
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = cols[i % 4]!;
        ctx.lineWidth = 26;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = 110 + i * 42 + Math.sin(x / 38 + i * 0.7) * 22;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, W, H);
    return finish(new THREE.CanvasTexture(c), true);
  });
}

/** A monitor playing a code editor: coloured lines on dark. */
export function screenTexture(): THREE.CanvasTexture {
  return memo('screen', () => {
    const W = 640;
    const H = 360;
    const [c, ctx] = canvas(W, H);
    const g = rng(41);
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#141b2e';
    ctx.fillRect(0, 0, 150, H);
    const cols = ['#38e8ff', '#ff5f9e', '#ffd36b', '#57ff8a', '#8b6cff', '#c8d3e8'];
    for (let i = 0; i < 20; i++) {
      let x = 170 + (g() < 0.4 ? 0 : 30 * Math.floor(g() * 3));
      const y = 24 + i * 16;
      for (let k = 0; k < 1 + Math.floor(g() * 4); k++) {
        const w = 24 + g() * 90;
        ctx.fillStyle = cols[Math.floor(g() * cols.length)]!;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, w, 7);
        x += w + 8;
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = 'rgba(200,211,232,0.35)';
      ctx.fillRect(16, 24 + i * 22, 40 + g() * 80, 6);
    }
    return finish(new THREE.CanvasTexture(c), true);
  });
}

/** Night sky seen through the window: horizon haze, a soft moon, stars and two layers of skyline. */
export function nightSkyTexture(): THREE.CanvasTexture {
  return memo('night', () => {
    const W = 1024;
    const H = 1024;
    const [c, ctx] = canvas(W, H);
    const g = rng(8);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04070f');
    sky.addColorStop(0.55, '#0c1730');
    sky.addColorStop(0.85, '#2a2f4a');
    sky.addColorStop(1, '#5a4a52');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const haze = ctx.createRadialGradient(W / 2, H, 10, W / 2, H, W * 0.75);
    haze.addColorStop(0, 'rgba(255,170,100,0.35)');
    haze.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const y = g() * H * 0.62;
      const a = (0.15 + g() * 0.6) * (1 - y / (H * 0.7));
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      const r = g() < 0.9 ? 0.7 : 1.4;
      ctx.fillRect(g() * W, y, r, r);
    }
    const mx = 760;
    const my = 230;
    const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 220);
    halo.addColorStop(0, 'rgba(210,225,255,0.4)');
    halo.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    const disc = ctx.createRadialGradient(mx - 10, my - 10, 4, mx, my, 54);
    disc.addColorStop(0, '#f3f1e8');
    disc.addColorStop(1, '#d4d2c8');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(mx, my, 52, 0, 7);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(120,125,135,0.16)';
      ctx.beginPath();
      ctx.arc(mx + (g() - 0.5) * 70, my + (g() - 0.5) * 70, 4 + g() * 9, 0, 7);
      ctx.fill();
    }
    const city = (fill: string, minH: number, maxH: number, lit: number, blur: number) => {
      ctx.filter = blur ? `blur(${blur}px)` : 'none';
      let x = -10;
      while (x < W) {
        const w = 40 + g() * 90;
        const h = minH + g() * (maxH - minH);
        ctx.fillStyle = fill;
        ctx.fillRect(x, H - h, w, h);
        if (lit)
          for (let wy = H - h + 14; wy < H - 10; wy += 24)
            for (let wx = x + 8; wx < x + w - 12; wx += 18)
              if (g() < lit) {
                ctx.fillStyle = g() < 0.8 ? 'rgba(255,214,150,0.85)' : 'rgba(255,240,215,0.9)';
                ctx.fillRect(wx, wy, 7, 11);
              }
        x += w + 3;
      }
      ctx.filter = 'none';
    };
    city('#232a3e', 150, 330, 0, 3);
    city('#0a0d16', 90, 260, 0.2, 0.6);
    return finish(new THREE.CanvasTexture(c), true);
  });
}

/** Skateboard deck graphic. */
export function deckTexture(): THREE.CanvasTexture {
  return memo('deck', () => {
    const W = 128;
    const H = 512;
    const [c, ctx] = canvas(W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ff5f9e');
    bg.addColorStop(1, '#ffb347');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1c2a44';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 44, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#38e8ff';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 22, 0, 7);
    ctx.fill();
    return finish(new THREE.CanvasTexture(c), true);
  });
}

/** Phone lock screen: a dim wallpaper with a clock and notification shapes (no digits). */
export function phoneTexture(): THREE.CanvasTexture {
  return memo('phone', () => {
    const [c, ctx] = canvas(128, 256);
    const bg = ctx.createLinearGradient(0, 0, 128, 256);
    bg.addColorStop(0, '#0d1424');
    bg.addColorStop(1, '#2a3a5c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(36, 44, 56, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(50, 64, 28, 5);
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(10, 150 + i * 32, 108, 26, 8);
      ctx.fill();
    }
    return finish(new THREE.CanvasTexture(c), true);
  });
}

/**
 * Duvet relief, drawn as a height field (puffed quilt cells, stitched seams, soft folds) and turned into a normal map
 * plus a baked ambient-occlusion map. The cloth weave and colour come from the photographic texture.
 */
export function duvetMaps(): { normal: THREE.CanvasTexture; ao: THREE.CanvasTexture } {
  const hit = cache.get('duvetNormal') as THREE.CanvasTexture | undefined;
  if (hit) return { normal: hit, ao: cache.get('duvetAo') as THREE.CanvasTexture };
  const S = 1024;
  const [, h] = canvas(S, S);
  const g = rng(11);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, S, S);
  // Puffed cells: bright crowns.
  const cell = 120;
  for (let j = -1; j < S / (cell * 0.5) + 2; j++) {
    for (let i = -1; i < S / cell + 2; i++) {
      const cx = i * cell + (j % 2 ? cell / 2 : 0);
      const cy = j * cell * 0.5;
      const grad = h.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.62);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      h.fillStyle = grad;
      h.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
    }
  }
  // Pinched seams.
  h.filter = 'blur(2px)';
  h.strokeStyle = 'rgba(0,0,0,0.55)';
  h.lineWidth = 5;
  for (let k = -S; k <= 2 * S; k += cell) {
    h.beginPath();
    h.moveTo(k, 0);
    h.lineTo(k + S, S);
    h.moveTo(k + S, 0);
    h.lineTo(k, S);
    h.stroke();
  }
  h.filter = 'none';
  // Long soft folds, drawn as paired light and dark ridges on a blurred layer.
  const [fl, f] = canvas(S, S);
  f.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = g() * S;
    const y = g() * S;
    const len = 150 + g() * 420;
    const ang = (g() - 0.5) * 1.2 + (g() < 0.5 ? 0.4 : -0.4);
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const w = 22 + g() * 46;
    f.strokeStyle = `rgba(255,255,255,${0.22 + g() * 0.2})`;
    f.lineWidth = w;
    f.beginPath();
    f.moveTo(x, y);
    f.quadraticCurveTo(x + dx / 2 + 20, y + dy / 2 - 20, x + dx, y + dy);
    f.stroke();
    f.strokeStyle = `rgba(0,0,0,${0.25 + g() * 0.25})`;
    f.lineWidth = w * 0.8;
    f.beginPath();
    f.moveTo(x + w * 0.9, y + w * 0.5);
    f.quadraticCurveTo(x + dx / 2 + 20 + w * 0.9, y + dy / 2 - 20 + w * 0.5, x + dx + w * 0.9, y + dy + w * 0.5);
    f.stroke();
  }
  h.filter = 'blur(10px)';
  h.drawImage(fl, 0, 0);
  h.filter = 'none';

  const src = h.getImageData(0, 0, S, S).data;
  const hv = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) hv[i] = src[i * 4]! / 255;
  const [nc, nctx] = canvas(S, S);
  const [ac, actx] = canvas(S, S);
  const nImg = nctx.createImageData(S, S);
  const aImg = actx.createImageData(S, S);
  const strength = 5;
  const at = (x: number, y: number) => hv[((y + S) % S) * S + ((x + S) % S)]!;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * S + x) * 4;
      nImg.data[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      nImg.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255; // GL convention: +Y up in the image
      nImg.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nImg.data[o + 3] = 255;
      const v = Math.max(0, Math.min(1, 0.45 + at(x, y) * 0.7));
      aImg.data[o] = aImg.data[o + 1] = aImg.data[o + 2] = v * 255;
      aImg.data[o + 3] = 255;
    }
  }
  nctx.putImageData(nImg, 0, 0);
  actx.putImageData(aImg, 0, 0);
  const normal = finish(new THREE.CanvasTexture(nc), false);
  const ao = finish(new THREE.CanvasTexture(ac), false);
  cache.set('duvetNormal', normal);
  cache.set('duvetAo', ao);
  return { normal, ao };
}

/** Wall ambient occlusion: darker toward the floor, ceiling and corners. */
export function wallAoTexture(): THREE.CanvasTexture {
  return memo('wallAo', () => {
    const [c, ctx] = canvas(8, 256);
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5a5a5a');
    grad.addColorStop(0.12, '#c8c8c8');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(0.88, '#c8c8c8');
    grad.addColorStop(1, '#4a4a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 256);
    return finish(new THREE.CanvasTexture(c), false);
  });
}
