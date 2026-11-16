// Affichage habillé (lot 4) : vue ronde d'endoscope, cire dorée un peu translucide avec reflets,
// peau du conduit qui s'éclaircit une fois dégagée. Il ne fait que lire l'état du moteur et de la peau.

import { RAYON_PAROI, type Simulation } from '../matiere/moteur';
import type { Disposition } from './ecran';
import type { Peau } from './peau';

const COULEURS = {
  page: '#141010',
  pave: '#221c1b',
  paveBord: '#352c2a',
  paveTexte: '#5a4d4a',
  bordVue: '#050303',
  // La peau : le fond du conduit est sombre au milieu, la paroi plus claire tout autour.
  fondProfond: '#1c100d',
  fondMilieu: '#6e4338',
  paroi: '#c58c78',
  peauPropre: '224, 172, 152', // la peau dégagée « respire » (rgb)
  rougeur: '205, 45, 55', // rgb
  // La cire, de « collée partout » (ambre foncé) à « décollée » (miel clair), en 7 nuances
  cire: ['#7c4f17', '#87591b', '#93641f', '#a07024', '#ae7d2b', '#bd8c33', '#cc9b3d'],
  cireBord: 'rgba(80, 45, 10, 0.75)',
  blanchie: '250, 238, 205', // rgb : la cire blanchit là où elle va céder
  outil: '#d9dde0',
  outilOmbre: 'rgba(0, 0, 0, 0.35)',
};

const DUREE_ECLAIRCISSEMENT = 2.5; // secondes pour que la peau dégagée s'éclaircisse

export interface OptionsDessin {
  temps: number; // secondes (horloge de la page)
  dureeRougeur: number; // secondes
  sursaut: number; // amplitude en pixels (0 = coupé)
  blanchiment: number; // part de l'étirement maximal à partir de laquelle la cire blanchit
}

