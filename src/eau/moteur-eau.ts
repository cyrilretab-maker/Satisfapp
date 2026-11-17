// Le moteur de l'eau (mini-jeu 2), sans aucun affichage. Séparé du moteur du décollement.
//
// L'égouttoir est une grille vue du dessus : NX cases en largeur, NY en hauteur ; la pente descend
// vers le bas (y croissant), jusqu'au rebord (dernière rangée), au-dessus de l'évier.
// Chaque case connaît sa hauteur d'eau, et si l'inox y est mouillé (et depuis quand).
//
// Règle centrale : l'eau ne va que là où le doigt lui a ouvert un chemin, et elle descend.
//  - Une case sèche n'accepte l'eau que si la case voisine en a plus que l'« accroche » : la flaque tient.
//  - Le doigt mouille l'inox (la route) ; l'eau s'y engage après une courte hésitation.
//  - L'eau ne passe jamais vers une case plus haute : elle descend ou va de côté.
//  - Là où l'eau coule fort, la route s'élargit.
//  - Une route où l'eau ne passe pas sèche ; un film d'eau reste derrière l'eau qui passe
//    (une petite flaque s'épuise en mouillant sa route), puis il se rassemble en gouttelettes.
//  - Doigt trop rapide : la trace se brise en taches isolées, l'eau n'y passe pas.
//  - Au rebord, l'eau s'accumule en goutte ; un toucher qui glisse vers l'évier la libère.
//    Trop pleine, la goutte déborde seule, en mince filet.
//  - Rien ne se perd : l'eau ne fait que passer de case en case, ou partir dans l'évier.
//
// Calcul déterministe (pas fixes) : mêmes gestes, même résultat.

import { creerHasard } from '../matiere/hasard';

export const NX = 64;
export const NY = 104;
export const REBORD = NY - 1; // la rangée du rebord
const PAS = 1 / 60;
const SOUS_PAS = 4;
const TRACE = 0.02; // en dessous, une case n'a « pas d'eau »
const SEUIL_COMPOSANTE = 0.15; // pour reconnaître une flaque (rencontre de deux flaques)
const TAILLE_FLAQUE_MIN = 10;
const SEUIL_ELARGIT = 0.3;
const GRAVITE = 600;
const RESSAUT = 1.5; // le rebord est un peu plus bas : l'eau s'y rassemble en goutte avant de refouler
const COULEE_MAX = 3;
const PERLE = 4; // le film sèche en gouttelettes espacées de PERLE cases // secondes : une goutte touchée se vide en 1 à 3 secondes // l'eau fine d'une route descend à pente × GRAVITE cases par seconde (environ) // débit en dessous duquel la route ne s'élargit pas (une flaque au repos ne s'étale pas) // cases : en dessous, ce n'est pas une flaque qui en rencontre une autre

export interface ParamsEau {
  pente: number; // différence de hauteur du sol d'une rangée à la suivante
  accroche: number; // hauteur d'eau nécessaire pour avancer sur l'inox sec
  dureeTrace: number; // secondes avant qu'une route sans eau sèche
  largeurDoigt: number; // rayon de la trace du doigt (cases)
  eauEntrainee: number; // part de l'eau que le doigt tire derrière lui, par seconde
  vitesseLimite: number; // cases par seconde : au-delà, la route se coupe
  hesitation: number; // secondes avant que l'eau s'engage dans une route fraîche
  fluidite: number; // vitesse d'écoulement
  elargissement: number; // vitesse à laquelle le débit élargit la route
  film: number; // eau qui reste accrochée à l'inox mouillé, derrière l'eau qui passe
  capaciteRebord: number; // hauteur d'eau d'une goutte au rebord avant le trop-plein
  debordement: number; // débit du trop-plein (hauteur par seconde)
  vidange: number; // vitesse à laquelle une goutte touchée se vide
}

export interface ParamsEvier {
  flaques: number;
  taille: number; // rayon moyen d'une flaque (cases)
  ecart: number; // écart minimum entre deux flaques (cases)
  hauteur: number; // hauteur d'eau d'une flaque (sous l'accroche, pour qu'elle tienne)
}

