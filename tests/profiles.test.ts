import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizePhoto, MAX_PHOTO_BYTES } from "../lib/profiles/service";

test("profile photos are decoded, resized, and stripped of uploaded metadata", async () => {
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "red" } }).png().withMetadata().toBuffer();
  const output = await normalizePhoto(new File([new Uint8Array(png)], "fake-name.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
});

test("profile photos reject corrupt, SVG, and oversized uploads", async () => {
  await assert.rejects(normalizePhoto(new File(["not an image"], "photo.png", { type: "image/png" })), /valid/);
  await assert.rejects(normalizePhoto(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'], "photo.svg")), /valid/);
  await assert.rejects(normalizePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.png")), /2 MB/);
});
