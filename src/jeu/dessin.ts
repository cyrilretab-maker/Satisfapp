// Affichage habillé (lot 4) : vue ronde d'endoscope, cire dorée un peu translucide avec reflets,
// peau du conduit qui s'éclaircit une fois dégagée. Il ne fait que lire l'état du moteur et de la peau.

import { RAYON_PAROI, type Simulation } from '../matiere/moteur';
import type { Disposition } from './ecran';
import type { Peau } from './peau';
import { echelleLocale, versVue, type Vue3D } from './perspective';

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
  /** Vrai quand la peau et la cire sont déjà dessinées par la puce graphique (rendu-gl.ts) :
   * on ne dessine alors que ce qui vient par-dessus (outils, bord de la vue, zone du pouce). */
  parDessus?: boolean;
  /** V2 : le conduit en profondeur. */
  vue: Vue3D;
  /** V2 : le coton-tige se salit à mesure qu'il boit la cire (0..1). */
  salissureCoton?: number;
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
  if (o.parDessus) {
    ctx.clearRect(0, 0, d.largeur, d.hauteur);
  } else {
    ctx.fillStyle = COULEURS.page;
    ctx.fillRect(0, 0, d.largeur, d.hauteur);
  }
  dessinerPave(ctx, d);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  if (!o.parDessus) dessinerPeauEtCire(ctx, sim, peau, o, cx, cy, R);

  // 8. L'outil, vu en perspective : petit au fond, sa tige grossit en venant vers la caméra.
  const a = sim.fractionDePas();
  const mx = sim.outilAvant.x + (sim.outil.x - sim.outilAvant.x) * a;
  const my = sim.outilAvant.y + (sim.outil.y - sim.outilAvant.y) * a;
  const [vx, vy] = versVue(mx, my, o.vue);
  const ox = cx + vx * R;
  const oy = cy + vy * R;
  const taille = R * echelleLocale(mx, my, o.vue); // pixels par unité de matière, là où est la pointe
  // La tige sort de la vue vers le bas à droite (là où se tient la main).
  let ex = vx * 0.35 + MANCHE[0];
  let ey = vy * 0.35 + MANCHE[1];
  const en = Math.hypot(ex, ey) || 1;
  ex = cx + (ex / en) * R * 1.15;
  ey = cy + (ey / en) * R * 1.15;
  const outil = sim.outil.type;
  if (outil === 'spatule') dessinerSpatule(ctx, ox, oy, ex, ey, taille, R);
  else if (outil === 'pince') dessinerPince(ctx, ox, oy, ex, ey, sim.outil.ferme, taille, R);
  else if (outil === 'coton') dessinerCoton(ctx, ox, oy, ex, ey, taille, R, o.salissureCoton ?? 0);
  else dessinerAspirateur(ctx, ox, oy, ex, ey, taille, R, sim.outil.doigt, o.temps);

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

