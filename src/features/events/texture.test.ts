import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { decodeBlp, decodeDxt5, encodePng, squareToContent } from './texture.js';

// One DXT5 block: alpha 255 to 0, colors pure red (0xF800) and pure blue (0x001F)
function block(alphaIndex: number, colorIndex: number): Uint8Array {
	const b = new Uint8Array(16);
	b[0] = 255;
	b[1] = 0;
	// Every pixel the same 3-bit alpha index
	let bits = 0n;
	for (let i = 0; i < 16; i++) {
		bits |= BigInt(alphaIndex) << BigInt(3 * i);
	}
	for (let i = 0; i < 6; i++) {
		b[2 + i] = Number((bits >> BigInt(8 * i)) & 0xFFn);
	}
	b.set([0x00, 0xF8, 0x1F, 0x00], 8);
	let colorBits = 0;
	for (let i = 0; i < 16; i++) {
		colorBits |= colorIndex << (2 * i);
	}
	new DataView(b.buffer).setUint32(12, colorBits >>> 0, true);
	return b;
}

describe('decodeDxt5', () => {
	it('should read the end colors and alphas and blend between them', () => {
		assert.deepEqual([...decodeDxt5(block(0, 0), 4, 4).subarray(0, 4)], [255, 0, 0, 255]);
		assert.deepEqual([...decodeDxt5(block(1, 1), 4, 4).subarray(0, 4)], [0, 0, 255, 0]);
		// Two thirds red, a seventh of the way to transparent
		assert.deepEqual([...decodeDxt5(block(2, 2), 4, 4).subarray(0, 4)], [170, 0, 85, 219]);
	});
});

describe('decodeBlp', () => {
	it('should read a DXT5 BLP2 from its first mip, and turn down other kinds', () => {
		const file = new Uint8Array(148 + 1024 + 16);
		file.set([...'BLP2'].map(c => c.charCodeAt(0)));
		const view = new DataView(file.buffer);
		view.setUint32(4, 1, true);
		file[8] = 2;
		file[10] = 7;
		view.setUint32(12, 4, true);
		view.setUint32(16, 4, true);
		view.setUint32(20, 1172, true);
		file.set(block(0, 1), 1172);
		const image = decodeBlp(file);
		assert.deepEqual([image.width, image.height, ...image.data.subarray(0, 4)], [4, 4, 0, 0, 255, 255]);
		file[8] = 3;
		assert.throws(() => decodeBlp(file), /Unsupported BLP encoding 3\/7/);
		assert.throws(() => decodeBlp(new Uint8Array(200)), /Not a BLP2/);
	});
});

describe('squareToContent', () => {
	it('should cut to the visible pixels and centre them in a square, ignoring faint shadow', () => {
		// 4x4, a 2x1 opaque bar at (1,1), a faint pixel in the corner
		const data = new Uint8Array(64);
		data[(1 * 4 + 1) * 4 + 3] = 255;
		data[(1 * 4 + 2) * 4 + 3] = 255;
		data[3] = 20;
		const square = squareToContent({ width: 4, height: 4, data });
		assert.equal(square.width, 2);
		assert.equal(square.height, 2);
		assert.deepEqual([...square.data].filter((_, i) => i % 4 === 3), [255, 255, 0, 0]);
	});

	it('should keep the pixels around it as a margin, and pad past the edge with transparency', () => {
		const data = new Uint8Array(64);
		data[(1 * 4 + 1) * 4 + 3] = 255;
		data[(1 * 4 + 2) * 4 + 3] = 255;
		data[3] = 20;
		const square = squareToContent({ width: 4, height: 4, data }, 1);
		assert.equal(square.width, 4);
		// The faint corner pixel is kept as part of the margin
		assert.deepEqual([...square.data].filter((_, i) => i % 4 === 3), [20, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		assert.equal(squareToContent({ width: 4, height: 4, data }, 3).width, 8);
	});
});

describe('encodePng', () => {
	it('should write a PNG whose pixel rows read back', () => {
		const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		const png = encodePng({ width: 2, height: 1, data });
		assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
		assert.equal(png.toString('ascii', 12, 16), 'IHDR');
		assert.equal(png.readUInt32BE(16), 2);
		const idatLength = png.readUInt32BE(33);
		assert.equal(png.toString('ascii', 37, 41), 'IDAT');
		assert.deepEqual([...inflateSync(png.subarray(41, 41 + idatLength))], [0, ...data]);
	});
});
