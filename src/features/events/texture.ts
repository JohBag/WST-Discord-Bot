import { deflateSync } from 'node:zlib';

// WoW's own interface textures (role icons, ready check marks) come as BLP files, which Discord
// can't take. This reads the two kinds those use and writes PNG, so no image package is needed.

export interface Rgba {
	width: number;
	height: number;
	// Four bytes per pixel, red, green, blue, alpha, row by row
	data: Uint8Array;
}

// BLP2 header: magic, type, then encoding, alpha depth, alpha encoding and mips as one byte each,
// width, height, 16 mip offsets and 16 mip sizes. Only the first, full-size mip is read
export function decodeBlp(file: Uint8Array): Rgba {
	const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
	if (String.fromCharCode(...file.subarray(0, 4)) !== 'BLP2') {
		throw new Error('Not a BLP2 file');
	}
	const encoding = file[8];
	const alphaEncoding = file[10];
	const width = view.getUint32(12, true);
	const height = view.getUint32(16, true);
	const offset = view.getUint32(20, true);
	if (encoding === 3) {
		return { width, height, data: fromBgra(file.subarray(offset, offset + width * height * 4)) };
	}
	if (encoding === 2 && alphaEncoding === 7) {
		return { width, height, data: decodeDxt5(file.subarray(offset), width, height) };
	}
	throw new Error(`Unsupported BLP encoding ${encoding}/${alphaEncoding}`);
}

function fromBgra(bgra: Uint8Array): Uint8Array {
	const out = new Uint8Array(bgra.length);
	for (let i = 0; i < bgra.length; i += 4) {
		out[i] = bgra[i + 2];
		out[i + 1] = bgra[i + 1];
		out[i + 2] = bgra[i];
		out[i + 3] = bgra[i + 3];
	}
	return out;
}

function rgb565(value: number): [number, number, number] {
	const r = (value >> 11) & 31;
	const g = (value >> 5) & 63;
	const b = value & 31;
	return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

// DXT5: 16-byte blocks of 4x4 pixels, 8 bytes of interpolated alpha, then 8 of interpolated color
export function decodeDxt5(blocks: Uint8Array, width: number, height: number): Uint8Array {
	const out = new Uint8Array(width * height * 4);
	let at = 0;
	for (let by = 0; by < height; by += 4) {
		for (let bx = 0; bx < width; bx += 4) {
			const a0 = blocks[at];
			const a1 = blocks[at + 1];
			const alphas = [a0, a1];
			if (a0 > a1) {
				for (let i = 1; i < 7; i++) {
					alphas.push(Math.round(((7 - i) * a0 + i * a1) / 7));
				}
			} else {
				for (let i = 1; i < 5; i++) {
					alphas.push(Math.round(((5 - i) * a0 + i * a1) / 5));
				}
				alphas.push(0, 255);
			}
			// 48 bits of 3-bit alpha indices, lowest first
			let alphaBits = 0n;
			for (let i = 0; i < 6; i++) {
				alphaBits |= BigInt(blocks[at + 2 + i]) << BigInt(8 * i);
			}
			const c0 = blocks[at + 8] | (blocks[at + 9] << 8);
			const c1 = blocks[at + 10] | (blocks[at + 11] << 8);
			const [p0, p1] = [rgb565(c0), rgb565(c1)];
			const colors = [p0, p1, p0.map((v, i) => Math.round((2 * v + p1[i]) / 3)), p0.map((v, i) => Math.round((v + 2 * p1[i]) / 3))];
			const colorBits = (blocks[at + 12] | (blocks[at + 13] << 8) | (blocks[at + 14] << 16) | (blocks[at + 15] << 24)) >>> 0;
			for (let py = 0; py < 4; py++) {
				for (let px = 0; px < 4; px++) {
					const x = bx + px;
					const y = by + py;
					if (x >= width || y >= height) {
						continue;
					}
					const n = py * 4 + px;
					const color = colors[(colorBits >>> (2 * n)) & 3];
					const o = (y * width + x) * 4;
					out[o] = color[0];
					out[o + 1] = color[1];
					out[o + 2] = color[2];
					out[o + 3] = alphas[Number((alphaBits >> BigInt(3 * n)) & 7n)];
				}
			}
			at += 16;
		}
	}
	return out;
}

export function crop(image: Rgba, x: number, y: number, width: number, height: number): Rgba {
	if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
		throw new Error(`Cut ${width}x${height} at ${x},${y} is outside the ${image.width}x${image.height} texture`);
	}
	const data = new Uint8Array(width * height * 4);
	for (let row = 0; row < height; row++) {
		const from = ((y + row) * image.width + x) * 4;
		data.set(image.data.subarray(from, from + width * 4), row * width * 4);
	}
	return { width, height, data };
}

// Cut to what's clearly visible (soft shadows don't count) plus a margin, centred in a square, so a
// round or narrow icon is as big as a square one at emoji size. The margin keeps the shadow's fade
// from being cut off hard
export function squareToContent(image: Rgba, margin = 0, minAlpha = 128): Rgba {
	let [left, top, right, bottom] = [image.width, image.height, -1, -1];
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			if (image.data[(y * image.width + x) * 4 + 3] >= minAlpha) {
				left = Math.min(left, x);
				right = Math.max(right, x);
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
			}
		}
	}
	if (right < 0) {
		return image;
	}
	const width = right - left + 1;
	const height = bottom - top + 1;
	const side = Math.max(width, height) + 2 * margin;
	// The square's corner in the image, which can lie outside it: those pixels stay transparent
	const x0 = left - Math.floor((side - width) / 2);
	const y0 = top - Math.floor((side - height) / 2);
	const data = new Uint8Array(side * side * 4);
	for (let y = 0; y < side; y++) {
		for (let x = 0; x < side; x++) {
			const [sx, sy] = [x0 + x, y0 + y];
			if (sx >= 0 && sy >= 0 && sx < image.width && sy < image.height) {
				data.set(image.data.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), (y * side + x) * 4);
			}
		}
	}
	return { width: side, height: side, data };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
	let c = 0xFFFFFFFF;
	for (const byte of bytes) {
		c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8);
	}
	return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type: string, body: Uint8Array): Buffer {
	const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(body.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typed));
	return Buffer.concat([length, typed, crc]);
}

export function encodePng(image: Rgba): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(image.width, 0);
	header.writeUInt32BE(image.height, 4);
	header.set([8, 6, 0, 0, 0], 8); // 8 bits per channel, RGBA, no interlace
	// Each row starts with filter type 0 (none)
	const rows = Buffer.alloc(image.height * (image.width * 4 + 1));
	for (let y = 0; y < image.height; y++) {
		rows.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), y * (image.width * 4 + 1) + 1);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', new Uint8Array(0)),
	]);
}
