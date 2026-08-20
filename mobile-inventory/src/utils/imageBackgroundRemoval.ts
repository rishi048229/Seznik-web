import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  ImageManipulator = null;
}

/* ========================================================================== */
/* CRC-32 & Adler-32 checksums for standard PNG encoding                      */
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
  // Raw scanline format: 1 filter byte (0 = None) + 4 bytes per pixel (RGBA)
  const bytesPerScanline = 1 + width * 4;
  const rawData = new Uint8Array(height * bytesPerScanline);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * bytesPerScanline;
    rawData[rawOffset] = 0; // Filter: None
    const pixelRowOffset = y * width * 4;
    rawData.set(pixels.subarray(pixelRowOffset, pixelRowOffset + width * 4), rawOffset + 1);
  }

  // Zlib stream with uncompressed DEFLATE blocks (RFC 1951 BTYPE=00)
  const MAX_BLOCK_LEN = 32768;
  const numBlocks = Math.ceil(rawData.length / MAX_BLOCK_LEN) || 1;
  const zlibLen = 2 + numBlocks * 5 + rawData.length + 4;
  const zlibData = new Uint8Array(zlibLen);

  // Zlib header (CMF: deflate 32k window, FLG: check bits)
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;
  let zPos = 2;

  for (let i = 0; i < rawData.length; i += MAX_BLOCK_LEN) {
    const isLast = (i + MAX_BLOCK_LEN >= rawData.length);
    const blockLen = Math.min(MAX_BLOCK_LEN, rawData.length - i);
    const nBlockLen = (~blockLen) & 0xffff;

    zlibData[zPos++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE(00)
    zlibData[zPos++] = blockLen & 0xff;
    zlibData[zPos++] = (blockLen >> 8) & 0xff;
    zlibData[zPos++] = nBlockLen & 0xff;
    zlibData[zPos++] = (nBlockLen >> 8) & 0xff;

    zlibData.set(rawData.subarray(i, i + blockLen), zPos);
    zPos += blockLen;
  }

  // Adler-32
  const adler = adler32(rawData);
  zlibData[zPos++] = (adler >> 24) & 0xff;
  zlibData[zPos++] = (adler >> 16) & 0xff;
  zlibData[zPos++] = (adler >> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  // Build PNG chunks (Signature + IHDR + IDAT + IEND)
  const totalPngLen = 8 + (12 + 13) + (12 + zlibLen) + (12 + 0);
  const png = new Uint8Array(totalPngLen);
  let pos = 0;

  // Signature
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pos);
  pos += 8;

  // IHDR Chunk
  const ihdrLen = 13;
  writeUint32(png, pos, ihdrLen); pos += 4;
  const ihdrStart = pos;
  writeString(png, pos, 'IHDR'); pos += 4;
  writeUint32(png, pos, width); pos += 4;
  writeUint32(png, pos, height); pos += 4;
  png[pos++] = 8; // Bit depth: 8
  png[pos++] = 6; // Color type: 6 (RGBA)
  png[pos++] = 0; // Compression
  png[pos++] = 0; // Filter
  png[pos++] = 0; // Interlace
  const ihdrCrc = crc32(png, ihdrStart, 17);
  writeUint32(png, pos, ihdrCrc); pos += 4;

  // IDAT Chunk
  writeUint32(png, pos, zlibLen); pos += 4;
  const idatStart = pos;
  writeString(png, pos, 'IDAT'); pos += 4;
  png.set(zlibData, pos); pos += zlibLen;
  const idatCrc = crc32(png, idatStart, 4 + zlibLen);
  writeUint32(png, pos, idatCrc); pos += 4;

  // IEND Chunk
  writeUint32(png, pos, 0); pos += 4;
  const iendStart = pos;
  writeString(png, pos, 'IEND'); pos += 4;
  const iendCrc = crc32(png, iendStart, 4);
  writeUint32(png, pos, iendCrc); pos += 4;

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
/* Pure TypeScript Micro-Inflate (RFC 1951 DEFLATE decompressor)              */
/* ========================================================================== */

function inflateRaw(input: Uint8Array, expectedSize: number): Uint8Array {
  // Check if DecompressionStream is available in the runtime
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

  // Skip zlib header if present (78 01 / 78 9c / 78 da)
  if (input[0] === 0x78 && (input[1] === 0x01 || input[1] === 0x9c || input[1] === 0xda)) {
    inPos = 2;
  }

  let isLastBlock = false;
  while (!isLastBlock && inPos <= input.length && outPos < expectedSize) {
    isLastBlock = readBits(1) === 1;
    const btype = readBits(2);

    if (btype === 0) {
      // Uncompressed block
      bitBuf = 0;
      bitLen = 0;
      if (inPos + 4 > input.length) break;
      const len = input[inPos] | (input[inPos + 1] << 8);
      inPos += 4; // Skip LEN and NLEN
      const copyLen = Math.min(len, expectedSize - outPos, input.length - inPos);
      output.set(input.subarray(inPos, inPos + copyLen), outPos);
      inPos += copyLen;
      outPos += copyLen;
    } else if (btype === 1 || btype === 2) {
      // Huffman compressed block (Fixed or Dynamic)
      // Decode with standard DEFLATE length/dist tables
      const { litLenTree, distTree } = btype === 1 ? getFixedTrees() : readDynamicTrees(readBits);
      while (outPos < expectedSize) {
        const symbol = decodeSymbol(readBits, litLenTree);
        if (symbol < 256) {
          output[outPos++] = symbol;
        } else if (symbol === 256) {
          break; // End of block
        } else {
          const len = decodeLength(symbol, readBits);
          const distCode = decodeSymbol(readBits, distTree);
          const dist = decodeDistance(distCode, readBits);
          let from = outPos - dist;
          for (let k = 0; k < len && outPos < expectedSize; k++) {
            output[outPos++] = output[from++];
          }
        }
      }
    } else {
      break;
    }
  }

  return output;
}

// Tree structures for RFC 1951 Huffman
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
      // Reverse bits for lookup
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
  // Read bit by bit up to max 15
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
/* Pure TypeScript PNG Decoder (RGB/RGBA to Raw 32-bit RGBA)                  */
/* ========================================================================== */

export function decodePngToRgba(pngBytes: Uint8Array): { pixels: Uint8Array; width: number; height: number } | null {
  try {
    // Validate signature
    if (pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50 || pngBytes[2] !== 0x4e || pngBytes[3] !== 0x47) {
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
      pos += chunkLen + 4; // Skip data + CRC
    }

    if (!width || !height || idatChunks.length === 0) return null;

    // Concatenate IDAT chunks
    const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
    const combinedIdat = new Uint8Array(totalIdatLen);
    let idatPos = 0;
    for (const chunk of idatChunks) {
      combinedIdat.set(chunk, idatPos);
      idatPos += chunk.length;
    }

    // Bytes per pixel in raw scanline
    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
    const scanlineLen = 1 + width * bpp;
    const expectedRawSize = height * scanlineLen;

    const rawInflated = inflateRaw(combinedIdat, expectedRawSize);
    const pixels = new Uint8Array(width * height * 4);

    // PNG Scanline Filter reconstruction
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

      // Convert scanline bytes to 32-bit RGBA
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
/* Intelligent Background Removal Algorithm                                   */
/* ========================================================================== */

export interface BackgroundRemovalOptions {
  tolerance?: number; // Color distance tolerance (default: 38)
  softness?: number; // Feathering softness on edges (default: 16)
  trimPadding?: boolean; // Auto-crop empty transparent border (default: true)
}

export function processPixelsRemoveBackground(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions = {}
): { pixels: Uint8Array; width: number; height: number } {
  const tolerance = options.tolerance ?? 40;
  const softness = options.softness ?? 18;

  // 1. Sample perimeter / corners to detect background color
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const samplePoints = [
    // 4 corners
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
    // Midpoints
    Math.floor(width / 2) * 4,
    ((height - 1) * width + Math.floor(width / 2)) * 4,
    Math.floor(height / 2) * width * 4,
    (Math.floor(height / 2) * width + (width - 1)) * 4,
  ];

  for (const idx of samplePoints) {
    if (idx < pixels.length - 3) {
      rSum += pixels[idx];
      gSum += pixels[idx + 1];
      bSum += pixels[idx + 2];
      count++;
    }
  }

  const bgR = count > 0 ? Math.round(rSum / count) : 255;
  const bgG = count > 0 ? Math.round(gSum / count) : 255;
  const bgB = count > 0 ? Math.round(bSum / count) : 255;

  // Distance helper
  const getColorDist = (r: number, g: number, b: number) => {
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    // Standard perceptual Euclidean color distance
    return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
  };

  // 2. Queue-based Flood Fill starting from all outer boundary pixels
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Enqueue top & bottom borders
  for (let x = 0; x < width; x++) {
    queue.push(x); // top
    queue.push((height - 1) * width + x); // bottom
  }
  // Enqueue left & right borders
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width); // left
    queue.push(y * width + (width - 1)); // right
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

    // If already transparent, pass through
    if (a < 10) {
      continue;
    }

    const dist = getColorDist(r, g, b);

    if (dist <= tolerance) {
      // Full background transparency
      pixels[pxIdx + 3] = 0;

      // Expand to 4-connected neighbors
      const x = p % width;
      const y = Math.floor(p / width);

      if (x > 0 && !visited[p - 1]) queue.push(p - 1);
      if (x < width - 1 && !visited[p + 1]) queue.push(p + 1);
      if (y > 0 && !visited[p - width]) queue.push(p - width);
      if (y < height - 1 && !visited[p + width]) queue.push(p + width);
    } else if (dist <= tolerance + softness) {
      // Soft antialiased edge falloff
      const alphaRatio = (dist - tolerance) / softness;
      pixels[pxIdx + 3] = Math.round(Math.min(a, 255 * alphaRatio));
    }
  }

  // 3. Optional auto-crop to bounding box of content with 8px margin
  if (options.trimPadding) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = pixels[(y * width + x) * 4 + 3];
        if (a > 15) {
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hasContent && minX <= maxX && minY <= maxY) {
      const pad = 8;
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
/* High-Level Universal removeImageBackground API                             */
/* ========================================================================== */

export async function removeImageBackground(
  imageUri: string,
  options: BackgroundRemovalOptions = {}
): Promise<{ uri: string; base64?: string }> {
  try {
    // 1. Web Implementation: Uses offscreen HTML5 Canvas
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return await removeBackgroundWeb(imageUri, options);
    }

    // 2. Native Implementation (iOS / Android)
    // Step A: Downscale cleanly with expo-image-manipulator to max 512px for crispness & speed
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
        console.warn('ImageManipulator resize failed, reading raw file:', err);
      }
    }

    if (!pngBase64) {
      pngBase64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    // Step B: Decode base64 PNG to raw RGBA
    const binaryString = atob(pngBase64);
    const pngBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pngBytes[i] = binaryString.charCodeAt(i);
    }

    const decoded = decodePngToRgba(pngBytes);
    if (!decoded) {
      // Fallback: return original URI if decode failed
      return { uri: imageUri };
    }

    // Step C: Run intelligent background removal
    const processed = processPixelsRemoveBackground(decoded.pixels, decoded.width, decoded.height, options);

    // Step D: Encode processed RGBA to transparent PNG
    const encodedPng = encodeRgbaToPng(processed.pixels, processed.width, processed.height);

    // Step E: Write output to cache directory
    let outBase64 = '';
    const CHUNK_SIZE = 0x8000;
    for (let i = 0; i < encodedPng.length; i += CHUNK_SIZE) {
      outBase64 += String.fromCharCode.apply(null, encodedPng.subarray(i, i + CHUNK_SIZE) as any);
    }
    const finalBase64 = btoa(outBase64);

    const outPath = `${FileSystem.cacheDirectory || ''}logo_nobg_${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(outPath, finalBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { uri: outPath, base64: finalBase64 };
  } catch (error) {
    console.error('removeImageBackground error:', error);
    // Graceful fallback to original image
    return { uri: imageUri };
  }
}

function removeBackgroundWeb(
  imageUri: string,
  options: BackgroundRemovalOptions = {}
): Promise<{ uri: string; base64?: string }> {
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
          resolve({ uri: imageUri });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const pixels = new Uint8Array(imgData.data.buffer);

        const processed = processPixelsRemoveBackground(pixels, w, h, options);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = processed.width;
        outCanvas.height = processed.height;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve({ uri: imageUri });
          return;
        }

        const outImgData = outCtx.createImageData(processed.width, processed.height);
        outImgData.data.set(processed.pixels);
        outCtx.putImageData(outImgData, 0, 0);

        const dataUrl = outCanvas.toDataURL('image/png');
        resolve({ uri: dataUrl });
      } catch (e) {
        console.warn('Web background removal fallback:', e);
        resolve({ uri: imageUri });
      }
    };
    img.onerror = () => resolve({ uri: imageUri });
    img.src = imageUri;
  });
}
