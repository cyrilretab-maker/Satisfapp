import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { CLE_STOCKAGE, Reglages, type FichierReglages, type StockageSimple } from '../src/reglages/reglages';

const fichier = defauts as FichierReglages;

function fauxTelephone(depart: Record<string, string> = {}): StockageSimple & { donnees: Record<string, string> } {
  const donnees = { ...depart };
  return {
    donnees,
    getItem: (c) => donnees[c] ?? null,
    setItem: (c, v) => {
      donnees[c] = v;
    },
    removeItem: (c) => {
      delete donnees[c];
    },
  };
}

describe('Fichier de données des réglages', () => {
  it('chaque réglage a un identifiant unique et un groupe connu', () => {
    const ids = fichier.reglages.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groupes = new Set(fichier.groupes.map((g) => g.id));
    for (const r of fichier.reglages) expect(groupes.has(r.groupe)).toBe(true);
  });

  it('chaque curseur a une valeur de départ dans ses bornes', () => {
    for (const r of fichier.reglages) {
      if (r.type !== 'curseur') continue;
      expect(r.min).toBeLessThan(r.max);
      expect(r.valeur).toBeGreaterThanOrEqual(r.min);
      expect(r.valeur).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('Magasin des réglages', () => {
  it('part des valeurs du fichier de données', () => {
    const r = new Reglages(fichier, fauxTelephone());
    expect(r.nombre('rythmes.lent.pause')).toBe(650);
    expect(r.oui('general.vibration')).toBe(true);
  });

  it('garde un réglage modifié sur le téléphone et le retrouve à la réouverture', () => {
    const tel = fauxTelephone();
    new Reglages(fichier, tel).ecrire('rythmes.lent.pause', 900);
    expect(new Reglages(fichier, tel).nombre('rythmes.lent.pause')).toBe(900);
  });

  it("n'enregistre que les valeurs différentes du départ", () => {
    const tel = fauxTelephone();
    const r = new Reglages(fichier, tel);
    r.ecrire('general.volume', 30);
    expect(JSON.parse(tel.donnees[CLE_STOCKAGE])).toEqual({ 'general.volume': 30 });
  });

  it('ramène une valeur hors bornes dans les bornes', () => {
    const r = new Reglages(fichier, fauxTelephone());
    r.ecrire('rythmes.rapide.pause', 99999);
    expect(r.nombre('rythmes.rapide.pause')).toBe(1500);
    r.ecrire('rythmes.rapide.pause', -5);
    expect(r.nombre('rythmes.rapide.pause')).toBe(20);
  });

  it('ignore un stockage abîmé ou des réglages disparus', () => {
    expect(() => new Reglages(fichier, fauxTelephone({ [CLE_STOCKAGE]: '{pas du json' }))).not.toThrow();
    const r = new Reglages(
      fichier,
      fauxTelephone({ [CLE_STOCKAGE]: JSON.stringify({ 'ancien.reglage': 3, 'general.son': 'oui' }) }),
    );
    expect(r.oui('general.son')).toBe(true);
  });

  it('prévient quand un réglage change, pour un effet immédiat', () => {
    const r = new Reglages(fichier, fauxTelephone());
    const vus: string[] = [];
    r.surChangement((id) => vus.push(id));
    r.ecrire('general.son', false);
    expect(vus).toEqual(['general.son']);
  });

  it('remet toutes les valeurs de départ', () => {
    const tel = fauxTelephone();
    const r = new Reglages(fichier, tel);
    r.ecrire('general.volume', 10);
    r.toutRemettre();
    expect(r.nombre('general.volume')).toBe(60);
    expect(tel.donnees[CLE_STOCKAGE]).toBeUndefined();
  });

  it('fonctionne même sans stockage disponible', () => {
    const r = new Reglages(fichier, null);
    r.ecrire('general.volume', 10);
    expect(r.nombre('general.volume')).toBe(10);
  });
});
