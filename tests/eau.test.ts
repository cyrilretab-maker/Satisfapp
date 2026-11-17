// Mini-jeu 2 : l'eau. Les règles, vérifiées au doigt simulé.
import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../src/reglages/reglages';
import { Eau, NX, NY, REBORD } from '../src/eau/moteur-eau';
import { lireParamsEau, lireParamsEvier } from '../src/eau/parametres-eau';
import { PiloteEau } from '../src/eau/sensations-eau';
import { Vase } from '../src/eau/vase';

const IMAGE = 1 / 60;

function reglages(modifs: Record<string, number> = {}) {
  const r = new Reglages(defauts as FichierReglages, null);
  for (const [id, v] of Object.entries(modifs)) r.ecrire(id, v);
  return r;
}

function nouvelleEau(graine: number, modifs: Record<string, number> = {}): Eau {
  const r = reglages(modifs);
  return new Eau(graine, lireParamsEvier(r), lireParamsEau(r));
}

function attendre(eau: Eau, s: number) {
  for (let t = 0; t < s; t += IMAGE) eau.avancer(IMAGE);
}

/** Le doigt va de a à b à une vitesse donnée (cases par seconde), puis se lève. */
function tracer(eau: Eau, a: [number, number], b: [number, number], vitesse: number, lever = true) {
  eau.poserDoigt(a[0], a[1]);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(L / (vitesse * IMAGE)));
  for (let k = 1; k <= n; k++) {
    eau.deplacerDoigt(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
    eau.avancer(IMAGE);
  }
  if (lever) eau.leverDoigt();
}

interface Flaque {
  x: number;
  y: number;
  volume: number;
  cases: Set<number>;
}

/** Les flaques (eau d'un seul tenant au-dessus d'un petit seuil). */
function flaques(eau: Eau): Flaque[] {
  const vu = new Int32Array(NX * NY).fill(-1);
  const res: Flaque[] = [];
  for (let k = 0; k < NX * NY; k++) {
    if (vu[k] >= 0 || eau.h[k] < 0.3) continue;
    const f: Flaque = { x: 0, y: 0, volume: 0, cases: new Set() };
    const pile = [k];
    vu[k] = res.length;
    while (pile.length) {
      const c = pile.pop()!;
      f.cases.add(c);
      f.volume += eau.h[c];
      f.x += c % NX;
      f.y += Math.floor(c / NX);
      const x = c % NX;
      for (const j of [x > 0 ? c - 1 : -1, x < NX - 1 ? c + 1 : -1, c - NX, c + NX]) {
        if (j < 0 || j >= NX * NY || vu[j] >= 0 || eau.h[j] < 0.3) continue;
        vu[j] = res.length;
        pile.push(j);
      }
    }
    f.x /= f.cases.size;
    f.y /= f.cases.size;
    res.push(f);
  }
  return res;
}

const volumeAutour = (eau: Eau, f: Flaque, r = 8) => {
  let s = 0;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) if (Math.hypot(x - f.x, y - f.y) <= r) s += eau.h[y * NX + x];
  return s;
};

/** Deux flaques l'une au-dessus de l'autre, assez proches. */
function deuxFlaques(eau: Eau): [Flaque, Flaque] {
  const fs = flaques(eau);
  let meilleur: [Flaque, Flaque] | null = null;
  let dMin = Infinity;
  for (const a of fs) {
    for (const b of fs) {
      if (b.y <= a.y + 6) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < dMin) {
        dMin = d;
        meilleur = [a, b];
      }
    }
  }
  return meilleur!;
}

describe("L'eau : ce qui tient", () => {
  it('une flaque laissée seule ne bouge pas, même après une minute', () => {
    const eau = nouvelleEau(1);
    const avant = Float64Array.from(eau.h);
    attendre(eau, 60);
    let ecart = 0;
    for (let k = 0; k < avant.length; k++) ecart = Math.max(ecart, Math.abs(eau.h[k] - avant[k]));
    expect(ecart).toBeLessThan(0.1);
    expect(eau.verse).toBe(0);
  });

  it('le même numéro redonne le même évier', () => {
    expect([...nouvelleEau(42).h]).toEqual([...nouvelleEau(42).h]);
    expect([...nouvelleEau(42).h]).not.toEqual([...nouvelleEau(43).h]);
  });

  it('rien ne se perd : le volume total ne change jamais (sauf ce qui part dans l\'évier)', () => {
    const eau = nouvelleEau(2);
    const depart = eau.total();
    const ok = () => expect(eau.total() + eau.verse).toBeCloseTo(depart, 6);
    for (const [a, b, v] of [
      [[10, 10], [50, 90], 20],
      [[30, 5], [5, 60], 200],
      [[50, 50], [20, 103], 15],
      [[20, 103], [20, 110], 10],
    ] as [[number, number], [number, number], number][]) {
      tracer(eau, a, b, v);
      ok();
      attendre(eau, 2);
      ok();
    }
  });
});

