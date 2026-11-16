// Le moteur de la matière : les règles du bouchon, sans aucun affichage.
//
// Règle centrale : le temps passé sous tension modérée décolle, le pic de force déchire.
//  - Chaque lien casse dès que son allongement dépasse sa limite (pic de force).
//  - L'intérieur du bouchon est collé au fond. Cette colle ne lâche qu'avec le temps, quand on tire
//    à la pince et que la tension est au moins « modérée » ; tirer plus fort ne la fait pas lâcher plus vite.
//  - Changer de direction fait lâcher la colle du fond plus vite.
//  - Le tour du bouchon est collé à la paroi. Seule la spatule le décolle, point par point,
//    en partant d'un bord déjà libre, et seulement quand elle bouge (on pèle, on ne perce pas).
//  - Un bord décollé se rétracte vers le centre : le repli en sac.
//  - Toucher la peau se remarque (événement « paroiTouchee »), sans aucune pénalité.
//
// Calcul : petits pas de temps fixes (déterministe : mêmes gestes, même résultat),
// contraintes de distance « XPBD », stables même avec des liens raides.

import type { Bouchon } from './bouchon';

export type TypeOutil = 'pince' | 'spatule';

export interface ParamsMatiere {
  solidite: number; // force qui casse un lien normal
  elasticite: number; // allongement relatif possible avant rupture (0.5 = +50 %)
  colleDuree: number; // secondes de tension modérée pour décoller un point du fond
  colleSeuil: number; // tension (part de la solidité) à partir de laquelle la colle cède
  colleRaideur: number; // raideur de la colle du fond (plus haut = la matière bouge moins)
  bonusDirection: number; // accélération du décollement quand on change de direction
  tourColle: number; // distance de frottement de la spatule pour décoller un point du tour
  repli: number; // force avec laquelle un bord décollé se rétracte vers le centre
  repliDistance: number; // jusqu'où il se rétracte (unités de vue)
  amortissement: number; // freinage des mouvements (par seconde)
  pincePause: number; // secondes d'immobilité pour fermer la pince
  pinceImmobile: number; // vitesse sous laquelle l'outil est considéré immobile
  pinceRayon: number; // taille de la prise
  pinceFragilite: number; // solidité restante autour d'une prise sur zone encore collée
  pinceRenfort: number; // la cire pincée (pliée dans la pince) résiste N fois mieux
  pinceZonePliee: number; // taille de la zone renforcée, en multiple de la taille de la prise
  spatuleRayon: number; // portée de la pointe de la spatule
  spatuleMouvement: number; // vitesse minimale pour que la spatule (ou un outil qui racle) agisse
  margeParoi: number; // distance tolérée entre la spatule et la matière avant de toucher la peau
  forceGeste: number; // force de traction par unité de distance entre le pouce et la prise
  inertieOutil: number; // secondes de retard de l'outil quand il ne tient rien
  sousPas: number; // nombre de petits pas de calcul par image
}

export type Evenement =
  | { type: 'pinceFermee'; faible: boolean }
  | { type: 'pinceOuverte' }
  | { type: 'lienCasse'; lien: number }
  | { type: 'pointDecolle'; point: number }
  | { type: 'tourDecolle'; point: number }
  | { type: 'paroiTouchee'; x: number; y: number }
  | { type: 'morceauSorti'; points: number; part: number };

// Constantes techniques (pas des sensations) :
const PAS = 1 / 60; // pas de temps fixe, en secondes
const MEMOIRE_DIRECTION = 0.4; // secondes : vitesse à laquelle la colle « oublie » la direction de traction
const BORD_DE_LA_VUE = 1; // un morceau libre que la pince emmène au-delà de ce rayon est sorti
const LIMITE_CIBLE = 1.35; // le pouce ne peut pas emmener l'outil plus loin que ça
export const RAYON_PAROI = 0.95; // au-delà, la pince ouverte racle la paroi du conduit
const RAIDEUR_TOUR = 3; // la colle du tour tient N fois plus raide que celle du fond
const COMPRESSION = 0.3; // la cire se laisse tasser plus facilement qu'étirer (elle se plie)
const ENTRE_DEUX_CONTACTS = 0.3; // secondes minimum entre deux contacts avec la paroi

