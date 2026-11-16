// Hasard reproductible : le même numéro de tirage donne toujours la même suite de nombres.
// (algorithme « mulberry32 », petit et rapide)

export type Hasard = () => number; // nombre entre 0 (inclus) et 1 (exclu)

export function creerHasard(graine: number): Hasard {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un nouveau numéro de bouchon, entre 1 et 999 999 (facile à noter et à dicter). */
export function nouvelleGraine(): number {
  return 1 + Math.floor(Math.random() * 999_999);
}