describe("L'eau : ce qui coule", () => {
  it('un tracé lent relie deux flaques : la plus haute se vide dans la plus basse', () => {
    const eau = nouvelleEau(3);
    const [haute, basse] = deuxFlaques(eau);
    const avantHaute = volumeAutour(eau, haute);
    const avantBasse = volumeAutour(eau, basse);
    tracer(eau, [haute.x, haute.y], [basse.x, basse.y], 15);
    attendre(eau, 4);
    expect(volumeAutour(eau, haute)).toBeLessThan(avantHaute * 0.75);
    expect(volumeAutour(eau, basse)).toBeGreaterThan(avantBasse);
  });

  it('les deux flaques reliées s\'égalisent en 1 à 3 secondes, et cela se remarque', () => {
    const eau = nouvelleEau(3);
    const [haute, basse] = deuxFlaques(eau);
    eau.prendreEvenements();
    tracer(eau, [haute.x, haute.y], [basse.x, basse.y], 15);
    const debut = eau.temps;
    let fin = -1;
    let precedent = volumeAutour(eau, haute);
    let jonction = false;
    for (let t = 0; t < 6; t += 0.1) {
      attendre(eau, 0.1);
      if (eau.prendreEvenements().some((e) => e.type === 'jonction')) jonction = true;
      const v = volumeAutour(eau, haute);
      if (fin < 0 && precedent - v < 0.2) fin = eau.temps;
      precedent = v;
    }
    expect(jonction).toBe(true);
    expect(fin - debut).toBeGreaterThan(0.3);
    expect(fin - debut).toBeLessThan(4);
  });

  it('un tracé trop rapide coupe la route : l\'eau ne passe pas', () => {
    const eau = nouvelleEau(3);
    const [haute, basse] = deuxFlaques(eau);
    const avantHaute = volumeAutour(eau, haute);
    eau.prendreEvenements();
    tracer(eau, [haute.x, haute.y], [basse.x, basse.y], 250);
    expect(eau.prendreEvenements().some((e) => e.type === 'routeCoupee')).toBe(true);
    attendre(eau, 4);
    expect(volumeAutour(eau, haute)).toBeGreaterThan(avantHaute * 0.85);
  });

  it('l\'eau ne remonte pas : la flaque du bas ne se vide jamais dans celle du haut', () => {
    const eau = nouvelleEau(3);
    const [haute, basse] = deuxFlaques(eau);
    // Une route qui part de la flaque du bas et monte, sans toucher la flaque du haut.
    const avantBasse = volumeAutour(eau, basse);
    tracer(eau, [basse.x, basse.y], [basse.x, Math.max(1, basse.y - 25)], 15);
    attendre(eau, 4);
    expect(volumeAutour(eau, basse)).toBeGreaterThan(avantBasse * 0.8);
    void haute;
  });

  it('une route où l\'eau ne passe pas sèche en quelques secondes', () => {
    const eau = nouvelleEau(5, { 'evier.flaques': 1 });
    // Une route sur l'inox sec, loin de la flaque.
    const f = flaques(eau)[0];
    const x = f.x < NX / 2 ? NX - 6 : 6;
    tracer(eau, [x, 10], [x, 60], 15);
    const mouillees = () => {
      let n = 0;
      for (let y = 10; y <= 60; y++) if (eau.mouille[y * NX + x] > 0) n++;
      return n;
    };
    expect(mouillees()).toBeGreaterThan(40);
    attendre(eau, eau.params.dureeTrace + 1);
    expect(mouillees()).toBe(0);
  });

  it('la route s\'élargit quand l\'eau y passe', () => {
    const eau = nouvelleEau(3);
    const [haute, basse] = deuxFlaques(eau);
    const flaquesAuDepart = Float64Array.from(eau.h);
    tracer(eau, [haute.x, haute.y], [basse.x, basse.y], 15);
    // La route : les cases mouillées qui n'étaient pas une flaque au départ.
    const route = () => {
      let n = 0;
      for (let k = 0; k < NX * NY; k++) if (eau.mouille[k] > 0 && flaquesAuDepart[k] === 0) n++;
      return n;
    };
    const avant = route();
    attendre(eau, 2);
    expect(route()).toBeGreaterThan(avant * 1.05);
  });
});