export type EvenementEau =
  | { type: 'jonction'; x: number; y: number } // deux flaques se rejoignent
  | { type: 'routeCoupee' } // doigt trop rapide
  | { type: 'liberation' } // la goutte du rebord est touchée : elle se vide
  | { type: 'coulee'; volume: number } // fin d'une coulée (volume parti d'un seul toucher)
  | { type: 'tropPlein' }; // une goutte déborde seule

export interface EtatEau {
  version: 1;
  graine: number;
  evier: ParamsEvier;
  temps: number;
  h: string; // hauteurs (Float64, en base64)
  mouille: number[];
  verse: number;
  depart: number;
}

const idx = (x: number, y: number) => y * NX + x;

export class Eau {
  params: ParamsEau;
  readonly graine: number;
  readonly evier: ParamsEvier;
  /** Hauteur d'eau de chaque case. */
  readonly h = new Float64Array(NX * NY);
  /** Hauteur du sol (pente, et plus tard un relief : rainures, feuille…). */
  readonly sol = new Float64Array(NX * NY);
  readonly relief = new Float64Array(NX * NY); // prévu pour les variantes (rainures, nervures) : vide ici
  /** Secondes de mouillé restantes (0 = inox sec). */
  readonly mouille = new Float32Array(NX * NY);
  /** Depuis combien de temps la case est mouillée (l'hésitation de l'eau). */
  readonly age = new Float32Array(NX * NY);
  /** Débit qui traverse la case (lissé), pour l'élargissement, le son et l'image. */
  readonly debit = new Float32Array(NX * NY);
  /** Débit qui part dans l'évier par colonne (lissé) : l'eau qui ruisselle sur la paroi. */
  readonly paroi = new Float32Array(NX);
  /** 1 si la case du rebord est en train de se vider (touchée). */
  readonly liberee = new Uint8Array(NX);
  private readonly elargit = new Float32Array(NX * NY);
  /** 1 si la case fait partie d'une route (tracée par le doigt, ou élargie par l'eau). */
  readonly route = new Uint8Array(NX * NY);
  private readonly calme = new Float32Array(NX * NY);
  private readonly fluxX = new Float64Array(NX * NY);
  private readonly fluxY = new Float64Array(NX * NY);
  private readonly sortie = new Float64Array(NX * NY);
  private composantes = new Int32Array(NX * NY).fill(-1);
  private taillesComposantes: number[] = [];
  temps = 0;
  /** Eau partie dans l'évier (vers le vase). */
  verse = 0;
  /** Eau au départ (pour vérifier que rien ne se perd, et savoir quand c'est fini). */
  depart = 0;
  /** Volume de la coulée en cours (toucher du rebord). */
  coulee = 0;
  private debutCoulee = -1;
  evenements: EvenementEau[] = [];
  readonly doigt = { pose: false, x: 0, y: 0, avantX: 0, avantY: 0, vitesse: 0, dansEau: 0 };
  private reste = 0;
  private dernierCoupe = -Infinity;
  private dernierTropPlein = -Infinity;
  private compteur = 0;

  constructor(graine: number, evier: ParamsEvier, params: ParamsEau) {
    this.graine = graine;
    this.evier = { ...evier };
    this.params = params;
    this.calculerSol();
    this.poserFlaques();
    this.depart = this.total();
    this.calculerComposantes();
  }

