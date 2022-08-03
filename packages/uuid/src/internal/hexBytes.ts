export const hexBytes: string[] = [];

// Build that array
for (let i = 0; i <= 0xff; i++) {
  hexBytes[i] = (i < 16 ? '0' : '') + i.toString(16);
}
