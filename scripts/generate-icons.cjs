const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size, isMaskable = false) {
  const width = size;
  const height = size;

  // Raw image data with 1 byte filter per row
  // RGBA format
  const rawBytes = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.42 : 0.46);

  // Background colors:
  // KinD POS brand: vibrant amber (#f59e0b) to deep amber (#d97706)
  for (let y = 0; y < height; y++) {
    rawBytes[offset++] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background:
      let r = 245;
      let g = 158;
      let b = 11;
      let a = 255;

      // Slight vertical gradient
      const grad = y / height;
      r = Math.round(245 - 20 * grad);
      g = Math.round(158 - 30 * grad);
      b = Math.round(11 + 5 * grad);

      if (!isMaskable) {
        // Rounded squircle background for standard icons
        const cornerDist = Math.max(Math.abs(dx), Math.abs(dy));
        const squircle = Math.pow(Math.abs(dx) / (width * 0.44), 4) + Math.pow(Math.abs(dy) / (height * 0.44), 4);
        if (squircle > 1.05) {
          a = 0; // transparent outside rounded rectangle
        } else if (squircle > 0.95) {
          a = Math.round(255 * (1 - (squircle - 0.95) / 0.1));
        }
      }

      if (a > 0) {
        // Draw Fork, Spoon & Plate / Bowl motif in center with dark slate (#0f172a)
        const scale = size / 512;
        const normDx = dx / scale;
        const normDy = dy / scale;

        // Outer white ring on plate
        const plateDist = Math.sqrt(normDx * normDx + (normDy - 15) * (normDy - 15));
        if (plateDist > 140 && plateDist < 165) {
          // Soft ring highlight
          r = 255; g = 255; b = 255;
        } else if (plateDist <= 140) {
          // Plate inner: Dark slate bowl (#0f172a)
          r = 15; g = 23; b = 42;

          // Fork & Spoon motif inside plate (amber gold #fbbf24)
          // Spoon on left (normDx between -85 and -25)
          const spoonHeadDist = Math.sqrt((normDx + 50) * (normDx + 50) + (normDy + 25) * (normDy + 25));
          const spoonHandle = normDx > -56 && normDx < -44 && normDy >= 0 && normDy < 100;
          if (spoonHeadDist < 30 || spoonHandle) {
            r = 251; g = 191; b = 36;
          }

          // Fork on right (normDx between 25 and 85)
          const forkHandle = normDx > 44 && normDx < 56 && normDy >= 0 && normDy < 100;
          const forkBase = normDx > 35 && normDx < 65 && normDy >= -5 && normDy < 25;
          const tine1 = normDx > 34 && normDx < 40 && normDy >= -45 && normDy < 0;
          const tine2 = normDx > 47 && normDx < 53 && normDy >= -45 && normDy < 0;
          const tine3 = normDx > 60 && normDx < 66 && normDy >= -45 && normDy < 0;
          if (forkHandle || forkBase || tine1 || tine2 || tine3) {
            r = 251; g = 191; b = 36;
          }

          // Steam waves above plate
          const wave1 = Math.abs(normDy + 90 - Math.sin(normDx * 0.1) * 8) < 4 && Math.abs(normDx) < 60;
          if (wave1) {
            r = 251; g = 191; b = 36;
          }
        }
      }

      rawBytes[offset++] = r;
      rawBytes[offset++] = g;
      rawBytes[offset++] = b;
      rawBytes[offset++] = a;
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // non-interlaced
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(rawBytes, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), generatePng(512, true));

// Also generate SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="128" fill="#f59e0b"/>
  <circle cx="256" cy="270" r="150" fill="#0f172a" stroke="#ffffff" stroke-width="12"/>
  <path d="M206 240 a 30 30 0 1 0 0 -60 a 30 30 0 0 0 0 60 z M200 240 v 100 h 12 v -100 z" fill="#fbbf24"/>
  <path d="M290 240 v -40 h -6 v -30 h 6 v 30 h 6 v -30 h 6 v 30 h 6 v -30 h 6 v 30 h -6 v 40 z M305 240 v 100 h 12 v -100 z" fill="#fbbf24"/>
  <path d="M220 180 q 36 -25 72 0" stroke="#fbbf24" stroke-width="8" stroke-linecap="round" fill="none"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);

console.log('Successfully generated PWA icons in public/icons/');
