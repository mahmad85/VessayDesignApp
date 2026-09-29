// QR Model 2, fixed version 6-L, byte mode, mask 0. The deliberately bounded
// encoder is used only for short local authenticator enrollment URIs (no network).
// V6-L has two 68-byte data blocks, each with 18 Reed–Solomon parity bytes.
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 134) throw new Error('Enrollment URI is too long for this QR code.');
  const bits: number[] = [];
  const append = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  append(4, 4);
  append(bytes.length, 8);
  bytes.forEach((b) => append(b, 8));
  append(0, Math.min(4, 1088 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let pad = 0; data.length < 136; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  const multiply = (a: number, b: number) => {
    let result = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) result ^= a;
      b >>>= 1;
      a <<= 1;
      if (a & 256) a ^= 0x11d;
    }
    return result;
  };
  let generator = [1];
  let root = 1;
  for (let i = 0; i < 18; i++) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((n, j) => {
      next[j] ^= n;
      next[j + 1] ^= multiply(n, root);
    });
    generator = next;
    root = multiply(root, 2);
  }
  const blocks = [data.slice(0, 68), data.slice(68)];
  const parity = blocks.map((block) => {
    const work = [...block, ...new Array<number>(18).fill(0)];
    for (let i = 0; i < 68; i++) {
      const value = work[i];
      for (let j = 0; j < generator.length; j++) work[i + j] ^= multiply(generator[j], value);
    }
    return work.slice(68);
  });
  const payload: number[] = [];
  for (let i = 0; i < 68; i++) for (const block of blocks) payload.push(block[i]);
  for (let i = 0; i < 18; i++) for (const block of parity) payload.push(block[i]);
  const size = 41,
    matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
    reserved = matrix.map((row) => row.slice());
  const set = (x: number, y: number, dark: boolean) => {
    if (x >= 0 && y >= 0 && x < size && y < size) {
      matrix[y][x] = dark;
      reserved[y][x] = true;
    }
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      set(34 + dx, 34 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  let remainder = 8;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const format = ((8 << 10) | remainder) ^ 0x5412;
  const bit = (i: number) => ((format >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let index = 0,
    upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (reserved[y][x]) continue;
        const value =
          index < payload.length * 8
            ? ((payload[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0
            : false;
        matrix[y][x] = value !== ((x + y) % 2 === 0);
        index++;
      }
    }
    upward = !upward;
  }
  return matrix;
}
