import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  ImageManipulator = null;
}

/* ========================================================================== */
/* Fast Pure TypeScript Base64 Encoder / Decoder                              */
/* ========================================================================== */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let res = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    res += B64_CHARS[b0 >> 2];
    res += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    res += i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    res += i + 2 < len ? B64_CHARS[b2 & 63] : '=';
  }
  return res;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);
  const byteLen = Math.floor((len * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(byteLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)];
    const c1 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c2 = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const c3 = B64_LOOKUP[clean.charCodeAt(i + 3)];

    if (p < byteLen) bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (p < byteLen) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (p < byteLen) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

/* ========================================================================== */
/* CRC-32 & Adler-32 Checksums                                                */
/* ========================================================================== */

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array, offset = 0, length = buf.length - offset): number {
  let crc = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

/* ========================================================================== */
/* Pure TypeScript PNG Encoder (32-bit RGBA)                                  */
/* ========================================================================== */

export function encodeRgbaToPng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const bytesPerScanline = 1 + width * 4;
  const rawData = new Uint8Array(height * bytesPerScanline);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * bytesPerScanline;
    rawData[rawOffset] = 0; // Filter: None
    const pixelRowOffset = y * width * 4;
    rawData.set(pixels.subarray(pixelRowOffset, pixelRowOffset + width * 4), rawOffset + 1);
  }

  const MAX_BLOCK_LEN = 32768;
  const numBlocks = Math.ceil(rawData.length / MAX_BLOCK_LEN) || 1;
  const zlibLen = 2 + numBlocks * 5 + rawData.length + 4;
  const zlibData = new Uint8Array(zlibLen);

  zlibData[0] = 0x78;
  zlibData[1] = 0x01;
  let zPos = 2;

  for (let i = 0; i < rawData.length; i += MAX_BLOCK_LEN) {
    const isLast = (i + MAX_BLOCK_LEN >= rawData.length);
    const blockLen = Math.min(MAX_BLOCK_LEN, rawData.length - i);
    const nBlockLen = (~blockLen) & 0xffff;

    zlibData[zPos++] = isLast ? 0x01 : 0x00;
    zlibData[zPos++] = blockLen & 0xff;
    zlibData[zPos++] = (blockLen >> 8) & 0xff;
    zlibData[zPos++] = nBlockLen & 0xff;
    zlibData[zPos++] = (nBlockLen >> 8) & 0xff;

    zlibData.set(rawData.subarray(i, i + blockLen), zPos);
    zPos += blockLen;
  }

  const adler = adler32(rawData);
  zlibData[zPos++] = (adler >> 24) & 0xff;
  zlibData[zPos++] = (adler >> 16) & 0xff;
  zlibData[zPos++] = (adler >> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  const totalPngLen = 8 + (12 + 13) + (12 + zlibLen) + (12 + 0);
  const png = new Uint8Array(totalPngLen);
  let pos = 0;

  // Signature
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pos); pos += 8;

  // IHDR
  writeUint32(png, pos, 13); pos += 4;
  const ihdrStart = pos;
  writeString(png, pos, 'IHDR'); pos += 4;
  writeUint32(png, pos, width); pos += 4;
  writeUint32(png, pos, height); pos += 4;
  png[pos++] = 8; // 8-bit
  png[pos++] = 6; // RGBA
  png[pos++] = 0;
  png[pos++] = 0;
  png[pos++] = 0;
  writeUint32(png, pos, crc32(png, ihdrStart, 17)); pos += 4;

  // IDAT
  writeUint32(png, pos, zlibLen); pos += 4;
  const idatStart = pos;
  writeString(png, pos, 'IDAT'); pos += 4;
  png.set(zlibData, pos); pos += zlibLen;
  writeUint32(png, pos, crc32(png, idatStart, 4 + zlibLen)); pos += 4;

  // IEND
  writeUint32(png, pos, 0); pos += 4;
  const iendStart = pos;
  writeString(png, pos, 'IEND'); pos += 4;
  writeUint32(png, pos, crc32(png, iendStart, 4)); pos += 4;

  return png;
}