  private calculerSol(): void {
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        this.sol[idx(x, y)] = this.params.pente * (REBORD - y) + this.relief[idx(x, y)] - (y === REBORD ? RESSAUT : 0);
      }
    }
  }

  /** Les flaques : leur nombre, leur taille et leur place viennent du numéro de tirage. */
  private poserFlaques(): void {
    const hasard = creerHasard(this.graine);
    const e = this.evier;
    const posees: { x: number; y: number; r: number }[] = [];
    for (let essai = 0; essai < 400 && posees.length < Math.round(e.flaques); essai++) {
      const r = e.taille * (0.65 + hasard() * 0.7);
      const x = r + 2 + hasard() * (NX - 2 * r - 4);
      const y = r + 2 + hasard() * (NY * 0.78 - 2 * r - 4);
      if (posees.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + e.ecart)) continue;
      const bosses = [hasard() * 6.3, hasard() * 6.3, 0.1 + hasard() * 0.12, 0.05 + hasard() * 0.08];
      posees.push({ x, y, r });
      for (let j = Math.floor(y - r * 1.3); j <= Math.ceil(y + r * 1.3); j++) {
        for (let i = Math.floor(x - r * 1.3); i <= Math.ceil(x + r * 1.3); i++) {
          if (i < 0 || i >= NX || j < 0 || j >= REBORD) continue;
          const a = Math.atan2(j - y, i - x);
          const rr = r * (1 + bosses[2] * Math.sin(2 * a + bosses[0]) + bosses[3] * Math.sin(3 * a + bosses[1]));
          const d = Math.hypot(i - x, j - y);
          if (d > rr) continue;
          // Une flaque au repos : la surface de l'eau est à plat, même sur la pente (plus profonde en bas).
          const k = idx(i, j);
          this.h[k] = Math.max(0.3, e.hauteur + this.params.pente * (j - y));
          this.mouille[k] = this.params.dureeTrace;
          this.age[k] = 10;
        }
      }
    }
  }

  total(): number {
    let s = 0;
    for (let k = 0; k < this.h.length; k++) s += this.h[k];
    return s;
  }

  /** Eau encore sur l'égouttoir (rebord compris). */
  restante(): number {
    return this.total();
  }

  /** Tout est versé (il reste moins que `seuil` de l'eau de départ, et rien ne coule). */
  estVide(seuil: number): boolean {
    return this.total() <= this.depart * seuil && this.coulee === 0;
  }

  /** Remplissage de la plus grosse goutte du rebord (0..1 = jusqu'au trop-plein). */
  goutte(): number {
    let m = 0;
    for (let x = 0; x < NX; x++) m = Math.max(m, this.h[idx(x, REBORD)]);
    return m / Math.max(1e-6, this.params.capaciteRebord);
  }

  /** Débit total dans les routes (hors rebord), pour le son et la vibration. */
  debitTotal(): number {
    let s = 0;
    for (let k = 0; k < idx(0, REBORD); k++) s += this.debit[k];
    return s;
  }

  prendreEvenements(): EvenementEau[] {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  // ---------- Le doigt ----------

  poserDoigt(x: number, y: number): void {
    const d = this.doigt;
    d.pose = true;
    d.x = d.avantX = x;
    d.y = d.avantY = y;
  }

  deplacerDoigt(x: number, y: number): void {
    this.doigt.x = x;
    this.doigt.y = y;
  }

  leverDoigt(): void {
    this.doigt.pose = false;
    this.doigt.vitesse = 0;
  }

  // ---------- Le temps ----------

  avancer(dt: number): void {
    this.reste += Math.min(dt, 0.1);
    while (this.reste >= PAS) {
      this.reste -= PAS;
      this.pas();
    }
  }

  private pas(): void {
    this.temps += PAS;
    this.calculerSol();
    this.passageDuDoigt();
    this.debit.fill(0);
    const h = PAS / SOUS_PAS;
    for (let s = 0; s < SOUS_PAS; s++) this.ecouler(h);
    this.rebord(PAS);
    this.mouiller(PAS);
    if (++this.compteur % 6 === 0) this.calculerComposantes();
  }

  /** Le doigt : il mouille l'inox, et entraîne l'eau sous lui. Trop rapide, la trace se brise. */
  private passageDuDoigt(): void {
    const d = this.doigt;
    if (!d.pose) {
      d.dansEau = 0;
      return;
    }
    const p = this.params;
    const dx = d.x - d.avantX;
    const dy = d.y - d.avantY;
    const L = Math.hypot(dx, dy);
    d.vitesse = L / PAS;
    const r = p.largeurDoigt;
    const rapide = d.vitesse > p.vitesseLimite;
    if (rapide) {
      // La trace se brise : des taches isolées, trop loin les unes des autres pour que l'eau passe.
      const ecart = r * 3.2;
      for (let t = 0; t <= L; t += ecart) this.mouillerDisque(d.avantX + (dx * t) / (L || 1), d.avantY + (dy * t) / (L || 1), r * 0.45);
      if (this.temps - this.dernierCoupe > 0.5) {
        this.dernierCoupe = this.temps;
        this.evenements.push({ type: 'routeCoupee' });
      }
    } else {
      // Une trace continue, et l'eau sous le doigt est entraînée vers sa nouvelle position.
      const n = Math.max(1, Math.ceil(L / 0.5));
      for (let k = 1; k <= n; k++) this.mouillerDisque(d.avantX + (dx * k) / n, d.avantY + (dy * k) / n, r);
      if (L > 1e-6) this.entrainer(d.avantX, d.avantY, d.x, d.y, r);
    }
    if (L <= 1e-6) this.mouillerDisque(d.x, d.y, r);
    // Combien d'eau sous le doigt (pour le son et la vibration).
    let sous = 0;
    this.parcourirDisque(d.x, d.y, r, (k) => (sous += this.h[k]));
    d.dansEau = sous;
    d.avantX = d.x;
    d.avantY = d.y;
  }

  private parcourirDisque(cx: number, cy: number, r: number, f: (k: number, x: number, y: number) => void): void {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(NY - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(NX - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) f(idx(x, y), x, y);
      }
    }
  }

  private mouillerDisque(cx: number, cy: number, r: number): void {
    const duree = this.params.dureeTrace;
    this.parcourirDisque(cx, cy, Math.max(0.5, r), (k) => {
      if (this.mouille[k] <= 0) this.age[k] = 0;
      this.mouille[k] = duree;
      this.route[k] = 1;
    });
  }

  /** L'eau sous l'ancienne position du doigt, qu'il quitte, le suit en partie (un filet derrière lui). */
  private entrainer(ax: number, ay: number, bx: number, by: number, r: number): void {
    const part = Math.min(1, this.params.eauEntrainee * PAS);
    let pris = 0;
    this.parcourirDisque(ax, ay, r, (k, x, y) => {
      if ((x - bx) ** 2 + (y - by) ** 2 <= r * r) return; // encore sous le doigt
      const q = this.h[k] * part;
      this.h[k] -= q;
      pris += q;
    });
    if (pris <= 0) return;
    const cases: number[] = [];
    this.parcourirDisque(bx, by, r, (k) => cases.push(k));
    if (cases.length === 0) {
      // Le doigt est sorti de l'égouttoir : l'eau reste là où elle était (rien ne se perd).
      this.parcourirDisque(ax, ay, r, (k) => cases.push(k));
    }
    for (const k of cases) this.h[k] += pris / cases.length;
  }

  /** Une case accepte l'eau : elle en a déjà, ou elle est mouillée depuis assez longtemps. */
  private ouverte(k: number): boolean {
    return this.h[k] > TRACE || (this.mouille[k] > 0 && this.age[k] >= this.params.hesitation);
  }

  /** L'écoulement entre cases voisines : du plus haut niveau vers le plus bas, jamais vers un sol plus haut. */
  private ecouler(dt: number): void {
    const p = this.params;
    const { h, sol, fluxX, fluxY, sortie } = this;
    const k = p.fluidite * dt;
    sortie.fill(0);
    // 1. Les débits proposés sur chaque côté (à droite, en bas).
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const a = idx(x, y);
        fluxX[a] = x < NX - 1 ? this.fluxEntre(a, a + 1, k, dt) : 0;
        fluxY[a] = y < NY - 1 ? this.fluxEntre(a, a + NX, k, dt) : 0;
        if (fluxX[a] > 0) sortie[a] += fluxX[a];
        else if (fluxX[a] < 0) sortie[a + 1] -= fluxX[a];
        if (fluxY[a] > 0) sortie[a] += fluxY[a];
        else if (fluxY[a] < 0) sortie[a + NX] -= fluxY[a];
      }
    }
    // 2. Une case ne peut pas donner plus que son eau libre (au-dessus du film) : on réduit.
    const echelle = (c: number) => {
      const libre = Math.max(0, h[c] - p.film);
      return sortie[c] > libre ? libre / sortie[c] : 1;
    };
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const a = idx(x, y);
        let f = fluxX[a];
        if (f !== 0) {
          f *= f > 0 ? echelle(a) : echelle(a + 1);
          fluxX[a] = f;
        }
        let g = fluxY[a];
        if (g !== 0) {
          g *= g > 0 ? echelle(a) : echelle(a + NX);
          fluxY[a] = g;
        }
      }
    }
    // 3. On applique (ce qui part d'une case arrive dans l'autre : rien ne se perd).
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const a = idx(x, y);
        const f = fluxX[a];
        if (f !== 0) {
          h[a] -= f;
          h[a + 1] += f;
          const v = Math.abs(f) / dt;
          this.debit[a] += v / SOUS_PAS;
          this.debit[a + 1] += v / SOUS_PAS;
        }
        const g = fluxY[a];
        if (g !== 0) {
          h[a] -= g;
          h[a + NX] += g;
          const v = Math.abs(g) / dt;
          this.debit[a] += v / SOUS_PAS;
          this.debit[a + NX] += v / SOUS_PAS;
        }
      }
    }
    void sol;
  }

  /** Débit proposé de a vers b (positif) ou de b vers a (négatif). */
  private fluxEntre(a: number, b: number, k: number, dt: number): number {
    const h = this.h;
    const sa = this.sol[a] + h[a];
    const sb = this.sol[b] + h[b];
    let de = a;
    let vers = b;
    let ecart = sa - sb;
    if (ecart < 0) {
      de = b;
      vers = a;
      ecart = -ecart;
    }
    if (ecart <= 1e-9 || h[de] <= this.params.film + 1e-9) return 0;
    // Jamais vers un sol plus haut : l'eau ne remonte pas la pente.
    if (this.sol[vers] > this.sol[de] + 1e-9) return 0;
    // L'inox sec retient la flaque, sauf si elle est assez haute pour avancer seule.
    // (Le long du rebord, la goutte bombe d'abord : elle ne rejoint sa voisine que bien pleine.)
    const surLeRebord = de >= REBORD * NX && vers >= REBORD * NX;
    const accroche = surLeRebord ? Math.max(this.params.accroche, this.params.capaciteRebord * 0.7) : this.params.accroche;
    if (!this.ouverte(vers) && h[de] < accroche) return 0;
    let f = Math.min(ecart * k, ecart * 0.24);
    // Dans une route, l'eau fine court vers le bas (une flaque, épaisse, reste en place).
    const p = this.params;
    if (this.sol[vers] < this.sol[de] - 1e-9 && this.route[vers] && h[de] < p.accroche * 0.5) {
      f += h[de] * Math.min(0.5, p.pente * GRAVITE * dt);
    }
    f = Math.min(f, Math.max(0, h[de] - p.film) * 0.5);
    return de === a ? f : -f;
  }

  /** Mouillé, séchage, élargissement des routes, et le film qui se rassemble en gouttelettes. */
  private mouiller(dt: number): void {
    const p = this.params;
    for (let k = 0; k < this.h.length; k++) {
      // Le débit élargit la route : les cases voisines d'un écoulement se mouillent peu à peu.
      const v = this.debit[k];
      // Seule l'eau qui court dans une route l'élargit (une flaque, épaisse, ne s'étale pas).
      if (this.route[k] && v > SEUIL_ELARGIT && this.h[k] < p.accroche * 0.5) {
        const x = k % NX;
        const y = (k - x) / NX;
        const voisins = [x > 0 ? k - 1 : -1, x < NX - 1 ? k + 1 : -1, y > 0 ? k - NX : -1, y < NY - 1 ? k + NX : -1];
        for (const j of voisins) {
          if (j < 0 || this.mouille[j] > 0) continue;
          // Au plus « élargissement » cases par seconde, quand le débit est fort.
          this.elargit[j] += p.elargissement * Math.min(1, (v - SEUIL_ELARGIT) / 3) * dt;
          if (this.elargit[j] >= 1) {
            this.elargit[j] = 0;
            this.mouille[j] = p.dureeTrace;
            this.age[j] = 0;
            this.route[j] = 1;
          }
        }
      }
      if (this.h[k] > TRACE) {
        this.mouille[k] = p.dureeTrace;
        this.age[k] += dt;
      } else if (this.mouille[k] > 0) {
        this.mouille[k] -= dt;
        this.age[k] += dt;
        if (this.mouille[k] <= 0) {
          this.mouille[k] = 0;
          this.age[k] = 0;
          this.elargit[k] = 0;
          this.route[k] = 0;
        }
      }
      // Le film resté derrière l'eau se rassemble en gouttelettes quand plus rien ne coule.
      this.calme[k] = v > 0.05 ? 0 : this.calme[k] + dt;
    }
    // Le film perle : quand plus rien ne coule, il se rassemble en gouttelettes espacées
    // (une tous les PERLE × PERLE cases), qu'il faudra aller chercher du doigt. Rien ne se perd.
    for (let k = 0; k < this.h.length; k++) {
      if (this.calme[k] < Math.min(1.5, p.dureeTrace) || this.h[k] <= 0 || this.h[k] > p.film * 1.5) continue;
      const x = k % NX;
      const y = (k - x) / NX;
      if (y === REBORD) continue;
      // Chaque petit carré de PERLE × PERLE cases a sa gouttelette, à une place tirée au hasard (toujours la même).
      const bx = x - (x % PERLE);
      const by = y - (y % PERLE);
      const hache = ((bx * 73856093) ^ (by * 19349663) ^ this.graine) >>> 0;
      const cx = Math.min(NX - 1, bx + (hache % PERLE));
      const cy = Math.min(REBORD - 1, by + ((hache >>> 8) % PERLE));
      const c = idx(cx, cy);
      if (c === k) continue;
      this.h[c] += this.h[k];
      this.h[k] = 0;
      // L'inox sous le film qui a perlé est sec : la gouttelette ne s'y étale plus.
      this.mouille[k] = 0;
      this.age[k] = 0;
      this.route[k] = 0;
      this.elargit[k] = 0;
    }
  }

  /** Le rebord : la goutte qui gonfle, le trop-plein, et la goutte touchée qui se vide. */
  private rebord(dt: number): void {
    const p = this.params;
    const d = this.doigt;
    for (let x = 0; x < NX; x++) this.paroi[x] *= Math.exp(-dt / 0.35);
    // Le toucher : le doigt sur une goutte du rebord, qui glisse vers l'évier.
    if (d.pose && d.y >= REBORD - p.largeurDoigt && d.y - d.avantY >= 0 && d.vitesse > 2) {
      let libere = false;
      this.parcourirDisque(d.x, Math.min(d.y, REBORD), p.largeurDoigt, (k, x, y) => {
        if (y !== REBORD || this.h[k] <= p.film || this.liberee[x]) return;
        this.liberee[x] = 1;
        libere = true;
      });
      if (libere && this.debutCoulee < 0) {
        this.debutCoulee = this.temps;
        this.evenements.push({ type: 'liberation' });
      }
    }
    // Une goutte touchée se vide entièrement (elle entraîne ses voisines qui ont de l'eau).
    let enCours = false;
    for (let x = 0; x < NX; x++) {
      if (!this.liberee[x]) continue;
      for (const v of [x - 1, x + 1]) if (v >= 0 && v < NX && !this.liberee[v] && this.h[idx(v, REBORD)] > p.film) this.liberee[v] = 1;
    }
    for (let x = 0; x < NX; x++) {
      const k = idx(x, REBORD);
      if (this.liberee[x]) {
        const part = Math.min(this.h[k], this.h[k] * p.vidange * dt + 0.02 * dt);
        this.h[k] -= part;
        this.verse += part;
        this.coulee += part;
        this.paroi[x] += part / dt / 8;
        // La goutte est vide quand il n'en reste presque rien (un filet qui arrive formera une nouvelle goutte).
        if (this.h[k] > 0.05 && this.temps - this.debutCoulee < COULEE_MAX) enCours = true;
        else {
          // La goutte est vide : les dernières traces partent avec elle (ce qui arrive encore fera une nouvelle goutte).
          if (this.h[k] <= 0.05) {
            this.verse += this.h[k];
            this.coulee += this.h[k];
            this.h[k] = 0;
          }
          this.liberee[x] = 0;
        }
      } else if (this.h[k] > p.capaciteRebord) {
        // Trop-plein : la goutte déborde seule, en mince filet. Rien n'est perdu.
        const part = Math.min(this.h[k] - p.capaciteRebord, p.debordement * dt);
        this.h[k] -= part;
        this.verse += part;
        this.paroi[x] += part / dt / 8;
        if (this.temps - this.dernierTropPlein > 1) {
          this.dernierTropPlein = this.temps;
          this.evenements.push({ type: 'tropPlein' });
        }
      }
    }
    if (!enCours && this.debutCoulee >= 0) {
      this.liberee.fill(0);
      if (this.coulee > 0) this.evenements.push({ type: 'coulee', volume: this.coulee });
      this.coulee = 0;
      this.debutCoulee = -1;
    }
  }

  /** Les flaques (eau d'un seul tenant) : quand deux flaques se rejoignent, on le signale. */
  private calculerComposantes(): void {
    const nouv = new Int32Array(NX * NY).fill(-1);
    const tailles: number[] = [];
    const pile: number[] = [];
    for (let k = 0; k < nouv.length; k++) {
      if (nouv[k] >= 0 || this.h[k] < SEUIL_COMPOSANTE) continue;
      const id = tailles.length;
      let n = 0;
      pile.push(k);
      nouv[k] = id;
      while (pile.length) {
        const c = pile.pop()!;
        n++;
        const x = c % NX;
        for (const j of [x > 0 ? c - 1 : -1, x < NX - 1 ? c + 1 : -1, c - NX, c + NX]) {
          if (j < 0 || j >= nouv.length || nouv[j] >= 0 || this.h[j] < SEUIL_COMPOSANTE) continue;
          nouv[j] = id;
          pile.push(j);
        }
      }
      tailles.push(n);
    }
    // Une nouvelle flaque qui contient deux anciennes flaques : elles viennent de se rejoindre.
    const anciennes = new Map<number, Set<number>>();
    for (let k = 0; k < nouv.length; k++) {
      const a = this.composantes[k];
      if (nouv[k] < 0 || a < 0 || this.taillesComposantes[a] < TAILLE_FLAQUE_MIN) continue;
      if (!anciennes.has(nouv[k])) anciennes.set(nouv[k], new Set());
      anciennes.get(nouv[k])!.add(a);
    }
    for (const [id, set] of anciennes) {
      if (set.size < 2) continue;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let k = 0; k < nouv.length; k++) {
        if (nouv[k] !== id) continue;
        sx += k % NX;
        sy += Math.floor(k / NX);
        n++;
      }
      // Les rangées du rebord ne comptent pas : les gouttes qui fusionnent ne sont pas des flaques.
      if (sy / n < REBORD - 2) this.evenements.push({ type: 'jonction', x: sx / n, y: sy / n });
    }
    this.composantes = nouv;
    this.taillesComposantes = tailles;
  }

  // ---------- Sauvegarde ----------

  exporter(): EtatEau {
    const octets = new Uint8Array(this.h.buffer.slice(0));
    let texte = '';
    for (let i = 0; i < octets.length; i++) texte += String.fromCharCode(octets[i]);
    return {
      version: 1,
      graine: this.graine,
      evier: { ...this.evier },
      temps: this.temps,
      h: btoa(texte),
      mouille: Array.from(this.mouille, (v) => Math.round(v * 100) / 100),
      verse: this.verse,
      depart: this.depart,
    };
  }

  importer(e: EtatEau): boolean {
    try {
      const brut = atob(e.h);
      if (brut.length !== this.h.length * 8 || e.mouille.length !== this.h.length) return false;
      const octets = new Uint8Array(brut.length);
      for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
      this.h.set(new Float64Array(octets.buffer));
      for (let k = 0; k < this.h.length; k++) {
        this.mouille[k] = e.mouille[k];
        this.age[k] = e.mouille[k] > 0 ? 10 : 0;
      }
      this.temps = e.temps;
      this.verse = e.verse;
      this.depart = e.depart;
      this.calculerComposantes();
      return true;
    } catch {
      return false;
    }
  }
}
