// Les sons de l'eau, fabriqués par le code (Web Audio), comme ceux de la matière.
// Continus : ruissellement (débit), frottement du doigt sur l'inox sec (très doux), clapotis.
// Ponctuels : « plop » de deux flaques qui se rejoignent, coulée du toucher final, dernière goutte.

export class SonsEau {
  private ctx: AudioContext | null = null;
  private bruit: AudioBuffer | null = null;
  private continus: { gain: GainNode; filtre: BiquadFilterNode }[] = [];

  reveiller(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const n = this.ctx.sampleRate * 2;
      this.bruit = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const donnees = this.bruit.getChannelData(0);
      let graine = 777;
      let brun = 0;
      for (let i = 0; i < n; i++) {
        graine = (graine * 1103515245 + 12345) & 0x7fffffff;
        const blanc = (graine / 0x7fffffff) * 2 - 1;
        brun = (brun + 0.02 * blanc) / 1.02; // un bruit plus doux, plus « eau »
        donnees[i] = blanc * 0.4 + brun * 6;
      }
      // Trois sons continus : ruissellement, frottement sur l'inox, clapotis.
      const regler: [BiquadFilterType, number, number][] = [
        ['bandpass', 1100, 0.6],
        ['highpass', 3500, 0.7],
        ['lowpass', 700, 1.2],
      ];
      for (const [type, f, q] of regler) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.bruit;
        source.loop = true;
        const filtre = this.ctx.createBiquadFilter();
        filtre.type = type;
        filtre.frequency.value = f;
        filtre.Q.value = q;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        source.connect(filtre).connect(gain).connect(this.ctx.destination);
        source.start(0, Math.random());
        this.continus.push({ gain, filtre });
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private niveau(k: number, v: number, lissage = 0.08): void {
    if (!this.ctx || !this.continus[k]) return;
    this.continus[k].gain.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, lissage);
  }

  /** Le ruissellement (0..1) : plus de débit, plus fort et un peu plus aigu. */
  ruissellement(niveau: number): void {
    this.niveau(0, niveau * 0.35);
    if (this.ctx && this.continus[0]) this.continus[0].filtre.frequency.setTargetAtTime(900 + 900 * niveau, this.ctx.currentTime, 0.2);
  }

  /** Le doigt qui glisse sur l'inox sec (0..1). */
  frottement(niveau: number): void {
    this.niveau(1, niveau * 0.12);
  }

  /** Le clapotis du doigt dans l'eau (0..1). */
  clapotis(niveau: number): void {
    this.niveau(2, niveau * 0.4, 0.05);
  }

  /** « Plop » : deux flaques se rejoignent. */
  plop(volume: number): void {
    if (!this.ctx || volume <= 0) return;
    const t = this.ctx.currentTime + 0.005;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.07);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * 0.5, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** La coulée du toucher final : un ruissellement ample qui s'éteint, puis une dernière goutte. */
  coulee(volume: number): void {
    if (!this.ctx || !this.bruit || volume <= 0) return;
    const t = this.ctx.currentTime + 0.01;
    const source = this.ctx.createBufferSource();
    source.buffer = this.bruit;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.Q.value = 0.5;
    filtre.frequency.setValueAtTime(1600, t);
    filtre.frequency.exponentialRampToValueAtTime(500, t + 2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * 0.6, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    source.connect(filtre).connect(gain).connect(this.ctx.destination);
    source.start(t, 0.3);
    source.stop(t + 2.3);
    this.goutte(volume, 2.5);
  }

  /** Une goutte qui tombe (la dernière). */
  goutte(volume: number, apres = 0): void {
    if (!this.ctx || volume <= 0) return;
    const t = this.ctx.currentTime + 0.005 + apres;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.04);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Coupe net tous les sons continus (le silence avant la goutte qui gonfle, la fin). */
  couper(): void {
    if (!this.ctx) return;
    for (const c of this.continus) {
      c.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      c.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }
}
