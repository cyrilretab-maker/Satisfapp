// Fabrication d'un bouchon à partir d'un numéro de tirage.
// Le bouchon est une nappe de petits points reliés par des liens, posés en triangles.
// Unités : la vue ronde a un rayon de 1, son centre est en (0, 0).

import { creerHasard } from './hasard';

export interface ParamsBouchon {
  taille: number; // rayon moyen du bouchon (part du rayon de la vue)
  finesse: number; // distance entre deux points voisins
  irregularite: number; // bosses de la forme (0 = rond parfait)
  zonesFaiblesNombre: number;
  zonesFaiblesSolidite: number; // solidité restante des liens dans une zone faible (0..1)
  zonesColleesNombre: number;
  zonesColleesIntensite: number; // la colle du fond y dure jusqu'à N fois plus longtemps
  irregulariteCire: number; // variation de solidité d'un lien à l'autre (0..1)
  entreesNombre: number; // endroits du tour à peine décollés, pour commencer
  entreesTaille: number; // nombre de points du bord dans chaque point d'entrée
}

export interface Bouchon {
  graine: number;
  params: ParamsBouchon; // les réglages de forme qui l'ont fabriqué (pour le refaire à l'identique)
  nbPoints: number;
  x0: Float64Array; // position de départ de chaque point (= où il est collé au fond)
  y0: Float64Array;
  colle: Float64Array; // multiplicateur de durée de la colle du fond, par point (>= 1)
  lienA: Int32Array;
  lienB: Int32Array;
  lienLongueur: Float64Array;
  lienSolidite: Float64Array; // multiplicateur de solidité, par lien (1 = normal)
  lienFaible: Uint8Array; // 1 si le lien est dans une zone faible
  triangles: Int32Array; // 3 points par triangle
  triangleLiens: Int32Array; // 3 liens par triangle
  lienTriangles: Int32Array; // 2 triangles par lien (-1 si absent)
  bord: Uint8Array; // 1 si le point est sur le tour du bouchon (collé à la paroi)
  entree: Uint8Array; // 1 si le point du bord est un point d'entrée (déjà à peine décollé)
  voisinsDebut: Int32Array; // voisins du point i : voisins[voisinsDebut[i] .. voisinsDebut[i+1]]
  voisins: Int32Array;
  voisinsLien: Int32Array; // le lien qui mène à chaque voisin
}

const BANDE_ZONE_FAIBLE = 0.55; // largeur d'une zone faible, en distance entre points

