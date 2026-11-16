// Affichage en formes grises (lots 1 à 3). Il ne fait que lire l'état du moteur et de la peau.

import { RAYON_PAROI, type Simulation } from '../matiere/moteur';
import type { Disposition } from './ecran';
import type { Peau } from './peau';

const COULEURS = {
  page: '#1e1e1e',
  fond: '#3b3b3b', // le fond du conduit, derrière le bouchon
  paroi: '#4a4a4a', // la paroi du conduit, tout autour
  bordVue: '#111',
  // Matière, de « collée partout » (foncé) à « décollée » (clair)
  matiere: ['#8a8a8a', '#959595', '#a2a2a2', '#b0b0b0'],
  fil: '#a8a8a8',
  outil: '#e8e8e8',
  outilFerme: '#ffffff',
  pave: '#2a2a2a',
  paveBord: '#3a3a3a',
  paveTexte: '#555',
};

export interface OptionsDessin {
  temps: number; // secondes (horloge de la page)
  dureeRougeur: number; // secondes
  sursaut: number; // amplitude en pixels (0 = coupé)
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

  // La vue ronde : la paroi tout autour, le fond au milieu.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = COULEURS.paroi;
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy, R * RAYON_PAROI, 0, Math.PI * 2);
  ctx.fillStyle = COULEURS.fond;
  ctx.fill();

  // Les rougeurs laissées par les contacts avec la peau.
  for (const r of peau.rougeurs) {
    const force = peau.intensite(r, o.temps, o.dureeRougeur);
    if (force <= 0) continue;
    const gx = cx + r.x * R;
    const gy = cy + r.y * R;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.12);
    g.addColorStop(0, `rgba(190, 70, 70, ${0.55 * force})`);
    g.addColorStop(1, 'rgba(190, 70, 70, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - R * 0.12, gy - R * 0.12, R * 0.24, R * 0.24);
  }

  const X = (i: number) => cx + sim.x[i] * R;
  const Y = (i: number) => cy + sim.y[i] * R;
  const b = sim.b;
  const tient = (i: number) => (sim.estLibre(i) ? 0 : 1);

  // Triangles de matière, regroupés par teinte (selon combien de leurs coins tiennent encore).
  const chemins = COULEURS.matiere.map(() => new Path2D());
  const nt = b.triangles.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = b.triangles[3 * t];
    const c = b.triangles[3 * t + 1];
    const e = b.triangles[3 * t + 2];
    if (sim.sorti[a] || sim.sorti[c] || sim.sorti[e] || !sim.triangleIntact(t)) continue;
    const ch = chemins[3 - (tient(a) + tient(c) + tient(e))];
    ch.moveTo(X(a), Y(a));
    ch.lineTo(X(c), Y(c));
    ch.lineTo(X(e), Y(e));
    ch.closePath();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  chemins.forEach((ch, k) => {
    ctx.fillStyle = COULEURS.matiere[k];
    ctx.strokeStyle = COULEURS.matiere[k];
    ctx.fill(ch);
    ctx.stroke(ch); // bouche les fentes fines entre triangles voisins
  });

  // Fils de matière qui ne forment plus de surface (liens seuls)
  const fils = new Path2D();
  for (let l = 0; l < b.lienA.length; l++) {
    if (!sim.lienOk[l]) continue;
    const t1 = b.lienTriangles[2 * l];
    const t2 = b.lienTriangles[2 * l + 1];
    if ((t1 >= 0 && sim.triangleIntact(t1)) || (t2 >= 0 && sim.triangleIntact(t2))) continue;
    const a = b.lienA[l];
    const c = b.lienB[l];
    if (sim.sorti[a] || sim.sorti[c]) continue;
    fils.moveTo(X(a), Y(a));
    fils.lineTo(X(c), Y(c));
  }
  ctx.strokeStyle = COULEURS.fil;
  ctx.lineWidth = Math.max(1.5, R * 0.012);
  ctx.lineCap = 'round';
  ctx.stroke(fils);

  // L'outil
  const ox = cx + sim.outil.x * R;
  const oy = cy + sim.outil.y * R;
  if (sim.outil.type === 'spatule') dessinerSpatule(ctx, ox, oy, R);
  else dessinerPince(ctx, ox, oy, sim.outil.ferme, R);
  ctx.restore();

  // Bord sombre de la vue
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = COULEURS.bordVue;
  ctx.lineWidth = 4;
  ctx.stroke();
}

const MANCHE: [number, number] = [0.45, 0.89]; // direction du manche (vers le bas, un peu à droite)

/** Une pince vue de face : deux mors qui viennent d'en bas à droite. Ouverte ou fermée. */
function dessinerPince(ctx: CanvasRenderingContext2D, x: number, y: number, ferme: boolean, R: number): void {
  const longueur = R * 0.22;
  const [dx, dy] = MANCHE;
  const [nx, ny] = [-dy, dx];
  const ouverture = ferme ? R * 0.006 : R * 0.035;
  ctx.strokeStyle = ferme ? COULEURS.outilFerme : COULEURS.outil;
  ctx.lineWidth = Math.max(2, R * 0.014);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(x + nx * ouverture * s, y + ny * ouverture * s);
    ctx.lineTo(x + dx * longueur, y + dy * longueur);
  }
  ctx.lineTo(x + dx * R * 2, y + dy * R * 2);
  ctx.stroke();
}

/** Une spatule : une petite lame plate et arrondie au bout d'une tige fine. */
function dessinerSpatule(ctx: CanvasRenderingContext2D, x: number, y: number, R: number): void {
  const [dx, dy] = MANCHE;
  const lame = R * 0.09;
  ctx.strokeStyle = COULEURS.outil;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(5, R * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx * lame, y + dy * lame);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, R * 0.012);
  ctx.beginPath();
  ctx.moveTo(x + dx * lame, y + dy * lame);
  ctx.lineTo(x + dx * R * 2, y + dy * R * 2);
  ctx.stroke();
}