export class Simulation {
  readonly b: Bouchon;
  params: ParamsMatiere;
  readonly n: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  private readonly vx: Float64Array;
  private readonly vy: Float64Array;
  private readonly px: Float64Array;
  private readonly py: Float64Array;
  /** 1 tant que le point est collé au fond (intérieur du bouchon). */
  readonly colleAuFond: Uint8Array;
  /** Reste de colle du fond, de 1 (intacte) à 0 (lâchée). */
  readonly sante: Float64Array;
  /** 1 tant que le point du tour est collé à la paroi. */
  readonly colleAuTour: Uint8Array;
  /** Reste de colle du tour, de 1 à 0. */
  readonly santeTour: Float64Array;
  /** Direction récente de la traction de la pince. */
  private dirX = 0;
  private dirY = 0;
  /** 1 tant que le lien tient. */
  readonly lienOk: Uint8Array;
  /** 1 si le point a été sorti de la vue. */
  readonly sorti: Uint8Array;
  /** Numéro de morceau de chaque point (morceau = points reliés entre eux). */
  readonly morceau: Int32Array;
  /** 1 si le morceau tient encore quelque part (fond ou tour). */
  morceauColle: Uint8Array = new Uint8Array(0);
  morceauTaille: Int32Array = new Int32Array(0);

  readonly outil = {
    type: 'pince' as TypeOutil,
    x: 0,
    y: 0.5,
    cibleX: 0,
    cibleY: 0.5,
    doigt: false,
    ferme: false,
    faible: false,
    tempsImmobile: 0,
    essaiFait: false,
    vitesse: 0,
    prise: [] as number[],
    decalX: [] as number[],
    decalY: [] as number[],
  };

  temps = 0;
  evenements: Evenement[] = [];
  /** Tailles (part du bouchon de départ) des morceaux sortis, dans l'ordre. */
  readonly morceauxSortis: number[] = [];
  private reste = 0;
  private morceauxAJour = false;
  private dernierContact = -Infinity;
  private readonly lienPinceFaible: Uint8Array;
  /** 1 si le lien touche un point tenu dans la pince. */
  private readonly lienTenu: Uint8Array;

  constructor(bouchon: Bouchon, params: ParamsMatiere) {
    this.b = bouchon;
    this.params = params;
    const n = (this.n = bouchon.nbPoints);
    this.x = Float64Array.from(bouchon.x0);
    this.y = Float64Array.from(bouchon.y0);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    // Le tour est collé à la paroi (sauf aux points d'entrée) ; l'intérieur est collé au fond.
    this.colleAuFond = Uint8Array.from(bouchon.bord, (b) => (b ? 0 : 1));
    this.sante = Float64Array.from(this.colleAuFond);
    this.colleAuTour = Uint8Array.from(bouchon.bord, (b, i) => (b && !bouchon.entree[i] ? 1 : 0));
    this.santeTour = Float64Array.from(this.colleAuTour);
    this.sorti = new Uint8Array(n);
    this.morceau = new Int32Array(n);
    this.lienOk = new Uint8Array(bouchon.lienA.length).fill(1);
    this.lienPinceFaible = new Uint8Array(bouchon.lienA.length);
    this.lienTenu = new Uint8Array(bouchon.lienA.length);
    this.calculerMorceaux();
  }

  // ---------- Commandes du doigt ----------

  /** Le doigt touche l'écran. */
  poserDoigt(): void {
    this.outil.doigt = true;
    this.outil.tempsImmobile = 0;
    this.outil.essaiFait = false;
  }

  /** Le doigt quitte l'écran : la pince s'ouvre. */
  leverDoigt(): void {
    this.outil.doigt = false;
    this.outil.vitesse = 0;
    this.ouvrirPince();
  }

