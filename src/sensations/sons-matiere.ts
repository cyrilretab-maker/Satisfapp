// Les sons de la matière, fabriqués par le code (Web Audio), sans enregistrement.
// Frottement doux (continu), craquements, claquement de rupture, décollement de la grande sortie,
// tics de spatule et clic de pince. Remplaçables plus tard par des enregistrements.

export class SonsMatiere {
  private ctx: AudioContext | null = null;
  private bruit: AudioBuffer | null = null;
  private gainFrottement: GainNode | null = null;
  private filtreFrottement: BiquadFilterNode | null = null;

  /** À appeler lors d'un geste (le navigateur exige un toucher avant de jouer du son). */
  reveiller(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // Une seconde de bruit blanc, base de tous les sons de matière.
      const n = this.ctx.sampleRate;
      this.bruit = this.ctx.createBuffer(1, n, n);
      const donnees = this.bruit.getChannelData(0);
      let graine = 12345;
      for (let i = 0; i < n; i++) {
        graine = (graine * 1103515245 + 12345) & 0x7fffffff;
        donnees[i] = (graine / 0x7fffffff) * 2 - 1;
      }
      // Le frottement : du bruit en boucle, filtré, dont on règle le volume en continu.
      const source = this.ctx.createBufferSource();
      source.buffer = this.bruit;
      source.loop = true;
      this.filtreFrottement = this.ctx.createBiquadFilter();
      this.filtreFrottement.type = 'bandpass';
      this.filtreFrottement.frequency.value = 900;
      this.filtreFrottement.Q.value = 0.7;
      this.gainFrottement = this.ctx.createGain();
      this.gainFrottement.gain.value = 0;
      source.connect(this.filtreFrottement).connect(this.gainFrottement).connect(this.ctx.destination);
      source.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Volume du frottement (0..1), lissé pour ne pas claquer. */
  frottement(niveau: number): void {
    if (!this.ctx || !this.gainFrottement) return;
    this.gainFrottement.gain.setTargetAtTime(Math.max(0, niveau) * 0.25, this.ctx.currentTime, 0.05);
  }

  /** Un craquement : court, plus aigu et plus sec quand la tension monte (intensité 0..1). */
  craquement(intensite: number, volume: number): void {
    this.salve({
      duree: 0.012 + 0.02 * (1 - intensite),
      frequence: 1200 + 3800 * intensite + Math.random() * 400,
      q: 2 + 4 * intensite,
      volume: volume * (0.35 + 0.65 * intensite),
    });
  }

  /** Le claquement sec de la rupture. */
  claquement(volume: number): void {
    this.salve({ duree: 0.06, frequence: 2200, q: 0.8, volume: volume * 1.2 });
    this.salve({ duree: 0.12, frequence: 300, q: 1, volume: volume * 0.8, decalage: 0.005 });
  }

  /** Le décollement ample de la grande sortie : un glissement qui descend, puis le silence. */
  decollement(volume: number): void {
    if (!this.ctx || !this.bruit || volume <= 0) return;
    const t = this.ctx.currentTime + 0.01;
    const source = this.ctx.createBufferSource();
    source.buffer = this.bruit;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.Q.value = 1.5;
    filtre.frequency.setValueAtTime(2500, t);
    filtre.frequency.exponentialRampToValueAtTime(250, t + 0.7);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * 0.9, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    source.connect(filtre).connect(gain).connect(this.ctx.destination);
    source.start(t, 0.2);
    source.stop(t + 0.85);
  }

  /** Le petit tic d'un point de colle qui lâche sous la spatule (ou le clic de la pince). */
  tic(volume: number, aigu = 1): void {
    this.salve({ duree: 0.008, frequence: 3500 * aigu, q: 6, volume: volume * 0.8 });
  }

  /** Coupe net tout ce qui dure (frottement). */
  couper(): void {
    if (!this.ctx || !this.gainFrottement) return;
    this.gainFrottement.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gainFrottement.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  /** Une courte salve de bruit filtré : la brique de base des sons secs. */
  private salve(o: { duree: number; frequence: number; q: number; volume: number; decalage?: number }): void {
    if (!this.ctx || !this.bruit || o.volume <= 0) return;
    const t = this.ctx.currentTime + 0.005 + (o.decalage ?? 0);
    const source = this.ctx.createBufferSource();
    source.buffer = this.bruit;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = o.frequence;
    filtre.Q.value = o.q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(1, o.volume), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duree);
    source.connect(filtre).connect(gain).connect(this.ctx.destination);
    source.start(t, Math.random() * 0.8);
    source.stop(t + o.duree + 0.02);
  }
}