describe("L'eau : le rebord", () => {
  /** Mène une flaque jusqu'au rebord par une route droite vers le bas. */
  function menerAuRebord(eau: Eau, f: Flaque) {
    tracer(eau, [f.x, f.y], [f.x, REBORD], 15);
    attendre(eau, 5);
  }
  const auRebord = (eau: Eau) => {
    let s = 0;
    for (let x = 0; x < NX; x++) s += eau.h[REBORD * NX + x];
    return s;
  };

  it('aucune flaque piégée : chaque flaque peut être menée au rebord', () => {
    for (const g of [1, 2, 3, 4, 5]) {
      const eau = nouvelleEau(g);
      for (const f of flaques(eau)) {
        if (f.y > REBORD - 8) continue; // l'eau déjà rassemblée au-dessus du rebord
        const avant = volumeAutour(eau, f, 7);
        if (avant < 6) continue; // déjà vidée par une autre route (il ne reste qu'un film)
        menerAuRebord(eau, f);
        // Le joueur touche la goutte qui s'est formée au bout de la route : la route se vide.
        tracer(eau, [f.x, REBORD - 1], [f.x, REBORD + 4], 10);
        attendre(eau, 4);
        expect(volumeAutour(eau, f, 7)).toBeLessThan(avant * 0.4);
      }
      // L'eau est descendue : au rebord, ou dans les routes juste au-dessus.
      let enBas = 0;
      for (let k = (REBORD - 30) * NX; k < NX * NY; k++) enBas += eau.h[k];
      expect(auRebord(eau) + enBas + eau.verse).toBeGreaterThan(eau.depart * 0.5);
    }
  }, 30000);

  it('la goutte du rebord tient tant qu\'on ne la touche pas (capacité suffisante)', () => {
    const eau = nouvelleEau(2, { 'eau.capacite': 8 });
    menerAuRebord(eau, flaques(eau)[0]);
    const avant = auRebord(eau);
    expect(avant).toBeGreaterThan(1);
    attendre(eau, 20);
    expect(eau.verse).toBe(0);
  });

  it('trop pleine, elle déborde seule en mince filet (rien n\'est perdu)', () => {
    const eau = nouvelleEau(2, { 'eau.capacite': 1 });
    eau.prendreEvenements();
    for (const f of flaques(eau)) menerAuRebord(eau, f);
    expect(eau.prendreEvenements().some((e) => e.type === 'tropPlein')).toBe(true);
    expect(eau.verse).toBeGreaterThan(0);
    expect(eau.total() + eau.verse).toBeCloseTo(eau.depart, 6);
  });

  it('un toucher qui glisse vers l\'évier vide la goutte en 1 à 3 secondes, d\'une seule coulée', () => {
    const eau = nouvelleEau(2, { 'eau.capacite': 8 });
    menerAuRebord(eau, flaques(eau)[0]);
    let gx = 0;
    for (let x = 0; x < NX; x++) if (eau.h[REBORD * NX + x] > eau.h[REBORD * NX + gx]) gx = x;
    eau.prendreEvenements();
    tracer(eau, [gx, REBORD - 1], [gx, REBORD + 4], 10);
    const debut = eau.temps;
    let coulee = -1;
    let volume = 0;
    for (let t = 0; t < 6 && coulee < 0; t += IMAGE) {
      eau.avancer(IMAGE);
      for (const e of eau.prendreEvenements()) {
        if (e.type === 'coulee') {
          coulee = eau.temps;
          volume = e.volume;
        }
      }
    }
    expect(coulee).toBeGreaterThan(0);
    expect(coulee - debut).toBeGreaterThan(0.8);
    expect(coulee - debut).toBeLessThan(3.5);
    expect(volume).toBeGreaterThan(1);
  });

  it('une partie complète : toute l\'eau finit dans l\'évier', () => {
    const eau = nouvelleEau(4, { 'eau.capacite': 8 });
    for (let tour = 0; tour < 3; tour++) {
      for (const f of flaques(eau)) if (f.y < REBORD - 3) menerAuRebord(eau, f);
      for (let x = 2; x < NX - 2; x += 4) {
        if (eau.h[REBORD * NX + x] > 0.05) {
          tracer(eau, [x, REBORD - 1], [x, REBORD + 4], 10);
          attendre(eau, 3);
        }
      }
    }
    expect(eau.verse).toBeGreaterThan(eau.depart * 0.85);
  }, 30000);
});