function writeUint32(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function writeString(buf: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

/* ========================================================================== */
/* Robust RFC 1950 / RFC 1951 Deflate Decompressor                            */
/* ========================================================================== */

function inflateRaw(input: Uint8Array, expectedSize: number): Uint8Array {
  const output = new Uint8Array(expectedSize);
  let inPos = 0;
  let outPos = 0;
  let bitBuf = 0;
  let bitLen = 0;

  const readBits = (n: number): number => {
    while (bitLen < n) {
      if (inPos >= input.length) return 0;
      bitBuf |= (input[inPos++] << bitLen);
      bitLen += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitLen -= n;
    return val;
  };

  // Correct RFC 1950 zlib header detection (any compression level 0..9, with or without dictionary)
  if (input.length >= 2 && (input[0] & 0x0f) === 8 && ((input[0] * 256 + input[1]) % 31 === 0)) {
    inPos = 2;
    if ((input[1] & 0x20) !== 0) {
      inPos += 4; // Skip DICTID
    }
  }

  let isLastBlock = false;
  while (!isLastBlock && inPos <= input.length && outPos < expectedSize) {
    isLastBlock = readBits(1) === 1;
    const btype = readBits(2);

    if (btype === 0) {
      // Uncompressed block: discard padding bits to align with byte boundary
      bitBuf = 0;
      bitLen = 0;
      if (inPos + 4 > input.length) break;
      const len = input[inPos] | (input[inPos + 1] << 8);
      inPos += 4;
      const copyLen = Math.min(len, expectedSize - outPos, input.length - inPos);
      output.set(input.subarray(inPos, inPos + copyLen), outPos);
      inPos += copyLen;
      outPos += copyLen;
    } else if (btype === 1 || btype === 2) {
      const { litLenTree, distTree } = btype === 1 ? getFixedTrees() : readDynamicTrees(readBits);
      while (outPos < expectedSize) {
        const symbol = decodeSymbol(readBits, litLenTree);
        if (symbol < 256) {
          output[outPos++] = symbol;
        } else if (symbol === 256) {
          break;
        } else if (symbol <= 285) {
          const len = decodeLength(symbol, readBits);
          const distCode = decodeSymbol(readBits, distTree);
          const dist = decodeDistance(distCode, readBits);
          let from = outPos - dist;
          for (let k = 0; k < len && outPos < expectedSize; k++) {
            output[outPos++] = output[from++];
          }
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  return output;
}

interface HuffmanTree {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function buildTree(lengths: Uint8Array | number[]): HuffmanTree {
  const maxLen = 15;
  const blCount = new Uint16Array(maxLen + 1);
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i];
    if (l > 0) blCount[l]++;
  }
  const nextCode = new Uint16Array(maxLen + 1);
  let code = 0;
  for (let bits = 1; bits <= maxLen; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }
  const symbols = new Uint16Array(1 << maxLen);
  const counts = new Uint16Array(1 << maxLen);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (len > 0) {
      const c = nextCode[len]++;
      let rev = 0;
      for (let b = 0; b < len; b++) rev = (rev << 1) | ((c >>> b) & 1);
      const step = 1 << len;
      for (let idx = rev; idx < (1 << maxLen); idx += step) {
        symbols[idx] = i;
        counts[idx] = len;
      }
    }
  }
  return { counts, symbols };
}

function decodeSymbol(readBits: (n: number) => number, tree: HuffmanTree): number {
  let code = 0;
  for (let bits = 1; bits <= 15; bits++) {
    code |= (readBits(1) << (bits - 1));
    const len = tree.counts[code];
    if (len === bits) {
      return tree.symbols[code];
    }
  }
  return 256;
}

let fixedLitTree: HuffmanTree | null = null;
let fixedDistTree: HuffmanTree | null = null;
function getFixedTrees(): { litLenTree: HuffmanTree; distTree: HuffmanTree } {
  if (!fixedLitTree || !fixedDistTree) {
    const lengths = new Uint8Array(288);
    lengths.fill(8, 0, 144);
    lengths.fill(9, 144, 256);
    lengths.fill(7, 256, 280);
    lengths.fill(8, 280, 288);
    fixedLitTree = buildTree(lengths);

    const distLengths = new Uint8Array(32);
    distLengths.fill(5, 0, 32);
    fixedDistTree = buildTree(distLengths);
  }
  return { litLenTree: fixedLitTree, distTree: fixedDistTree };
}

const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
function readDynamicTrees(readBits: (n: number) => number) {
  const hlit = readBits(5) + 257;
  const hdist = readBits(5) + 1;
  const hclen = readBits(4) + 4;
  const clLengths = new Uint8Array(19);
  for (let i = 0; i < hclen; i++) clLengths[CL_ORDER[i]] = readBits(3);
  const clTree = buildTree(clLengths);

  const totalLengths = hlit + hdist;
  const lengths = new Uint8Array(totalLengths);
  let idx = 0;
  while (idx < totalLengths) {
    const sym = decodeSymbol(readBits, clTree);
    if (sym < 16) {
      lengths[idx++] = sym;
    } else if (sym === 16) {
      const prev = lengths[idx - 1] || 0;
      const rep = readBits(2) + 3;
      for (let r = 0; r < rep && idx < totalLengths; r++) lengths[idx++] = prev;
    } else if (sym === 17) {
      const rep = readBits(3) + 3;
      for (let r = 0; r < rep && idx < totalLengths; r++) lengths[idx++] = 0;
    } else if (sym === 18) {
      const rep = readBits(7) + 11;
      for (let r = 0; r < rep && idx < totalLengths; r++) lengths[idx++] = 0;
    }
  }

  const litLenTree = buildTree(lengths.subarray(0, hlit));
  const distTree = buildTree(lengths.subarray(hlit, totalLengths));
  return { litLenTree, distTree };
}

const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
function decodeLength(sym: number, readBits: (n: number) => number): number {
  const idx = sym - 257;
  return LEN_BASE[idx] + (LEN_EXTRA[idx] > 0 ? readBits(LEN_EXTRA[idx]) : 0);
}

const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
function decodeDistance(sym: number, readBits: (n: number) => number): number {
  return DIST_BASE[sym] + (DIST_EXTRA[sym] > 0 ? readBits(DIST_EXTRA[sym]) : 0);
}

/* ========================================================================== */
/* Pure TypeScript PNG Decoder                                                */
/* ========================================================================== */

export function decodePngToRgba(pngBytes: Uint8Array): { pixels: Uint8Array; width: number; height: number } | null {
  try {
    if (pngBytes.length < 8 || pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50 || pngBytes[2] !== 0x4e || pngBytes[3] !== 0x47) {
      return null;
    }

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 6;
    const idatChunks: Uint8Array[] = [];

    while (pos < pngBytes.length) {
      const chunkLen = (pngBytes[pos] << 24) | (pngBytes[pos + 1] << 16) | (pngBytes[pos + 2] << 8) | pngBytes[pos + 3];
      pos += 4;
      const type = String.fromCharCode(pngBytes[pos], pngBytes[pos + 1], pngBytes[pos + 2], pngBytes[pos + 3]);
      pos += 4;

      if (type === 'IHDR') {
        width = (pngBytes[pos] << 24) | (pngBytes[pos + 1] << 16) | (pngBytes[pos + 2] << 8) | pngBytes[pos + 3];
        height = (pngBytes[pos + 4] << 24) | (pngBytes[pos + 5] << 16) | (pngBytes[pos + 6] << 8) | pngBytes[pos + 7];
        bitDepth = pngBytes[pos + 8];
        colorType = pngBytes[pos + 9];
      } else if (type === 'IDAT') {
        idatChunks.push(pngBytes.subarray(pos, pos + chunkLen));
      } else if (type === 'IEND') {
        break;
      }
      pos += chunkLen + 4;
    }

    if (!width || !height || idatChunks.length === 0) return null;

    const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
    const combinedIdat = new Uint8Array(totalIdatLen);
    let idatPos = 0;
    for (const chunk of idatChunks) {
      combinedIdat.set(chunk, idatPos);
      idatPos += chunk.length;
    }

    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
    const scanlineLen = 1 + width * bpp;
    const expectedRawSize = height * scanlineLen;

    const rawInflated = inflateRaw(combinedIdat, expectedRawSize);
    const pixels = new Uint8Array(width * height * 4);

    const prevRow = new Uint8Array(width * bpp);
    const currRow = new Uint8Array(width * bpp);

    for (let y = 0; y < height; y++) {
      const rawOffset = y * scanlineLen;
      const filter = rawInflated[rawOffset];

      for (let x = 0; x < width * bpp; x++) {
        const rawByte = rawInflated[rawOffset + 1 + x];
        const a = x >= bpp ? currRow[x - bpp] : 0;
        const b = prevRow[x];
        const c = x >= bpp ? prevRow[x - bpp] : 0;

        let recon = 0;
        if (filter === 0) recon = rawByte;
        else if (filter === 1) recon = rawByte + a;
        else if (filter === 2) recon = rawByte + b;
        else if (filter === 3) recon = rawByte + Math.floor((a + b) / 2);
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          recon = rawByte + pr;
        }
        currRow[x] = recon & 0xff;
      }

      const outRowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
        const outIdx = outRowOffset + x * 4;
        if (bpp === 4) {
          pixels[outIdx] = currRow[x * 4];
          pixels[outIdx + 1] = currRow[x * 4 + 1];
          pixels[outIdx + 2] = currRow[x * 4 + 2];
          pixels[outIdx + 3] = currRow[x * 4 + 3];
        } else if (bpp === 3) {
          pixels[outIdx] = currRow[x * 3];
          pixels[outIdx + 1] = currRow[x * 3 + 1];
          pixels[outIdx + 2] = currRow[x * 3 + 2];
          pixels[outIdx + 3] = 255;
        } else if (bpp === 1) {
          const g = currRow[x];
          pixels[outIdx] = g;
          pixels[outIdx + 1] = g;
          pixels[outIdx + 2] = g;
          pixels[outIdx + 3] = 255;
        }
      }

      prevRow.set(currRow);
    }

    return { pixels, width, height };
  } catch (e) {
    console.warn('PNG decode error:', e);
    return null;
  }
}

/* ========================================================================== */
/* Intelligent Background Removal & Color Inversion Engine                    */
/* ========================================================================== */

export type LogoProcessMode = 'transparent' | 'white_clean' | 'keep_bg';

export interface BackgroundRemovalOptions {
  mode?: 'transparent' | 'white_clean'; // transparent PNG vs pure white #FFFFFF background
  tolerance?: number; // Color distance tolerance (default: 45)
  softness?: number; // Edge feathering (default: 16)
  trimPadding?: boolean; // Auto crop (default: true)
  invert?: boolean; // Invert colors (Black <-> White)
}

export interface LogoThermalAnalysis {
  recommendedMode: LogoProcessMode;
  recommendedInvert: boolean;
  backgroundIsWhite: boolean;
  backgroundIsDark: boolean;
  foregroundIsLight: boolean;
  hasUniformBackground: boolean;
  hint: string;
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorDist(r: number, g: number, b: number, bgR: number, bgG: number, bgB: number): number {
  const dr = r - bgR;
  const dg = g - bgG;
  const db = b - bgB;
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

function sampleBorderBackground(pixels: Uint8Array, width: number, height: number) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let count = 0;

  const sample = (idx: number) => {
    if (idx > pixels.length - 4) return;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const y = luma(r, g, b);
    rSum += r;
    gSum += g;
    bSum += b;
    lumaSum += y;
    lumaSqSum += y * y;
    count++;
  };

  const xStep = Math.max(1, Math.floor(width / 16));
  const yStep = Math.max(1, Math.floor(height / 16));
  for (let x = 0; x < width; x += xStep) {
    sample(x * 4);
    sample(((height - 1) * width + x) * 4);
  }
  for (let y = 1; y < height - 1; y += yStep) {
    sample((y * width) * 4);
    sample((y * width + (width - 1)) * 4);
  }

  const bgR = count > 0 ? Math.round(rSum / count) : 255;
  const bgG = count > 0 ? Math.round(gSum / count) : 255;
  const bgB = count > 0 ? Math.round(bSum / count) : 255;
  const meanLuma = count > 0 ? lumaSum / count : 255;
  const variance = count > 0 ? Math.max(0, lumaSqSum / count - meanLuma * meanLuma) : 0;

  return {
    bgR,
    bgG,
    bgB,
    bgLuma: meanLuma,
    hasUniformBackground: variance < 350,
  };
}

/** Composite RGBA onto opaque white. Thermal printers treat transparent pixels as black. */
export function flattenPixelsOntoWhite(pixels: Uint8Array): Uint8Array {
  const out = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3] / 255;
    const inv = 1 - a;
    out[i] = Math.round(pixels[i] * a + 255 * inv);
    out[i + 1] = Math.round(pixels[i + 1] * a + 255 * inv);
    out[i + 2] = Math.round(pixels[i + 2] * a + 255 * inv);
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Pick the thermal-safe logo treatment so the merchant does not have to trial-and-error.
 *
 * White-background logos must NOT be "removed" to true transparency: ESC/POS RGB_565
 * (and JPEG flattening of premultiplied alpha) turns those holes into a solid black block.
 */
export function analyzePixelsForThermal(
  pixels: Uint8Array,
  width: number,
  height: number
): LogoThermalAnalysis {
  const { bgR, bgG, bgB, bgLuma, hasUniformBackground } = sampleBorderBackground(pixels, width, height);
  const bgIsWhite = hasUniformBackground && bgLuma >= 232;
  const bgIsDark = hasUniformBackground && bgLuma <= 60;

  let fgLumaSum = 0;
  let fgCount = 0;
  let bgMatchCount = 0;
  const tolerance = 45;
  const total = width * height;

  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (pixels[idx + 3] < 10) {
      bgMatchCount++;
      continue;
    }
    if (colorDist(pixels[idx], pixels[idx + 1], pixels[idx + 2], bgR, bgG, bgB) <= tolerance) {
      bgMatchCount++;
    } else {
      fgLumaSum += luma(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      fgCount++;
    }
  }

  const fgMeanLuma = fgCount > 0 ? fgLumaSum / fgCount : 128;
  const foregroundIsLight = fgMeanLuma >= 175;
  const bgCoverage = total > 0 ? bgMatchCount / total : 0;

  if (!hasUniformBackground || bgCoverage < 0.08) {
    return {
      recommendedMode: 'keep_bg',
      recommendedInvert: false,
      backgroundIsWhite: bgIsWhite,
      backgroundIsDark: bgIsDark,
      foregroundIsLight,
      hasUniformBackground,
      hint: 'No clear backdrop detected. Keeping the original image is safest for thermal printing.',
    };
  }

  if (bgIsWhite) {
    return {
      recommendedMode: fgCount > 0 && foregroundIsLight && fgMeanLuma >= 210 ? 'keep_bg' : 'white_clean',
      recommendedInvert: false,
      backgroundIsWhite: true,
      backgroundIsDark: false,
      foregroundIsLight,
      hasUniformBackground,
      hint: 'This logo already has a white background. Clean White is safest — Remove Background can print as a solid black block on a thermal printer.',
    };
  }

  if (bgIsDark && foregroundIsLight) {
    return {
      recommendedMode: 'transparent',
      recommendedInvert: true,
      backgroundIsWhite: false,
      backgroundIsDark: true,
      foregroundIsLight: true,
      hasUniformBackground,
      hint: 'Light logo on a dark background. We will cut the backdrop and invert it so it prints in black.',
    };
  }

  return {
    recommendedMode: 'transparent',
    recommendedInvert: foregroundIsLight,
    backgroundIsWhite: false,
    backgroundIsDark: bgIsDark,
    foregroundIsLight,
    hasUniformBackground,
    hint: 'Colored background detected. Remove Background will cut it out so the logo prints crisp on white paper.',
  };
}

export function processPixelsRemoveBackground(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions = {}
): { pixels: Uint8Array; width: number; height: number } {
  const tolerance = options.tolerance ?? 45;
  const softness = options.softness ?? 16;
  const isWhiteClean = options.mode === 'white_clean';
  const invert = Boolean(options.invert);
  const original = new Uint8Array(pixels);

  // 1. Sample perimeter to detect background color
  const { bgR, bgG, bgB } = sampleBorderBackground(pixels, width, height);
  const getColorDist = (r: number, g: number, b: number) => colorDist(r, g, b, bgR, bgG, bgB);

  // 2. Queue-based Flood Fill starting from all outer boundary pixels
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (visited[p]) continue;
    visited[p] = 1;

    const pxIdx = p * 4;
    const r = pixels[pxIdx];
    const g = pixels[pxIdx + 1];
    const b = pixels[pxIdx + 2];
    const a = pixels[pxIdx + 3];

    if (a < 10) {
      pixels[pxIdx] = 255;
      pixels[pxIdx + 1] = 255;
      pixels[pxIdx + 2] = 255;
      pixels[pxIdx + 3] = isWhiteClean ? 255 : 0;
      continue;
    }

    const dist = getColorDist(r, g, b);

    if (dist <= tolerance) {
      // Background pixel
      pixels[pxIdx] = 255;
      pixels[pxIdx + 1] = 255;
      pixels[pxIdx + 2] = 255;
      pixels[pxIdx + 3] = isWhiteClean ? 255 : 0;

      const x = p % width;
      const y = Math.floor(p / width);

      if (x > 0 && !visited[p - 1]) queue.push(p - 1);
      if (x < width - 1 && !visited[p + 1]) queue.push(p + 1);
      if (y > 0 && !visited[p - width]) queue.push(p - width);
      if (y < height - 1 && !visited[p + width]) queue.push(p + width);
    } else if (dist <= tolerance + softness && !isWhiteClean) {
      // Soft transition
      const alphaRatio = (dist - tolerance) / softness;
      pixels[pxIdx + 3] = Math.round(Math.min(a, 255 * alphaRatio));
    }
  }

  // If flood-fill ate the artwork (common with light logos on white), revert.
  let originalFg = 0;
  let remainingFg = 0;
  const totalPx = width * height;
  for (let p = 0; p < totalPx; p++) {
    const idx = p * 4;
    const origIsFg =
      original[idx + 3] >= 10 &&
      getColorDist(original[idx], original[idx + 1], original[idx + 2]) > tolerance;
    if (origIsFg) originalFg++;

    const outA = pixels[idx + 3];
    const outR = pixels[idx];
    const outG = pixels[idx + 1];
    const outB = pixels[idx + 2];
    const isBgNow = outA < 20 || (outR > 245 && outG > 245 && outB > 245);
    if (!isBgNow) remainingFg++;
  }
  if (originalFg > 80 && remainingFg < Math.max(40, originalFg * 0.12)) {
    pixels.set(original);
    return { pixels, width, height };
  }

  // 3. If Invert Colors is requested (swap dark <-> bright foreground)
  if (invert) {
    for (let p = 0; p < width * height; p++) {
      const idx = p * 4;
      const a = pixels[idx + 3];
      // Only invert non-background elements
      if (a > 20) {
        pixels[idx] = 255 - pixels[idx];
        pixels[idx + 1] = 255 - pixels[idx + 1];
        pixels[idx + 2] = 255 - pixels[idx + 2];
      }
    }
  }

  // 4. Auto-crop to content bounding box
  if (options.trimPadding) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        const a = pixels[pIdx + 3];
        const r = pixels[pIdx];
        const g = pixels[pIdx + 1];
        const b = pixels[pIdx + 2];

        // Content is either non-transparent or non-white
        const isBg = (a < 20) || (r > 245 && g > 245 && b > 245);
        if (!isBg) {
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hasContent && minX <= maxX && minY <= maxY) {
      const pad = 10;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
      const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

      const cropped = new Uint8Array(cropW * cropH * 4);
      for (let cy = 0; cy < cropH; cy++) {
        const srcRow = (cropY + cy) * width * 4 + cropX * 4;
        const dstRow = cy * cropW * 4;
        cropped.set(pixels.subarray(srcRow, srcRow + cropW * 4), dstRow);
      }

      return { pixels: cropped, width: cropW, height: cropH };
    }
  }

  return { pixels, width, height };
}

/* ========================================================================== */
/* High-Level load / analyze / flatten / remove APIs                          */
/* ========================================================================== */

function loadImageRgbaWeb(
  imageUri: string
): Promise<{ pixels: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        resolve({ pixels: new Uint8Array(imgData.data), width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUri;
  });
}

export async function loadImageRgba(
  imageUri: string
): Promise<{ pixels: Uint8Array; width: number; height: number } | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return loadImageRgbaWeb(imageUri);
  }

  let pngBase64 = '';
  if (ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
    try {
      const manip = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 512 } }],
        { format: 'png', base64: true }
      );
      pngBase64 = manip.base64 || '';
    } catch (err) {
      console.warn('ImageManipulator resize error:', err);
    }
  }

  if (!pngBase64) {
    pngBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const pngBytes = base64ToUint8Array(pngBase64);
  const decoded = decodePngToRgba(pngBytes);
  if (!decoded || !decoded.pixels || decoded.pixels.length === 0) {
    return null;
  }
  return decoded;
}

