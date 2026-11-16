// Le panneau : faire défiler la liste ne doit jamais changer un réglage.
import { describe, expect, it } from 'vitest';
import { intention, valeurApresGlisse } from '../src/reglages/glisse';

describe('Le doigt sur un curseur du panneau', () => {
  it('un geste vertical fait défiler, il ne règle rien', () => {
    expect(intention(3, 40)).toBe('defiler');
    expect(intention(15, 20)).toBe('defiler'); // en biais : on préfère défiler
    expect(intention(-12, -30)).toBe('defiler');
  });

  it('un petit tremblement ne décide rien', () => {
    expect(intention(4, 3)).toBe('attendre');
  });

  it('seul un geste nettement horizontal règle', () => {
    expect(intention(20, 4)).toBe('glisser');
    expect(intention(-25, 8)).toBe('glisser');
  });

  it('la valeur part de là où elle était, sans sauter sous le doigt', () => {
    expect(valeurApresGlisse(50, 0, 300, 0, 100, 1)).toBe(50);
    expect(valeurApresGlisse(50, 30, 300, 0, 100, 1)).toBe(60);
    expect(valeurApresGlisse(50, -600, 300, 0, 100, 1)).toBe(0);
    expect(valeurApresGlisse(0.1, 15, 300, 0, 1, 0.05)).toBe(0.15);
  });
});