export function genererBouchon(graine: number, p: ParamsBouchon): Bouchon {
  const hasard = creerHasard(graine);
  const h = p.finesse;

  // 1. La forme : un cercle déformé par quelques bosses.
  const bosses = Array.from({ length: 5 }, (_, k) => ({
    ampl: (p.irregularite * (hasard() * 2 - 1)) / (k + 1),
    phase: hasard() * Math.PI * 2,
    k: k + 2,
  }));
  const rayonA = (angle: number) => {
    let r = 1;
    for (const b of bosses) r += b.ampl * Math.cos(b.k * angle + b.phase);
    return Math.min(0.93, p.taille * r); // reste en deçà de la paroi (0,95)
  };

  // 2. Les points, posés en grille triangulaire.
  const hy = (h * Math.sqrt(3)) / 2;
  const nj = Math.ceil(1 / hy);
  const ni = Math.ceil(1 / h) + 1;
  const indice = new Map<string, number>();
  const xs: number[] = [];
  const ys: number[] = [];
  for (let j = -nj; j <= nj; j++) {
    for (let i = -ni; i <= ni; i++) {
      const x = i * h + (Math.abs(j) % 2 === 1 ? h / 2 : 0);
      const y = j * hy;
      if (Math.hypot(x, y) <= rayonA(Math.atan2(y, x))) {
        indice.set(`${i},${j}`, xs.length);
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const pt = (i: number, j: number) => indice.get(`${i},${j}`) ?? -1;
  const voisinsHaut = (i: number, j: number): [number, number] =>
    Math.abs(j) % 2 === 1 ? [pt(i, j + 1), pt(i + 1, j + 1)] : [pt(i - 1, j + 1), pt(i, j + 1)];

  // 3. Les liens et les triangles.
  const lienA: number[] = [];
  const lienB: number[] = [];
  const lienDe = new Map<number, number>();
  const n = xs.length;
  const ajouterLien = (a: number, b: number) => {
    if (a < 0 || b < 0) return;
    const cle = Math.min(a, b) * n + Math.max(a, b);
    if (lienDe.has(cle)) return;
    lienDe.set(cle, lienA.length);
    lienA.push(a);
    lienB.push(b);
  };
  const triangles: number[] = [];
  for (let j = -nj; j <= nj; j++) {
    for (let i = -ni; i <= ni; i++) {
      const p0 = pt(i, j);
      if (p0 < 0) continue;
      const droite = pt(i + 1, j);
      const [hautG, hautD] = voisinsHaut(i, j);
      ajouterLien(p0, droite);
      ajouterLien(p0, hautG);
      ajouterLien(p0, hautD);
      if (droite >= 0 && hautD >= 0) triangles.push(p0, droite, hautD);
      if (hautG >= 0 && hautD >= 0) triangles.push(p0, hautD, hautG);
    }
  }
  const nl = lienA.length;
  const lienNo = (a: number, b: number) => lienDe.get(Math.min(a, b) * n + Math.max(a, b))!;
  const nt = triangles.length / 3;
  const triangleLiens = new Int32Array(nt * 3);
  const lienTriangles = new Int32Array(nl * 2).fill(-1);
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = [triangles[3 * t], triangles[3 * t + 1], triangles[3 * t + 2]];
    const liens = [lienNo(a, b), lienNo(b, c), lienNo(c, a)];
    liens.forEach((l, k) => {
      triangleLiens[3 * t + k] = l;
      if (lienTriangles[2 * l] < 0) lienTriangles[2 * l] = t;
      else lienTriangles[2 * l + 1] = t;
    });
  }

  // 4. Les zones faibles : des lignes courbes cachées qui traversent le bouchon.
  const lignes: { x: number; y: number }[][] = [];
  for (let z = 0; z < Math.round(p.zonesFaiblesNombre); z++) {
    const a1 = hasard() * Math.PI * 2;
    const a2 = a1 + Math.PI + (hasard() * 2 - 1) * 1.2;
    const [x1, y1] = [Math.cos(a1) * p.taille * 1.1, Math.sin(a1) * p.taille * 1.1];
    const [x2, y2] = [Math.cos(a2) * p.taille * 1.1, Math.sin(a2) * p.taille * 1.1];
    const courbure = (hasard() * 2 - 1) * 0.4 * p.taille;
    const [mx, my] = [(x1 + x2) / 2 - ((y2 - y1) / 2) * courbure, (y1 + y2) / 2 + ((x2 - x1) / 2) * courbure];
    const ligne = [];
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      ligne.push({
        x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2,
        y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2,
      });
    }
    lignes.push(ligne);
  }

  const lienLongueur = new Float64Array(nl);
  const lienSolidite = new Float64Array(nl);
  const lienFaible = new Uint8Array(nl);
  for (let l = 0; l < nl; l++) {
    const a = lienA[l];
    const b = lienB[l];
    lienLongueur[l] = Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
    let s = 1 + p.irregulariteCire * (hasard() * 2 - 1);
    const mx = (xs[a] + xs[b]) / 2;
    const my = (ys[a] + ys[b]) / 2;
    if (lignes.some((ligne) => distanceALigne(mx, my, ligne) < BANDE_ZONE_FAIBLE * h)) {
      s *= p.zonesFaiblesSolidite;
      lienFaible[l] = 1;
    }
    lienSolidite[l] = Math.max(0.05, s);
  }

  // 5. Les zones très collées au fond : des taches où la colle dure plus longtemps.
  const taches = Array.from({ length: Math.round(p.zonesColleesNombre) }, () => {
    const angle = hasard() * Math.PI * 2;
    const dist = Math.sqrt(hasard()) * p.taille * 0.7;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: p.taille * (0.15 + hasard() * 0.2) };
  });
  const colle = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let c = 1;
    for (const t of taches) {
      const d2 = (xs[k] - t.x) ** 2 + (ys[k] - t.y) ** 2;
      c += (p.zonesColleesIntensite - 1) * Math.exp(-d2 / (t.r * t.r));
    }
    colle[k] = Math.max(1, c);
  }

  // 6. Le tour : les points du bord (sur un lien qui ne borde qu'un seul triangle).
  const bord = new Uint8Array(n);
  for (let l = 0; l < nl; l++) {
    if (lienTriangles[2 * l + 1] < 0) {
      bord[lienA[l]] = 1;
      bord[lienB[l]] = 1;
    }
  }

  // 7. Les voisins de chaque point (pour parcourir le tour et la nappe).
  const compte = new Int32Array(n + 1);
  for (let l = 0; l < nl; l++) {
    compte[lienA[l] + 1]++;
    compte[lienB[l] + 1]++;
  }
  for (let i = 0; i < n; i++) compte[i + 1] += compte[i];
  const voisinsDebut = Int32Array.from(compte);
  const voisins = new Int32Array(2 * nl);
  const voisinsLien = new Int32Array(2 * nl);
  const curseur = Int32Array.from(compte);
  for (let l = 0; l < nl; l++) {
    voisins[curseur[lienA[l]]] = lienB[l];
    voisinsLien[curseur[lienA[l]]++] = l;
    voisins[curseur[lienB[l]]] = lienA[l];
    voisinsLien[curseur[lienB[l]]++] = l;
  }

  // 8. Les points d'entrée : quelques endroits du tour à peine décollés, en suivant le bord.
  const entree = new Uint8Array(n);
  const pointsDuBord = [...bord.keys()].filter((i) => bord[i]);
  for (let e = 0; e < Math.round(p.entreesNombre) && pointsDuBord.length > 0; e++) {
    const depart = pointsDuBord[Math.floor(hasard() * pointsDuBord.length)];
    const file = [depart];
    let pris = 0;
    while (file.length > 0 && pris < Math.round(p.entreesTaille)) {
      const i = file.shift()!;
      if (entree[i]) continue;
      entree[i] = 1;
      pris++;
      for (let k = voisinsDebut[i]; k < voisinsDebut[i + 1]; k++) {
        const v = voisins[k];
        if (bord[v] && !entree[v] && lienTriangles[2 * voisinsLien[k] + 1] < 0) file.push(v);
      }
    }
  }

  return {
    graine,
    params: { ...p },
    nbPoints: n,
    x0: Float64Array.from(xs),
    y0: Float64Array.from(ys),
    colle,
    lienA: Int32Array.from(lienA),
    lienB: Int32Array.from(lienB),
    lienLongueur,
    lienSolidite,
    lienFaible,
    triangles: Int32Array.from(triangles),
    triangleLiens,
    lienTriangles,
    bord,
    entree,
    voisinsDebut,
    voisins,
    voisinsLien,
  };
}

function distanceALigne(x: number, y: number, ligne: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let s = 0; s < ligne.length - 1; s++) {
    const a = ligne[s];
    const b = ligne[s + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    min = Math.min(min, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return min;
}