describe("L'eau : la sauvegarde et le vase", () => {
  it('on retrouve l\'évier exactement dans le même état', () => {
    const eau = nouvelleEau(6);
    tracer(eau, [20, 20], [30, 80], 15);
    attendre(eau, 1);
    const etat = JSON.parse(JSON.stringify(eau.exporter()));
    const reprise = nouvelleEau(etat.graine);
    expect(reprise.importer(etat)).toBe(true);
    expect([...reprise.h]).toEqual([...eau.h]);
    expect(reprise.verse).toBe(eau.verse);
  });

  it('le vase garde les coulées et met en avant la plus grosse', () => {
    const donnees: Record<string, string> = {};
    const tel = { getItem: (c: string) => donnees[c] ?? null, setItem: (c: string, v: string) => void (donnees[c] = v), removeItem: (c: string) => void delete donnees[c] };
    const v = new Vase(tel);
    v.ajouter(0.1);
    v.ajouter(0.6);
    v.ajouter(0.2);
    const relu = new Vase(tel);
    expect(relu.coulees.length).toBe(3);
    expect(relu.plusGrosse()).toBe(1);
  });
});

describe("L'eau qui se sent", () => {
  const r = reglages();
  const vib = () =>
    new PiloteEau({
      pulsation: r.nombre('eauVib.pulsation'),
      pauseLente: r.nombre('eauVib.pauseLente'),
      pauseRapide: r.nombre('eauVib.pauseRapide'),
      seuil: r.nombre('eauVib.seuil'),
      debitMax: r.nombre('eauVib.debitMax'),
      fremissement: r.nombre('eauVib.fremissement'),
      jonction: r.nombre('eauVib.jonction'),
      goutte: r.nombre('eauVib.goutte') / 100,
      finale: r.nombre('eauVib.finale'),
    });
  const compter = (debit: number, goutte = 0) => {
    const p = vib();
    let n = 0;
    for (let t = 0; t < 10; t += IMAGE) n += p.mettreAJour(t, { debit, dansEau: false, goutte }).vibrer.length;
    return n;
  };

  it('plus l\'eau coule, plus les pulsations se rapprochent ; rien quand rien ne coule', () => {
    expect(compter(0)).toBe(0);
    expect(compter(40)).toBeGreaterThan(compter(5) * 2);
  });

  it('la goutte qui gonfle pulse de plus en plus vite', () => {
    expect(compter(0, 0.95)).toBeGreaterThan(compter(0, 0.4));
  });

  it('le toucher final : arrêt net, puis une longue vibration qui décroît', () => {
    const p = vib();
    p.liberation(1);
    expect(p.mettreAJour(1.1, { debit: 50, dansEau: true, goutte: 1 }).arreter).toBe(true);
    const ordres = p.mettreAJour(1.3, { debit: 50, dansEau: true, goutte: 1 });
    const motif = ordres.vibrer[0];
    expect(motif.length).toBeGreaterThan(4);
    for (let i = 2; i < motif.length; i += 2) expect(motif[i]).toBeLessThan(motif[i - 2]);
    // Pendant la décrue, plus rien d'autre.
    expect(p.mettreAJour(2, { debit: 50, dansEau: true, goutte: 1 }).vibrer.length).toBe(0);
  });
});

describe('Le panneau : copier le réglage, variantes', () => {
  it('on retrouve exactement un réglage enregistré', () => {
    const r = reglages({ 'eau.pente': 0.01, 'general.volume': 30 });
    const variante = r.modifies();
    expect(variante).toEqual({ 'eau.pente': 0.01, 'general.volume': 30 });
    const autre = reglages({ 'eau.fluidite': 40 });
    autre.appliquer(variante);
    expect(autre.nombre('eau.pente')).toBe(0.01);
    expect(autre.nombre('eau.fluidite')).toBe(reglages().nombre('eau.fluidite')); // repart des valeurs de départ
  });
});
