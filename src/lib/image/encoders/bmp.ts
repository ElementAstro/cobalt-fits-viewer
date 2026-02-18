export function encodeBmp24(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const bytesPerPixel = 3;
  const rowSizeWithoutPadding = width * bytesPerPixel;
  const rowPadding = (4 - (rowSizeWithoutPadding % 4)) % 4;
  const rowSize = rowSizeWithoutPadding + rowPadding;
  const pixelDataSize = rowSize * height;
  const fileSize = 14 + 40 + pixelDataSize;

  const output = new Uint8Array(fileSize);
  const view = new DataView(output.buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint8(0, 0x42); // B
  view.setUint8(1, 0x4d); // M
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, 54, true); // Pixel data offset

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true); // Header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // Bottom-up
  view.setUint16(26, 1, true); // Planes
  view.setUint16(28, 24, true); // BitsPerPixel
  view.setUint32(30, 0, true); // Compression: BI_RGB
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true); // ~72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true); // colors used
  view.setUint32(50, 0, true); // important colors

  let outOffset = 54;
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const src = rowStart + x * 4;
      output[outOffset++] = rgba[src + 2]; // B
      output[outOffset++] = rgba[src + 1]; // G
      output[outOffset++] = rgba[src]; // R
    }
    for (let p = 0; p < rowPadding; p++) {
      output[outOffset++] = 0;
    }
  }

  return output;
}