  /** Change d'outil (la pince lâche ce qu'elle tenait). */
  choisirOutil(type: TypeOutil): void {
    if (this.outil.type === type) return;
    this.ouvrirPince();
    this.outil.type = type;
    this.outil.tempsImmobile = 0;
    this.outil.essaiFait = false;
  }

  /** Là où le pouce veut emmener l'outil. */
  definirCible(cx: number, cy: number): void {
    const r = Math.hypot(cx, cy);
    const k = r > LIMITE_CIBLE ? LIMITE_CIBLE / r : 1;
    this.outil.cibleX = cx * k;
    this.outil.cibleY = cy * k;
  }

  /** Place l'outil d'un coup (sert au doigt simulé des tests). */
  placerOutil(cx: number, cy: number): void {
    this.definirCible(cx, cy);
    if (!this.outil.ferme) {
      this.outil.x = this.outil.cibleX;
      this.outil.y = this.outil.cibleY;
    }
  }

  // ---------- Temps ----------

  /** Fait avancer le temps réel écoulé (découpé en pas fixes). */
  avancer(dt: number): void {
    this.reste += Math.min(dt, 0.1);
    while (this.reste >= PAS) {
      this.reste -= PAS;
      this.pas();
    }
  }

  /** Vide et renvoie les événements survenus depuis le dernier appel. */
  prendreEvenements(): Evenement[] {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  /**
   * Tension actuelle de la matière, de 0 (rien) à 1 (un lien va casser) :
   * l'allongement du lien le plus tendu rapporté à sa limite. Servira à la vibration et au son (lot 3).
   */
  tension(): number {
    let max = 0;
    for (let l = 0; l < this.b.lienA.length; l++) {
      if (this.lienOk[l]) max = Math.max(max, this.allongement(l) / this.limite(l));
    }
    return Math.min(1, max);
  }

  /** Allongement relatif d'un lien (0 = au repos, 0.5 = +50 %). */
  allongement(l: number): number {
    const b = this.b;
    const a = b.lienA[l];
    const c = b.lienB[l];
    return Math.hypot(this.x[c] - this.x[a], this.y[c] - this.y[a]) / b.lienLongueur[l] - 1;
  }

  /** Allongement au-delà duquel le lien casse. */
  limite(l: number): number {
    const p = this.params;
    let limite = p.elasticite * this.b.lienSolidite[l];
    if (this.lienPinceFaible[l]) limite *= p.pinceFragilite;
    if (this.lienTenu[l]) limite *= p.pinceRenfort;
    return limite;
  }

  /** Nombre de points encore dans la vue. */
  pointsRestants(): number {
    let k = 0;
    for (let i = 0; i < this.n; i++) if (!this.sorti[i]) k++;
    return k;
  }

  /** Nombre de points du tour encore collés à la paroi. */
  tourRestant(): number {
    return this.colleAuTour.reduce((a, c) => a + c, 0);
  }

  /** Vrai si le point ne tient plus à rien (ni fond, ni tour). */
  estLibre(i: number): boolean {
    return !this.colleAuFond[i] && !this.colleAuTour[i];
  }

  private pas(): void {
    const p = this.params;
    this.temps += PAS;
    this.mettreAJourOutil();

    const S = Math.max(1, Math.round(p.sousPas));
    const h = PAS / S;
    const freinage = Math.exp(-p.amortissement * h);
    const { x, y, vx, vy, px, py, sorti } = this;
    const b = this.b;
    const nl = b.lienA.length;
    const h2 = h * h;
    // Souplesse de chaque élément (inverse de la raideur), pour le calcul XPBD.
    const kFond = 1 / (1 + 1 / Math.max(1e-6, p.colleRaideur) / h2);
    const kTour = 1 / (1 + 1 / Math.max(1e-6, p.colleRaideur * RAIDEUR_TOUR) / h2);
    const prise = this.outil.ferme ? this.outil.prise : [];
    const kPrise = prise.length > 0 ? 1 / (1 + prise.length / Math.max(1e-6, p.forceGeste) / h2) : 0;

    for (let s = 0; s < S; s++) {
      for (let i = 0; i < this.n; i++) {
        if (sorti[i]) continue;
        px[i] = x[i];
        py[i] = y[i];
        let ax = 0;
        let ay = 0;
        if (b.bord[i] && this.estLibre(i) && p.repli > 0) {
          // Repli en sac : le bord décollé se rétracte vers le centre, jusqu'à une certaine distance.
          const r = Math.hypot(x[i], y[i]) || 1;
          const retrait = Math.hypot(b.x0[i], b.y0[i]) - r;
          const reste = Math.max(0, 1 - retrait / Math.max(1e-4, p.repliDistance));
          ax = (-x[i] / r) * p.repli * reste;
          ay = (-y[i] / r) * p.repli * reste;
        }
        x[i] += (vx[i] * freinage + ax * h) * h;
        y[i] += (vy[i] * freinage + ay * h) * h;
      }
      // Les liens de la cire.
      for (let l = 0; l < nl; l++) {
        if (!this.lienOk[l]) continue;
        const a = b.lienA[l];
        const c = b.lienB[l];
        const dx = x[c] - x[a];
        const dy = y[c] - y[a];
        const d = Math.hypot(dx, dy);
        if (d < 1e-9) continue;
        const L0 = b.lienLongueur[l];
        const souplesse = (p.elasticite * L0) / Math.max(1e-6, p.solidite) / h2;
        let corr = (d - L0) / (2 + souplesse);
        if (d < L0) corr *= COMPRESSION;
        const ux = dx / d;
        const uy = dy / d;
        x[a] += ux * corr;
        y[a] += uy * corr;
        x[c] -= ux * corr;
        y[c] -= uy * corr;
      }
      // La colle : chaque point collé (au fond ou à la paroi) est tiré vers sa place d'origine.
      for (let i = 0; i < this.n; i++) {
        if (sorti[i]) continue;
        const k = this.colleAuTour[i] ? kTour : this.colleAuFond[i] ? kFond : 0;
        if (k === 0) continue;
        x[i] += (b.x0[i] - x[i]) * k;
        y[i] += (b.y0[i] - y[i]) * k;
      }
      // La pince tire les points saisis vers le pouce.
      for (let q = 0; q < prise.length; q++) {
        const i = prise[q];
        x[i] += (this.outil.cibleX + this.outil.decalX[q] - x[i]) * kPrise;
        y[i] += (this.outil.cibleY + this.outil.decalY[q] - y[i]) * kPrise;
      }
      for (let i = 0; i < this.n; i++) {
        if (sorti[i]) continue;
        vx[i] = (x[i] - px[i]) / h;
        vy[i] = (y[i] - py[i]) / h;
      }
    }

    this.casserLiens();
    this.userColle();
    if (!this.morceauxAJour) this.calculerMorceaux();
    this.sortirMorceauTenu();
    if (this.outil.ferme) this.placerOutilSurPrise();
  }

  // ---------- Règles ----------

  /** Pic de force : un lien trop allongé casse. */
  private casserLiens(): void {
    const b = this.b;
    for (let l = 0; l < b.lienA.length; l++) {
      if (!this.lienOk[l]) continue;
      if (this.allongement(l) > this.limite(l)) {
        this.lienOk[l] = 0;
        this.morceauxAJour = false;
        this.evenements.push({ type: 'lienCasse', lien: l });
      }
    }
  }

  /** Tension tenue dans le temps : la colle du fond s'use, puis lâche. */
  private userColle(): void {
    const p = this.params;
    const b = this.b;
    const changement = this.changementDeDirection();
    const acceleration = 1 + p.bonusDirection * changement;
    // La colle du fond ne lâche que quand on tire (pince fermée sur de la matière décollée).
    if (!this.outil.ferme || this.outil.faible) return;
    for (let i = 0; i < this.n; i++) {
      if (!this.colleAuFond[i] || this.sorti[i]) continue;
      const d = Math.hypot(this.x[i] - b.x0[i], this.y[i] - b.y0[i]);
      const tension = (p.colleRaideur * d) / Math.max(1e-6, p.solidite); // part de la solidité
      const montee = Math.max(0, Math.min(1, (tension - p.colleSeuil) / Math.max(1e-6, p.colleSeuil)));
      if (montee > 0) {
        this.sante[i] -= (PAS * montee * acceleration) / (Math.max(0.01, p.colleDuree) * b.colle[i]);
      }
      if (this.sante[i] <= 0) this.decoller(i);
    }
  }

  /**
   * Écart entre la direction dans laquelle la pince tire maintenant et celle des instants
   * précédents : 0 (même direction) à 1 (90° ou plus). Tirer vers le haut puis vers le bas
   * fait lâcher la colle du fond plus vite.
   */
  private changementDeDirection(): number {
    const o = this.outil;
    if (!o.ferme) {
      this.dirX = 0;
      this.dirY = 0;
      return 0;
    }
    const tx = o.cibleX - o.x;
    const ty = o.cibleY - o.y;
    const t = Math.hypot(tx, ty);
    if (t < 1e-4) return 0;
    const ux = tx / t;
    const uy = ty / t;
    const connu = this.dirX !== 0 || this.dirY !== 0;
    const produit = ux * this.dirX + uy * this.dirY;
    const changement = !connu ? 0 : produit < 0 ? 1 : Math.abs(ux * this.dirY - uy * this.dirX);
    const oubli = connu ? 1 - Math.exp(-PAS / MEMOIRE_DIRECTION) : 1;
    const nx = this.dirX + (ux - this.dirX) * oubli;
    const ny = this.dirY + (uy - this.dirY) * oubli;
    const nn = Math.hypot(nx, ny) || 1;
    this.dirX = nx / nn;
    this.dirY = ny / nn;
    return changement;
  }

  private decoller(i: number): void {
    if (!this.colleAuFond[i]) return;
    this.colleAuFond[i] = 0;
    this.sante[i] = 0;
    this.morceauxAJour = false;
    this.evenements.push({ type: 'pointDecolle', point: i });
  }

  private decollerTour(i: number): void {
    if (!this.colleAuTour[i]) return;
    this.colleAuTour[i] = 0;
    this.santeTour[i] = 0;
    this.morceauxAJour = false;
    this.evenements.push({ type: 'tourDecolle', point: i });
  }

  // ---------- Les outils ----------

  private mettreAJourOutil(): void {
    const o = this.outil;
    const p = this.params;
    if (!o.doigt) {
      o.vitesse = 0;
      return;
    }
    const avantX = o.x;
    const avantY = o.y;
    if (!o.ferme) {
      const k = p.inertieOutil <= 0 ? 1 : 1 - Math.exp(-PAS / p.inertieOutil);
      o.x += (o.cibleX - o.x) * k;
      o.y += (o.cibleY - o.y) * k;
    }
    const deplacement = Math.hypot(o.x - avantX, o.y - avantY);
    o.vitesse = deplacement / PAS;

    if (o.type === 'pince' && !o.ferme) {
      if (o.vitesse < p.pinceImmobile) {
        o.tempsImmobile += PAS;
      } else {
        o.tempsImmobile = 0;
        o.essaiFait = false;
      }
      if (!o.essaiFait && o.tempsImmobile >= p.pincePause) {
        o.essaiFait = true;
        this.fermerPince();
      }
    }
    if (o.type === 'spatule' && o.vitesse >= p.spatuleMouvement) this.spatuler(deplacement);
    this.verifierParoi();
  }

  /**
   * La spatule se glisse entre la cire et la peau. Chaque petit mouvement use la colle du tour
   * des points sous sa pointe, mais seulement à côté d'un bord déjà libre.
   */
  private spatuler(deplacement: number): void {
    const o = this.outil;
    const p = this.params;
    for (let i = 0; i < this.n; i++) {
      if (!this.colleAuTour[i] || this.sorti[i]) continue;
      if (Math.hypot(this.x[i] - o.x, this.y[i] - o.y) > p.spatuleRayon) continue;
      if (!this.aCoteDUnBordLibre(i)) continue;
      this.santeTour[i] -= deplacement / Math.max(1e-4, p.tourColle);
      if (this.santeTour[i] <= 0) this.decollerTour(i);
    }
  }

  /** Vrai si un voisin du point sur le tour est déjà décollé, ou si la cire est déchirée à côté. */
  aCoteDUnBordLibre(i: number): boolean {
    const b = this.b;
    for (let k = b.voisinsDebut[i]; k < b.voisinsDebut[i + 1]; k++) {
      const v = b.voisins[k];
      if (!this.lienOk[b.voisinsLien[k]]) return true; // déchirure : un bord libre
      if (b.bord[v] && !this.colleAuTour[v]) return true;
    }
    return false;
  }

  /**
   * La paroi sensible : la spatule qui déborde de la matière vers la peau,
   * ou la pince ouverte qui racle la paroi du conduit.
   */
  private verifierParoi(): void {
    const o = this.outil;
    const p = this.params;
    if (o.vitesse < p.spatuleMouvement || this.temps - this.dernierContact < ENTRE_DEUX_CONTACTS) return;
    let touche = false;
    if (o.type === 'spatule') {
      touche = this.distanceALaMatiere(o.x, o.y) > p.margeParoi;
    } else if (!o.ferme) {
      touche = Math.hypot(o.x, o.y) > RAYON_PAROI;
    }
    if (touche) {
      this.dernierContact = this.temps;
      this.evenements.push({ type: 'paroiTouchee', x: o.x, y: o.y });
    }
  }

  /** Distance entre un endroit et le point de matière le plus proche (encore dans la vue). */
  distanceALaMatiere(x: number, y: number): number {
    let min = Infinity;
    for (let i = 0; i < this.n; i++) {
      if (this.sorti[i]) continue;
      min = Math.min(min, Math.hypot(this.x[i] - x, this.y[i] - y));
    }
    return min;
  }

  triangleIntact(t: number): boolean {
    const tl = this.b.triangleLiens;
    return this.lienOk[tl[3 * t]] === 1 && this.lienOk[tl[3 * t + 1]] === 1 && this.lienOk[tl[3 * t + 2]] === 1;
  }

  private fermerPince(): void {
    const o = this.outil;
    const p = this.params;
    const proches: number[] = [];
    let plusProche = -1;
    let dMin = Infinity;
    for (let i = 0; i < this.n; i++) {
      if (this.sorti[i]) continue;
      const d = Math.hypot(this.x[i] - o.x, this.y[i] - o.y);
      if (d <= p.pinceRayon) proches.push(i);
      if (d < dMin) {
        dMin = d;
        plusProche = i;
      }
    }
    if (proches.length === 0) return; // rien sous la pince : elle reste ouverte

    // La pince ne tient bien que ce qui est décollé.
    const libres = proches.filter((i) => this.estLibre(i));
    const franche = libres.length > 0;
    o.prise = franche ? libres : [plusProche];
    o.faible = !franche;
    const b = this.b;
    if (!franche) {
      // Sur une zone encore collée, la pince n'attrape que la surface : une miette.
      this.decoller(plusProche);
      this.decollerTour(plusProche);
      for (let k = b.voisinsDebut[plusProche]; k < b.voisinsDebut[plusProche + 1]; k++) {
        this.lienPinceFaible[b.voisinsLien[k]] = 1;
      }
    } else {
      // Prise franche : la cire pliée dans la pince (et juste autour) résiste mieux que le reste.
      const rayon = p.pinceRayon * p.pinceZonePliee;
      for (let l = 0; l < b.lienA.length; l++) {
        const mx = (this.x[b.lienA[l]] + this.x[b.lienB[l]]) / 2;
        const my = (this.y[b.lienA[l]] + this.y[b.lienB[l]]) / 2;
        if (Math.hypot(mx - o.x, my - o.y) <= rayon) this.lienTenu[l] = 1;
      }
    }
    o.cibleX = o.x;
    o.cibleY = o.y;
    o.decalX = o.prise.map((i) => this.x[i] - o.x);
    o.decalY = o.prise.map((i) => this.y[i] - o.y);
    o.ferme = true;
    this.evenements.push({ type: 'pinceFermee', faible: o.faible });
  }

  private ouvrirPince(): void {
    const o = this.outil;
    if (!o.ferme) return;
    o.ferme = false;
    o.faible = false;
    o.prise = [];
    o.decalX = [];
    o.decalY = [];
    this.lienPinceFaible.fill(0);
    this.lienTenu.fill(0);
    // L'outil reste là où était la prise ; le pouce repart de là.
    o.cibleX = o.x;
    o.cibleY = o.y;
    this.evenements.push({ type: 'pinceOuverte' });
  }

  /** Quand la pince tient quelque chose, la pointe est au milieu de la prise (elle « traîne »). */
  private placerOutilSurPrise(): void {
    const o = this.outil;
    if (o.prise.length === 0) return;
    let sx = 0;
    let sy = 0;
    for (const i of o.prise) {
      sx += this.x[i];
      sy += this.y[i];
    }
    o.x = sx / o.prise.length;
    o.y = sy / o.prise.length;
  }

  // ---------- Morceaux ----------

  /** Regroupe les points reliés entre eux en morceaux, et note lesquels tiennent encore. */
  calculerMorceaux(): void {
    const parent = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) parent[i] = i;
    const racine = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const b = this.b;
    for (let l = 0; l < b.lienA.length; l++) {
      if (!this.lienOk[l]) continue;
      const ra = racine(b.lienA[l]);
      const rb = racine(b.lienB[l]);
      if (ra !== rb) parent[ra] = rb;
    }
    const numero = new Map<number, number>();
    for (let i = 0; i < this.n; i++) {
      if (this.sorti[i]) {
        this.morceau[i] = -1;
        continue;
      }
      const r = racine(i);
      if (!numero.has(r)) numero.set(r, numero.size);
      this.morceau[i] = numero.get(r)!;
    }
    this.morceauColle = new Uint8Array(numero.size);
    this.morceauTaille = new Int32Array(numero.size);
    for (let i = 0; i < this.n; i++) {
      const m = this.morceau[i];
      if (m < 0) continue;
      this.morceauTaille[m]++;
      if (!this.estLibre(i)) this.morceauColle[m] = 1;
    }
    this.morceauxAJour = true;
  }

