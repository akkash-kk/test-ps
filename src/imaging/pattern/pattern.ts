import type { RGBA8 } from '../types';

export type Pattern = {
  id: string;
  name: string;
  tile: RGBA8;
};

export type PatternTransform = {
  scale?: number;
  angle?: number;
  offset?: { x: number; y: number };
};

export function samplePattern(
  tile: RGBA8,
  u: number,
  v: number,
  out: [number, number, number, number] | number[] | Float32Array
): void {
  const tw = tile.width;
  const th = tile.height;
  const d = tile.data;
  const fx = Math.floor(u);
  const fy = Math.floor(v);
  const tx = u - fx;
  const ty = v - fy;
  let x0 = fx % tw;
  let y0 = fy % th;
  if (x0 < 0) x0 += tw;
  if (y0 < 0) y0 += th;
  const x1 = (x0 + 1) % tw;
  const y1 = (y0 + 1) % th;
  const i00 = (y0 * tw + x0) * 4;
  const i10 = (y0 * tw + x1) * 4;
  const i01 = (y1 * tw + x0) * 4;
  const i11 = (y1 * tw + x1) * 4;
  const w00 = (1 - tx) * (1 - ty) * (d[i00 + 3] / 255);
  const w10 = tx * (1 - ty) * (d[i10 + 3] / 255);
  const w01 = (1 - tx) * ty * (d[i01 + 3] / 255);
  const w11 = tx * ty * (d[i11 + 3] / 255);
  const sum = w00 + w10 + w01 + w11;
  if (sum <= 0) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return;
  }
  const inv = 1 / sum;
  out[0] = (d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11) * inv;
  out[1] = (d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11) * inv;
  out[2] = (d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11) * inv;
  out[3] = sum;
}

export function renderPattern(
  width: number,
  height: number,
  pattern: Pattern,
  transform: PatternTransform = {},
  origin: { x: number; y: number } = { x: 0, y: 0 }
): RGBA8 {
  const out: RGBA8 = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
  const rect = { x: origin.x, y: origin.y, width, height };
  const scale = transform.scale ?? 1;
  const angle = transform.angle ?? 0;
  const offset = transform.offset ?? { x: 0, y: 0 };
  const { width: tw, height: th, data: d } = pattern.tile;
  const o = out.data;

  if (scale === 1 && angle === 0 && Number.isInteger(offset.x) && Number.isInteger(offset.y)) {
    const ox = Math.round(offset.x);
    const oy = Math.round(offset.y);
    for (let y = 0; y < height; y++) {
      const py = (((rect.y + y - oy) % th) + th) % th;
      let di = y * width * 4;
      for (let x = 0; x < width; x++, di += 4) {
        const px = (((rect.x + x - ox) % tw) + tw) % tw;
        const si = (py * tw + px) * 4;
        o[di] = d[si];
        o[di + 1] = d[si + 1];
        o[di + 2] = d[si + 2];
        o[di + 3] = d[si + 3];
      }
    }
    return out;
  }

  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a) / scale;
  const s = Math.sin(a) / scale;
  for (let y = 0; y < height; y++) {
    const dy = rect.y + y + 0.5 - offset.y;
    const dx0 = rect.x + 0.5 - offset.x;
    let u = c * dx0 - s * dy - 0.5;
    let v = s * dx0 + c * dy - 0.5;
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4, u += c, v += s) {
      const fx = Math.floor(u);
      const fy = Math.floor(v);
      const tx = u - fx;
      const ty = v - fy;
      let x0 = fx % tw;
      let y0 = fy % th;
      if (x0 < 0) x0 += tw;
      if (y0 < 0) y0 += th;
      const x1 = (x0 + 1) % tw;
      const y1 = (y0 + 1) % th;
      const i00 = (y0 * tw + x0) * 4;
      const i10 = (y0 * tw + x1) * 4;
      const i01 = (y1 * tw + x0) * 4;
      const i11 = (y1 * tw + x1) * 4;
      const w00 = (1 - tx) * (1 - ty) * d[i00 + 3];
      const w10 = tx * (1 - ty) * d[i10 + 3];
      const w01 = (1 - tx) * ty * d[i01 + 3];
      const w11 = tx * ty * d[i11 + 3];
      const sum = w00 + w10 + w01 + w11;
      if (sum <= 0) continue;
      const inv = 1 / sum;
      o[i] = (d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11) * inv;
      o[i + 1] = (d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11) * inv;
      o[i + 2] = (d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11) * inv;
      o[i + 3] = sum;
    }
  }
  return out;
}