async function writeRgbaPng(
  pixels: Uint8Array,
  width: number,
  height: number
): Promise<{ uri: string; base64: string }> {
  const encodedPng = encodeRgbaToPng(pixels, width, height);
  const finalBase64 = uint8ArrayToBase64(encodedPng);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return { uri: `data:image/png;base64,${finalBase64}`, base64: finalBase64 };
  }

  const outPath = `${FileSystem.cacheDirectory || ''}logo_clean_${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(outPath, finalBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: outPath, base64: finalBase64 };
}

export async function analyzeLogoForThermal(imageUri: string): Promise<LogoThermalAnalysis | null> {
  try {
    const decoded = await loadImageRgba(imageUri);
    if (!decoded) return null;
    return analyzePixelsForThermal(decoded.pixels, decoded.width, decoded.height);
  } catch (e) {
    console.warn('analyzeLogoForThermal error:', e);
    return null;
  }
}

/** Flatten any remaining alpha onto white and return an opaque PNG. */
export async function flattenImageOntoWhite(
  imageUri: string
): Promise<{ uri: string; base64?: string }> {
  try {
    const decoded = await loadImageRgba(imageUri);
    if (!decoded) return { uri: imageUri };
    const flat = flattenPixelsOntoWhite(decoded.pixels);
    return await writeRgbaPng(flat, decoded.width, decoded.height);
  } catch (e) {
    console.warn('flattenImageOntoWhite error:', e);
    return { uri: imageUri };
  }
}

export async function removeImageBackground(
  imageUri: string,
  options: BackgroundRemovalOptions = {}
): Promise<{ uri: string; base64?: string }> {
  try {
    const decoded = await loadImageRgba(imageUri);
    if (!decoded) return { uri: imageUri };

    const processed = processPixelsRemoveBackground(
      decoded.pixels,
      decoded.width,
      decoded.height,
      options
    );
    // Always composite onto white. Transparent holes become black on ESC/POS thermal printers.
    const flat = flattenPixelsOntoWhite(processed.pixels);
    return await writeRgbaPng(flat, processed.width, processed.height);
  } catch (error) {
    console.error('removeImageBackground error:', error);
    return { uri: imageUri };
  }
}
