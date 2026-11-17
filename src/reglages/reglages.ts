// Le magasin des réglages.
// Les valeurs de départ viennent du fichier de données defauts.json, jamais du code.
// Seules les valeurs modifiées par Cyril sont enregistrées sur le téléphone.

interface BaseReglage {
  id: string;
  groupe: string;
  libelle: string;
  /** Vrai si le réglage ne change que le prochain bouchon (forme, taille...). */
  prochainBouchon?: boolean;
}

export type DefinitionReglage =
  | (BaseReglage & {
      type: 'curseur';
      min: number;
      max: number;
      pas: number;
      unite?: string;
      valeur: number;
    })
  | (BaseReglage & {
      type: 'interrupteur';
      valeur: boolean;
    })
  | (BaseReglage & {
      type: 'choix';
      options: { valeur: string; libelle: string }[];
      valeur: string;
    });

export interface GroupeReglages {
  id: string;
  titre: string;
}

export interface FichierReglages {
  version: number;
  groupes: GroupeReglages[];
  reglages: DefinitionReglage[];
}

/** Le strict nécessaire de localStorage, pour pouvoir le simuler dans les tests. */
export interface StockageSimple {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

export type ValeurReglage = number | boolean | string;

export const CLE_STOCKAGE = 'satisfapp.reglages.v1';

export class Reglages {
  private readonly definitions = new Map<string, DefinitionReglage>();
  private readonly valeurs = new Map<string, ValeurReglage>();
  private readonly ecouteurs = new Set<(id: string) => void>();

  constructor(
    readonly fichier: FichierReglages,
    private readonly stockage: StockageSimple | null,
  ) {
    for (const def of fichier.reglages) {
      this.definitions.set(def.id, def);
      this.valeurs.set(def.id, def.valeur);
    }
    this.charger();
  }

  liste(): DefinitionReglage[] {
    return [...this.definitions.values()];
  }

  nombre(id: string): number {
    const v = this.lireBrut(id);
    if (typeof v !== 'number') throw new Error(`Le réglage « ${id} » n'est pas un nombre`);
    return v;
  }

  texte(id: string): string {
    const v = this.lireBrut(id);
    if (typeof v !== 'string') throw new Error(`Le réglage « ${id} » n'est pas un choix`);
    return v;
  }

  oui(id: string): boolean {
    const v = this.lireBrut(id);
    if (typeof v !== 'boolean') throw new Error(`Le réglage « ${id} » n'est pas un interrupteur`);
    return v;
  }

  ecrire(id: string, valeur: ValeurReglage): void {
    const def = this.definitions.get(id);
    if (!def) throw new Error(`Réglage inconnu : « ${id} »`);
    const propre = nettoyer(def, valeur);
    if (propre === undefined) return;
    this.valeurs.set(id, propre);
    this.enregistrer();
    this.ecouteurs.forEach((f) => f(id));
  }

  /** Les valeurs qui diffèrent du fichier de données (ce que Cyril a réglé). */
  modifies(): Record<string, ValeurReglage> {
    const m: Record<string, ValeurReglage> = {};
    for (const def of this.definitions.values()) {
      const v = this.valeurs.get(def.id);
      if (v !== undefined && v !== def.valeur) m[def.id] = v;
    }
    return m;
  }

  /** Repart des valeurs du fichier, puis applique celles-ci (une variante enregistrée). */
  appliquer(valeurs: Record<string, unknown>): void {
    for (const def of this.definitions.values()) this.valeurs.set(def.id, def.valeur);
    for (const [id, v] of Object.entries(valeurs)) {
      const def = this.definitions.get(id);
      if (!def) continue;
      const propre = nettoyer(def, v);
      if (propre !== undefined) this.valeurs.set(id, propre);
    }
    this.enregistrer();
    this.definitions.forEach((_, id) => this.ecouteurs.forEach((f) => f(id)));
  }

  /** Remet toutes les valeurs du fichier de données. */
  toutRemettre(): void {
    for (const def of this.definitions.values()) this.valeurs.set(def.id, def.valeur);
    this.stockage?.removeItem(CLE_STOCKAGE);
    this.definitions.forEach((_, id) => this.ecouteurs.forEach((f) => f(id)));
  }

  surChangement(f: (id: string) => void): () => void {
    this.ecouteurs.add(f);
    return () => this.ecouteurs.delete(f);
  }

  private lireBrut(id: string): ValeurReglage {
    const v = this.valeurs.get(id);
    if (v === undefined) throw new Error(`Réglage inconnu : « ${id} »`);
    return v;
  }

  private charger(): void {
    if (!this.stockage) return;
    let enregistres: unknown;
    try {
      const texte = this.stockage.getItem(CLE_STOCKAGE);
      if (!texte) return;
      enregistres = JSON.parse(texte);
    } catch {
      return; // stockage illisible : on garde les valeurs du fichier
    }
    if (typeof enregistres !== 'object' || enregistres === null) return;
    for (const [id, valeur] of Object.entries(enregistres)) {
      const def = this.definitions.get(id);
      if (!def) continue; // réglage disparu depuis : on l'oublie
      const propre = nettoyer(def, valeur);
      if (propre !== undefined) this.valeurs.set(id, propre);
    }
  }

  private enregistrer(): void {
    if (!this.stockage) return;
    const modifies: Record<string, ValeurReglage> = {};
    for (const def of this.definitions.values()) {
      const v = this.valeurs.get(def.id);
      if (v !== undefined && v !== def.valeur) modifies[def.id] = v;
    }
    try {
      this.stockage.setItem(CLE_STOCKAGE, JSON.stringify(modifies));
    } catch {
      // stockage plein ou bloqué : le réglage reste actif pour cette session
    }
  }
}

/** Ramène une valeur dans les bornes du réglage, ou renvoie undefined si elle est inutilisable. */
function nettoyer(def: DefinitionReglage, valeur: unknown): ValeurReglage | undefined {
  if (def.type === 'interrupteur') return typeof valeur === 'boolean' ? valeur : undefined;
  if (def.type === 'choix') {
    return typeof valeur === 'string' && def.options.some((o) => o.valeur === valeur) ? valeur : undefined;
  }
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return undefined;
  return Math.min(def.max, Math.max(def.min, valeur));
}
