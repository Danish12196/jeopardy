import qrcode from "qrcode-generator";

/** Square boolean matrix (true = dark module) for the given text. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One SVG path (unit squares) covering every dark module, offset by a quiet-zone margin. */
export function qrPath(matrix: boolean[][], margin = 2): { size: number; d: string } {
  const parts: string[] = [];
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) parts.push(`M${c + margin} ${r + margin}h1v1h-1z`);
    })
  );
  return { size: matrix.length + margin * 2, d: parts.join("") };
}