  /**
   * Un morceau qui ne tient plus à rien, tenu par la pince : quand la pince l'emmène
   * au-delà du bord de la vue ronde, il sort en entier (il « suit » la pince).
   */
  private sortirMorceauTenu(): void {
    const o = this.outil;
    if (!o.ferme || o.prise.length === 0) return;
    const vus = new Set<number>();
    for (const i of o.prise) {
      const m = this.morceau[i];
      if (m < 0 || vus.has(m)) continue;
      vus.add(m);
      if (this.morceauColle[m]) continue;
      // Où la pince tient ce morceau.
      let sx = 0;
      let sy = 0;
      let q = 0;
      for (const j of o.prise) {
        if (this.morceau[j] !== m) continue;
        sx += this.x[j];
        sy += this.y[j];
        q++;
      }
      if (Math.hypot(sx / q, sy / q) <= BORD_DE_LA_VUE) continue;
      let k = 0;
      for (let j = 0; j < this.n; j++) {
        if (this.morceau[j] !== m) continue;
        this.sorti[j] = 1;
        k++;
      }
      const part = k / this.n;
      this.morceauxSortis.push(part);
      this.evenements.push({ type: 'morceauSorti', points: k, part });
      this.morceauxAJour = false;
    }
    if (vus.size > 0) {
      const garder = o.prise.map((i, q) => ({ i, q })).filter(({ i }) => !this.sorti[i]);
      o.decalX = garder.map(({ q }) => o.decalX[q]);
      o.decalY = garder.map(({ q }) => o.decalY[q]);
      o.prise = garder.map(({ i }) => i);
      if (o.prise.length === 0) this.ouvrirPince();
    }
    if (!this.morceauxAJour) this.calculerMorceaux();
  }
}