export function dessiner(
  ctx: CanvasRenderingContext2D,
  sim: Simulation,
  d: Disposition,
  peau: Peau,
  o: OptionsDessin,
): void {
  const R = d.rayon;
  const [sx, sy] = peau.sursaut(o.temps, o.sursaut);
  const cx = d.cx + sx;
  const cy = d.cy + sy;
  ctx.fillStyle = COULEURS.page;
  ctx.fillRect(0, 0, d.largeur, d.hauteur);
  dessinerPave(ctx, d);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // 1. La peau du conduit : sombre au fond, claire sur la paroi.
  const peauDegrade = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  peauDegrade.addColorStop(0, COULEURS.fondProfond);
  peauDegrade.addColorStop(0.55, COULEURS.fondMilieu);
  peauDegrade.addColorStop(RAYON_PAROI, COULEURS.paroi);
  peauDegrade.addColorStop(1, COULEURS.paroi);
  ctx.fillStyle = peauDegrade;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  const X = (i: number) => cx + sim.x[i] * R;
  const Y = (i: number) => cy + sim.y[i] * R;
  const b = sim.b;

  // 2. La peau dégagée s'éclaircit peu à peu, là où le bouchon était.
  const tailleTache = R * sim.b.lienLongueur[0] * 1.6;
  for (let i = 0; i < sim.n; i++) {
    if (!sim.sorti[i]) continue;
    const k = Math.min(1, (sim.temps - sim.sortiA[i]) / DUREE_ECLAIRCISSEMENT);
    const gx = cx + b.x0[i] * R;
    const gy = cy + b.y0[i] * R;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, tailleTache);
    g.addColorStop(0, `rgba(${COULEURS.peauPropre}, ${0.28 * k})`);
    g.addColorStop(1, `rgba(${COULEURS.peauPropre}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(gx - tailleTache, gy - tailleTache, 2 * tailleTache, 2 * tailleTache);
  }

  // 3. Les rougeurs laissées par les contacts avec la peau.
  for (const r of peau.rougeurs) {
    const force = peau.intensite(r, o.temps, o.dureeRougeur);
    if (force <= 0) continue;
    const gx = cx + r.x * R;
    const gy = cy + r.y * R;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.12);
    g.addColorStop(0, `rgba(${COULEURS.rougeur}, ${0.5 * force})`);
    g.addColorStop(1, `rgba(${COULEURS.rougeur}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(gx - R * 0.12, gy - R * 0.12, R * 0.24, R * 0.24);
  }

  // 4. La cire : triangles regroupés par teinte selon ce qui leur reste de colle.
  const tient = (i: number) => (sim.colleAuTour[i] ? sim.santeTour[i] : sim.colleAuFond[i] ? sim.sante[i] : 0);
  const chemins = COULEURS.cire.map(() => new Path2D());
  const forme = new Path2D(); // toute la cire, pour les reflets
  const nt = b.triangles.length / 3;
  const visible = new Uint8Array(nt);
  // Chaque point de matière est aussi un petit disque : aux déchirures, la cire reste visible
  // des deux côtés (rien ne « disparaît »), et une miette isolée se voit.
  const rayonPoint = R * b.params.finesse * 0.5;
  for (let i = 0; i < sim.n; i++) {
    if (sim.sorti[i]) continue;
    const ch = chemins[Math.round((1 - tient(i)) * 6)];
    for (const p of [ch, forme]) {
      p.moveTo(X(i) + rayonPoint, Y(i));
      p.arc(X(i), Y(i), rayonPoint, 0, Math.PI * 2);
    }
  }
  for (let t = 0; t < nt; t++) {
    const a = b.triangles[3 * t];
    const c = b.triangles[3 * t + 1];
    const e = b.triangles[3 * t + 2];
    if (sim.sorti[a] || sim.sorti[c] || sim.sorti[e] || !sim.triangleIntact(t)) continue;
    visible[t] = 1;
    const ch = chemins[Math.round(((3 - (tient(a) + tient(c) + tient(e))) / 3) * 6)];
    for (const p of [ch, forme]) {
      p.moveTo(X(a), Y(a));
      p.lineTo(X(c), Y(c));
      p.lineTo(X(e), Y(e));
      p.closePath();
    }
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.94; // un peu translucide : la peau transparaît à peine
  chemins.forEach((ch, k) => {
    ctx.fillStyle = COULEURS.cire[k];
    ctx.strokeStyle = COULEURS.cire[k];
    ctx.fill(ch);
    ctx.stroke(ch); // bouche les fentes fines entre triangles voisins
  });
  ctx.globalAlpha = 1;

  // 5. Le bord de la cire, plus sombre (épaisseur), et les miettes isolées.
  const bords = new Path2D();
  for (let l = 0; l < b.lienA.length; l++) {
    if (!sim.lienOk[l]) continue;
    const t1 = b.lienTriangles[2 * l];
    const t2 = b.lienTriangles[2 * l + 1];
    const n = (t1 >= 0 && visible[t1] ? 1 : 0) + (t2 >= 0 && visible[t2] ? 1 : 0);
    if (n !== 1) continue;
    bords.moveTo(X(b.lienA[l]), Y(b.lienA[l]));
    bords.lineTo(X(b.lienB[l]), Y(b.lienB[l]));
  }
  ctx.strokeStyle = COULEURS.cireBord;
  ctx.lineWidth = Math.max(1.2, R * 0.008);
  ctx.lineCap = 'round';
  ctx.stroke(bords);

  // 6. Blanchiment : la cire pâlit là où elle est près de céder.
  const etirement = new Float32Array(b.lienA.length);
  for (let l = 0; l < b.lienA.length; l++) if (sim.lienOk[l]) etirement[l] = sim.allongement(l) / sim.limite(l);
  for (let t = 0; t < nt; t++) {
    if (!visible[t]) continue;
    const tl = b.triangleLiens;
    const m = Math.max(etirement[tl[3 * t]], etirement[tl[3 * t + 1]], etirement[tl[3 * t + 2]]);
    const k = (m - o.blanchiment) / Math.max(1e-6, 1 - o.blanchiment);
    if (k <= 0) continue;
    const a = b.triangles[3 * t];
    const c = b.triangles[3 * t + 1];
    const e = b.triangles[3 * t + 2];
    ctx.fillStyle = `rgba(${COULEURS.blanchie}, ${Math.min(0.85, k)})`;
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(c), Y(c));
    ctx.lineTo(X(e), Y(e));
    ctx.closePath();
    ctx.fill();
  }

  // 7. Reflets : la lumière de la caméra fait briller la cire au milieu, et quelques points humides.
  ctx.save();
  ctx.clip(forme);
  const lumiere = ctx.createRadialGradient(cx - R * 0.1, cy - R * 0.15, 0, cx, cy, R * 0.85);
  lumiere.addColorStop(0, 'rgba(255, 240, 200, 0.32)');
  lumiere.addColorStop(0.5, 'rgba(255, 230, 180, 0.08)');
  lumiere.addColorStop(1, 'rgba(255, 230, 180, 0)');
  ctx.fillStyle = lumiere;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  for (let i = 0; i < sim.n; i++) {
    // Quelques points « humides », éparpillés (toujours les mêmes pour un même bouchon).
    const h = (i * 2654435761) >>> 0;
    if (h % 41 !== 0 || sim.sorti[i]) continue;
    const taille = 0.6 + ((h >>> 8) % 100) / 100;
    ctx.fillStyle = `rgba(255, 252, 235, ${0.25 + ((h >>> 16) % 30) / 100})`;
    ctx.beginPath();
    ctx.ellipse(X(i), Y(i), R * 0.016 * taille, R * 0.007 * taille, ((h >>> 4) % 314) / 100, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 8. L'outil, éclairé par la caméra.
  const ox = cx + sim.outil.x * R;
  const oy = cy + sim.outil.y * R;
  if (sim.outil.type === 'spatule') dessinerSpatule(ctx, ox, oy, R);
  else dessinerPince(ctx, ox, oy, sim.outil.ferme, R);

  // 9. Le bord sombre de l'endoscope (vignettage).
  const vignette = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.75, 'rgba(0, 0, 0, 0.35)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  ctx.fillStyle = vignette;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = COULEURS.bordVue;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function dessinerPave(ctx: CanvasRenderingContext2D, d: Disposition): void {
  const p = d.pave;
  ctx.fillStyle = COULEURS.pave;
  ctx.strokeStyle = COULEURS.paveBord;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.l, p.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COULEURS.paveTexte;
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('zone du pouce', p.x + p.l / 2, p.y + p.h / 2);
}

const MANCHE: [number, number] = [0.45, 0.89]; // direction du manche (vers le bas, un peu à droite)

/** Trace une tige métallique : ombre portée, corps, reflet. */
function tige(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, epaisseur: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = COULEURS.outilOmbre;
  ctx.lineWidth = epaisseur + 2;
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y1 + 3);
  ctx.lineTo(x2 + 2, y2 + 3);
  ctx.stroke();
  ctx.strokeStyle = COULEURS.outil;
  ctx.lineWidth = epaisseur;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = Math.max(1, epaisseur * 0.3);
  ctx.beginPath();
  ctx.moveTo(x1 - 1, y1 - 1);
  ctx.lineTo(x2 - 1, y2 - 1);
  ctx.stroke();
}

/** Une pince vue de face : deux mors qui viennent d'en bas à droite. Ouverte ou fermée. */
function dessinerPince(ctx: CanvasRenderingContext2D, x: number, y: number, ferme: boolean, R: number): void {
  const longueur = R * 0.22;
  const [dx, dy] = MANCHE;
  const [nx, ny] = [-dy, dx];
  const ouverture = ferme ? R * 0.006 : R * 0.035;
  const e = Math.max(2, R * 0.016);
  for (const s of [-1, 1]) tige(ctx, x + nx * ouverture * s, y + ny * ouverture * s, x + dx * longueur, y + dy * longueur, e);
  tige(ctx, x + dx * longueur, y + dy * longueur, x + dx * R * 2, y + dy * R * 2, e * 1.3);
}

/** Une spatule : une petite lame plate et arrondie au bout d'une tige fine. */
function dessinerSpatule(ctx: CanvasRenderingContext2D, x: number, y: number, R: number): void {
  const [dx, dy] = MANCHE;
  const lame = R * 0.09;
  tige(ctx, x + dx * lame, y + dy * lame, x + dx * R * 2, y + dy * R * 2, Math.max(2, R * 0.014));
  tige(ctx, x, y, x + dx * lame, y + dy * lame, Math.max(5, R * 0.045));
}
