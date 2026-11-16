// Affichage en formes grises (lots 1 à 3). Il ne fait que lire l'état du moteur.

import type { Simulation } from '../matiere/moteur';
import type { Disposition } from './ecran';

const COULEURS = {
  page: '#1e1e1e',
  fond: '#3b3b3b', // le fond du conduit
  bordVue: '#111',
  // Matière, de « collée partout » à « décollée » (un peu plus claire)
  matiere: ['#8a8a8a', '#959595', '#a2a2a2', '#b0b0b0'],
  fil: '#a8a8a8',
  outil: '#e8e8e8',
  outilFerme: '#ffffff',
  pave: '#2a2a2a',
  paveBord: '#3a3a3a',
  paveTexte: '#555',
};

export function dessiner(ctx: CanvasRenderingContext2D, sim: Simulation, d: Disposition): void {
  const { cx, cy, rayon: R } = d;
  ctx.fillStyle = COULEURS.page;
  ctx.fillRect(0, 0, d.largeur, d.hauteur);

  {
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

  // La vue ronde
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = COULEURS.fond;
  ctx.fill();
  ctx.clip();

  const X = (i: number) => cx + sim.x[i] * R;
  const Y = (i: number) => cy + sim.y[i] * R;
  const b = sim.b;

  // Triangles de matière, regroupés par teinte (selon combien de leurs coins sont encore collés).
  const chemins = COULEURS.matiere.map(() => new Path2D());
  const nt = b.triangles.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = b.triangles[3 * t];
    const c = b.triangles[3 * t + 1];
    const e = b.triangles[3 * t + 2];
    if (sim.sorti[a] || sim.sorti[c] || sim.sorti[e] || !sim.triangleIntact(t)) continue;
    const decolles = 3 - (sim.colleAuFond[a] + sim.colleAuFond[c] + sim.colleAuFond[e]);
    const ch = chemins[decolles];
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

  // La pince
  dessinerPince(ctx, cx + sim.outil.x * R, cy + sim.outil.y * R, sim.outil.ferme, R);
  ctx.restore();

  // Bord sombre de la vue
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = COULEURS.bordVue;
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** Une pince vue de face : deux mors qui viennent d'en bas à droite. Ouverte ou fermée. */
function dessinerPince(ctx: CanvasRenderingContext2D, x: number, y: number, ferme: boolean, R: number): void {
  const longueur = R * 0.22;
  const [dx, dy] = [0.45, 0.89]; // direction du manche (vers le bas, un peu à droite)
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