/** Le dessin simple (Canvas 2D) de la peau et de la cire : sert quand la puce graphique n'est pas disponible. */
function dessinerPeauEtCire(
  ctx: CanvasRenderingContext2D,
  sim: Simulation,
  peau: Peau,
  o: OptionsDessin,
  cx: number,
  cy: number,
  R: number,
): void {

  // 1. La peau du conduit : sombre au fond, claire sur la paroi.
  const peauDegrade = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  peauDegrade.addColorStop(0, COULEURS.fondProfond);
  peauDegrade.addColorStop(0.55, COULEURS.fondMilieu);
  peauDegrade.addColorStop(RAYON_PAROI, COULEURS.paroi);
  peauDegrade.addColorStop(1, COULEURS.paroi);
  ctx.fillStyle = peauDegrade;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  const vue = o.vue;
  const X = (i: number) => cx + versVue(sim.x[i], sim.y[i], vue)[0] * R;
  const Y = (i: number) => cy + versVue(sim.x[i], sim.y[i], vue)[1] * R;
  const b = sim.b;

  // 2. La peau dégagée s'éclaircit peu à peu, là où le bouchon était.
  const tailleTache = R * sim.b.lienLongueur[0] * 1.6;
  for (let i = 0; i < sim.n; i++) {
    if (!sim.sorti[i]) continue;
    const k = Math.min(1, (sim.temps - sim.sortiA[i]) / DUREE_ECLAIRCISSEMENT);
    const gx = cx + versVue(b.x0[i], b.y0[i], vue)[0] * R;
    const gy = cy + versVue(b.x0[i], b.y0[i], vue)[1] * R;
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
    const gx = cx + versVue(r.x, r.y, vue)[0] * R;
    const gy = cy + versVue(r.x, r.y, vue)[1] * R;
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
  const rayonPoint = R * vue.fond * b.params.finesse * 0.5;
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

/** Une tige vue en perspective : fine au fond (x1, y1), épaisse vers la caméra (x2, y2). */
function tigeConique(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  e1: number,
  x2: number,
  y2: number,
  e2: number,
  couleur = COULEURS.outil,
): void {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / L;
  const ny = (x2 - x1) / L;
  const contour = (dx: number, dy: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(x1 + nx * e1 * k + dx, y1 + ny * e1 * k + dy);
    ctx.lineTo(x2 + nx * e2 * k + dx, y2 + ny * e2 * k + dy);
    ctx.lineTo(x2 - nx * e2 * k + dx, y2 - ny * e2 * k + dy);
    ctx.lineTo(x1 - nx * e1 * k + dx, y1 - ny * e1 * k + dy);
    ctx.closePath();
  };
  ctx.fillStyle = COULEURS.outilOmbre;
  contour(2, 3, 0.6);
  ctx.fill();
  const g = ctx.createLinearGradient(x2 + nx * e2, y2 + ny * e2, x2 - nx * e2, y2 - ny * e2);
  g.addColorStop(0, '#8a9094');
  g.addColorStop(0.35, couleur);
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, '#7d8387');
  ctx.fillStyle = g;
  contour(0, 0, 0.5);
  ctx.fill();
}

/** Une pince : deux mors fins au bout, une tige qui vient vers la caméra. */
function dessinerPince(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ex: number,
  ey: number,
  ferme: boolean,
  taille: number,
  R: number,
): void {
  const L = Math.hypot(ex - x, ey - y) || 1;
  const [dx, dy] = [(ex - x) / L, (ey - y) / L];
  const [nx, ny] = [-dy, dx];
  const longueur = taille * 0.24;
  const ouverture = ferme ? taille * 0.006 : taille * 0.04;
  const e = Math.max(1.5, taille * 0.02);
  const [jx, jy] = [x + dx * longueur, y + dy * longueur];
  for (const s of [-1, 1]) tigeConique(ctx, x + nx * ouverture * s, y + ny * ouverture * s, e, jx + nx * e * 0.8 * s, jy + ny * e * 0.8 * s, e * 1.2);
  tigeConique(ctx, jx, jy, e * 1.6, ex, ey, Math.max(8, R * 0.06));
}

/** Une spatule : une petite lame plate et arrondie au bout d'une tige fine. */
function dessinerSpatule(ctx: CanvasRenderingContext2D, x: number, y: number, ex: number, ey: number, taille: number, R: number): void {
  const L = Math.hypot(ex - x, ey - y) || 1;
  const [dx, dy] = [(ex - x) / L, (ey - y) / L];
  const lame = taille * 0.1;
  tigeConique(ctx, x + dx * lame, y + dy * lame, Math.max(1.2, taille * 0.012), ex, ey, Math.max(6, R * 0.045));
  tigeConique(ctx, x, y, Math.max(3, taille * 0.05), x + dx * lame, y + dy * lame, Math.max(2, taille * 0.03));
}

/** Un coton-tige : une boule de coton blanc (qui jaunit en buvant la cire) au bout d'un bâtonnet. */
function dessinerCoton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ex: number,
  ey: number,
  taille: number,
  R: number,
  sale: number,
): void {
  const L = Math.hypot(ex - x, ey - y) || 1;
  const [dx, dy] = [(ex - x) / L, (ey - y) / L];
  const r = Math.max(5, taille * 0.09);
  tigeConique(ctx, x + dx * r, y + dy * r, Math.max(1.5, taille * 0.02), ex, ey, Math.max(7, R * 0.05), '#f2f2f0');
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x + dx * r * 0.4, y + dy * r * 0.4);
  ctx.rotate(angle);
  const k = Math.min(1, sale);
  const blanc = [248, 246, 240];
  const cire = [176, 120, 48];
  const c = blanc.map((v, i) => Math.round(v + (cire[i] - v) * k * 0.85));
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
  g.addColorStop(1, `rgb(${Math.round(c[0] * 0.8)}, ${Math.round(c[1] * 0.78)}, ${Math.round(c[2] * 0.75)})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.5, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // Quelques fibres qui dépassent.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 0.7;
  for (let k2 = 0; k2 < 9; k2++) {
    const a = (k2 / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.95);
    ctx.lineTo(Math.cos(a + 0.2) * r * 1.65, Math.sin(a + 0.2) * r * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** L'aspirateur : un tube fin au bout ouvert ; quand il aspire, l'embout tremble un peu. */
function dessinerAspirateur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ex: number,
  ey: number,
  taille: number,
  R: number,
  actif: boolean,
  temps: number,
): void {
  if (actif) {
    x += Math.sin(temps * 90) * 0.6;
    y += Math.cos(temps * 70) * 0.6;
  }
  const r = Math.max(3, taille * 0.035);
  tigeConique(ctx, x, y, r, ex, ey, Math.max(9, R * 0.065), '#c9ced2');
  ctx.fillStyle = 'rgba(20, 14, 12, 0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.75, r * 0.55, Math.atan2(ey - y, ex - x), 0, Math.PI * 2);
  ctx.fill();
  if (actif) {
    // Un léger souffle : la cire autour est tirée vers l'embout.
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.25)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + temps * 3;
      const d = r * (2.2 + ((temps * 4 + k * 0.37) % 1) * 1.5);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.lineTo(x + Math.cos(a) * d * 0.55, y + Math.sin(a) * d * 0.55);
      ctx.stroke();
    }
  }
}
