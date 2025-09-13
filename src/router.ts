export function parseRoute(hash: string): { slideIdx: number } {
  // Format attendu: #/slide/0
  const [, , idx] = hash.split("/");
  const n = Number(idx);
  return { slideIdx: Number.isFinite(n) && n >= 0 ? n : 0 };
}

export function toHash(slideIdx: number) {
  return `#/slide/${slideIdx}`;
}
