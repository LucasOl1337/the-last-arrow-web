import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

// Only replace the embedded image; preserve every compressed mesh byte, accessor and rig.
// Originals remain in git. Re-running on already-small images is a no-op.
const report = [];
const align = n => Math.ceil(n / 4) * 4;
const hash = b => createHash('sha256').update(b).digest('hex');
for (const name of ['mizu', 'storm', 'kaze', 'akane']) {
  const path = `public/assets/models/${name}.glb`, before = await readFile(path);
  assert.equal(before.readUInt32LE(0), 0x46546c67);
  const jsonLength = before.readUInt32LE(12), doc = JSON.parse(before.subarray(20, 20 + jsonLength).toString());
  assert.equal(doc.images.length, 1);
  const bin = before.subarray(28 + jsonLength), image = doc.images[0], view = doc.bufferViews[image.bufferView];
  assert.equal(view.buffer, 0); assert.equal(view.byteOffset, 0);
  const source = bin.subarray(0, view.byteLength), metadata = await sharp(source).metadata();
  if (metadata.width <= 2048 && metadata.height <= 2048) continue;
  // Preserve the source's JPEG format; 4:4:4 at quality 92 retains thin cloth/face details.
  const resized = await sharp(source).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
  const oldEnd = align(view.byteLength), newEnd = align(resized.length), delta = newEnd - oldEnd;
  const tail = bin.subarray(oldEnd), nextBin = Buffer.concat([resized, Buffer.alloc(newEnd - resized.length), tail]);
  for (const v of doc.bufferViews) {
    if (v !== view && v.buffer === 0) { assert.ok(v.byteOffset >= oldEnd); v.byteOffset += delta; }
    const e = v.extensions?.EXT_meshopt_compression;
    if (e?.buffer === 0) { assert.ok(e.byteOffset >= oldEnd); e.byteOffset += delta; }
  }
  view.byteLength = resized.length; image.mimeType = 'image/jpeg'; doc.buffers[0].byteLength = nextBin.length;
  const json = Buffer.from(JSON.stringify(doc)), paddedJson = Buffer.concat([json, Buffer.alloc(align(json.length) - json.length, 32)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJson.length + nextBin.length, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(nextBin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const after = Buffer.concat([header, paddedJson, binHeader, nextBin]);
  assert.equal(hash(tail), hash(nextBin.subarray(newEnd)));
  await writeFile(path, after);
  report.push({ name, before: { bytes: before.length, width: metadata.width, height: metadata.height }, after: { bytes: after.length, width: 2048, height: 2048 }, geometryAndRigHash: hash(tail), meshBytesUnchanged: true,
    rgbaMipBytesBefore: metadata.width * metadata.height * 4 * 4 / 3, rgbaMipBytesAfter: 2048 * 2048 * 4 * 4 / 3 });
}
await mkdir('evidence/rodada-6', { recursive: true });
if (report.length) await writeFile('evidence/rodada-6/textures-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
