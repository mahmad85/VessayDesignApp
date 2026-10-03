import { DomainError } from '@/modules/configuration/types';
import { IMAGE_UPLOAD_MAX } from './admin-names';
export const UPLOAD_MAX = IMAGE_UPLOAD_MAX;
const invalid = (message: string): never => {
  throw new DomainError('upload_invalid', message, 415);
};
export function imageInfo(bytes: Uint8Array, name: string, declaredType: string) {
  if (bytes.length > UPLOAD_MAX)
    throw new DomainError('upload_too_large', 'Choose an image smaller than 5 MiB.', 413);
  const b = Buffer.from(bytes);
  let width = 0,
    height = 0,
    type = '',
    ext = '';
  if (
    b.length >= 33 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.toString('ascii', 12, 16) === 'IHDR' &&
    b.readUInt32BE(8) === 13 &&
    b.length >= 45 &&
    b.toString('ascii', b.length - 8, b.length - 4) === 'IEND'
  ) {
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
    type = 'image/png';
    ext = 'png';
  } else if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  ) {
    type = 'image/webp';
    if (b.readUInt32LE(4) !== b.length - 8) invalid('The WebP image is truncated or malformed.');
    ext = 'webp';
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && b.length >= 30) {
      width = 1 + b.readUIntLE(24, 3);
      height = 1 + b.readUIntLE(27, 3);
    } else if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
      width = 1 + ((b[21] | (b[22] << 8)) & 0x3fff);
      height = 1 + (((b[22] >> 6) | (b[23] << 2) | (b[24] << 10)) & 0x3fff);
    } else if (
      chunk === 'VP8 ' &&
      b.length >= 30 &&
      b.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a]))
    ) {
      width = b.readUInt16LE(26) & 0x3fff;
      height = b.readUInt16LE(28) & 0x3fff;
    }
  } else if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    type = 'image/jpeg';
    if (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9)
      invalid('The JPEG image is truncated or malformed.');
    ext = 'jpg';
    let at = 2;
    while (at + 4 <= b.length) {
      if (b[at++] !== 0xff) break;
      while (b[at] === 0xff) at++;
      const marker = b[at++];
      if (at + 2 > b.length) break;
      if (marker === 0xda || marker === 0xd9) break;
      const length = b.readUInt16BE(at);
      if (length < 2 || at + length > b.length) break;
      if ((marker === 0xc0 || marker === 0xc2) && length >= 8) {
        height = b.readUInt16BE(at + 3);
        width = b.readUInt16BE(at + 5);
        break;
      }
      at += length;
    }
  }
  if (!type || !width || !height)
    invalid('Choose a valid PNG, JPEG or WebP image. SVG is not accepted.');
  const extension = name.split('.').at(-1)?.toLowerCase();
  if (
    (type === 'image/jpeg' ? !['jpg', 'jpeg'].includes(extension || '') : extension !== ext) ||
    declaredType !== type
  )
    invalid('The file extension and content type must match the image content.');
  if (width < 64 || height < 64 || width > 8000 || height > 8000)
    invalid('Image dimensions must be between 64 and 8000 pixels.');
  return { width, height, contentType: type, ext };
}
export async function uploadForm(request: Request): Promise<FormData> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > UPLOAD_MAX)
    throw new DomainError('upload_too_large', 'The upload exceeds 5 MiB.', 413);
  const reader = request.body?.getReader();
  if (!reader) return invalid('An image file is required.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > UPLOAD_MAX) {
      await reader.cancel();
      throw new DomainError('upload_too_large', 'The upload exceeds 5 MiB.', 413);
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type') || '' },
    }).formData();
  } catch {
    return invalid('The upload must use multipart form data.');
  }
}
