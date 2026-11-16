// Le dessin réaliste, fait par la puce graphique du téléphone (WebGL 2).
//
// Comment c'est fait, en trois temps à chaque image :
//  1. « Champ de cire » : chaque point de matière et chaque triangle intact sont peints, en blanc
//     sur noir, dans une image cachée. On y range aussi, pour chaque pixel, ce qu'il reste de colle,
//     le blanchiment, et la position « au repos » de la cire (pour que son grain bouge avec elle).
//  2. Ce champ est flouté : les facettes disparaissent, il reste une masse lisse et ronde.
//  3. L'image finale : la peau du conduit (plis, grain, pores, éclat humide), puis la cire posée
//     dessus, avec un relief tiré du champ flouté, la lumière de l'endoscope et des reflets mouillés.
// Les outils, le bord de la vue et la zone du pouce restent dessinés par-dessus en Canvas 2D.

import type { Simulation } from '../matiere/moteur';
import { fabriquerBruit, TAILLE_BRUIT } from './bruit';
import type { Peau } from './peau';

const ETENDUE = 1.05; // le champ couvre la vue de -ETENDUE à +ETENDUE (unités de vue)
const DUREE_ECLAIRCISSEMENT = 2.5;
const FOND_PAGE = [0x14 / 255, 0x10 / 255, 0x10 / 255];

export interface OptionsRendu {
  cx: number; // centre de la vue (pixels CSS, sursaut compris)
  cy: number;
  rayon: number; // pixels CSS
  ratio: number; // pixels réels par pixel CSS
  temps: number;
  dureeRougeur: number;
  blanchiment: number; // 0..1
  douceur: number; // flou du contour, en part de l'écart entre deux points
  relief: number;
  grain: number;
  brillance: number;
  humide: number; // finesse des reflets (exposant)
  translucide: number; // 0..1
  peauGrain: number;
  peauPlis: number;
  ombre: number;
  qualite: number; // 0..1 : finesse du champ de cire par rapport à l'écran
}

// ---------- Les programmes de la puce graphique ----------

const VS_MATIERE = `#version 300 es
in vec2 aPos;
in vec4 aDon;
uniform float uTaille;
out vec4 vDon;
void main() {
  vDon = aDon;
  gl_Position = vec4(aPos / ${ETENDUE.toFixed(3)}, 0.0, 1.0);
  gl_PointSize = uTaille;
}`;

const FS_MATIERE = `#version 300 es
precision highp float;
in vec4 vDon;
uniform bool uPoint;
uniform float uRayonUv; // rayon d'un disque, en unités de « place au repos »
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
void main() {
  vec2 uv = vDon.zw;
  if (uPoint) {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    if (dot(d, d) > 1.0) discard;
    // Le grain continue à l'intérieur du disque (sinon chaque disque a un grain uniforme : escaliers).
    uv += vec2(d.x, -d.y) * uRayonUv;
  }
  o0 = vec4(1.0, vDon.x, vDon.y, 1.0);
  o1 = vec4(uv, 0.0, 1.0);
}`;

const VS_PLEIN = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Le flou : PRISES échantillons de chaque côté, espacés d'au plus ~1,5 pixel du champ (sinon : escaliers).
const PRISES = 8;
const POIDS = (() => {
  const s = PRISES / 2;
  const w = Array.from({ length: PRISES + 1 }, (_, i) => Math.exp(-(i * i) / (2 * s * s)));
  const total = w[0] + 2 * w.slice(1).reduce((x, y) => x + y, 0);
  return new Float32Array(w.map((x) => x / total));
})();

const FS_FLOU = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uDir;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
uniform float uW[${PRISES + 1}];
void main() {
  vec4 a = texture(uA, vUv) * uW[0];
  vec4 b = texture(uB, vUv) * uW[0];
  for (int i = 1; i <= ${PRISES}; i++) {
    vec2 o = uDir * float(i);
    a += (texture(uA, vUv + o) + texture(uA, vUv - o)) * uW[i];
    b += (texture(uB, vUv + o) + texture(uB, vUv - o)) * uW[i];
  }
  o0 = a;
  o1 = b;
}`;

const VS_MARQUES = `#version 300 es
in vec2 aPos;
in vec2 aCol;
in float aTaille;
out vec2 vCol;
void main() {
  vCol = aCol;
  gl_Position = vec4(aPos / ${ETENDUE.toFixed(3)}, 0.0, 1.0);
  gl_PointSize = aTaille;
}`;

const FS_MARQUES = `#version 300 es
precision highp float;
in vec2 vCol;
out vec4 sortie;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  sortie = vec4(vCol * exp(-3.0 * r2) * (1.0 - r2), 0.0, 1.0);
}`;

const VS_SCENE = `#version 300 es
in vec2 aPos;
uniform vec2 uCentre;
uniform float uRayon;
uniform vec2 uEcran;
out vec2 vP;
void main() {
  vP = aPos;
  vec2 px = uCentre + aPos * uRayon;
  gl_Position = vec4(px.x / uEcran.x * 2.0 - 1.0, 1.0 - px.y / uEcran.y * 2.0, 0.0, 1.0);
}`;

// Convention : vP est en unités de vue, y vers le bas (comme le moteur).
// dFdy de la puce compte vers le haut : on change son signe pour rester « y vers le bas ».
const FS_SCENE = `#version 300 es
precision highp float;
in vec2 vP;
uniform sampler2D uC0;
uniform sampler2D uC1;
uniform sampler2D uMarques;
uniform sampler2D uBruit;
uniform vec2 uTexel;
uniform float uSeuil;
uniform float uRelief;
uniform float uGrain;
uniform float uBrillance;
uniform float uHumide;
uniform float uTranslucide;
uniform float uPeauGrain;
uniform float uPeauPlis;
uniform float uOmbre;
uniform float uRayonPx;
out vec4 sortie;

// Les bosses de la cire, lues dans sa place « au repos » (elles bougent avec elle).
float bosses(vec2 uv) {
  return (texture(uBruit, uv * 1.3).r - 0.5) * 0.7 + (texture(uBruit, uv * 0.9 + 0.5).g - 0.5) * 0.3;
}

const vec3 LUMIERE = vec3(-0.28, -0.38, 0.88);

vec2 pente(float h) { return vec2(dFdx(h), -dFdy(h)); }

void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  vec2 q = vP / ${ETENDUE.toFixed(3)} * 0.5 + 0.5;
  vec3 L = normalize(LUMIERE);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

  // --- La peau du conduit : un tunnel, sombre au fond, rose sur la paroi.
  float ang = atan(vP.y, vP.x);
  vec2 tPli = vec2(ang / 6.2831853 * 14.0, -log(r + 0.06) * 0.7);
  vec4 nPli = texture(uBruit, tPli);
  vec4 nFin = texture(uBruit, vP * 0.8 + 0.37);
  vec3 fond = vec3(0.10, 0.05, 0.04);
  vec3 milieu = vec3(0.55, 0.30, 0.25);
  vec3 paroi = vec3(0.92, 0.63, 0.53);
  vec3 cp = mix(fond, milieu, smoothstep(0.0, 0.55, r));
  cp = mix(cp, paroi, smoothstep(0.45, 0.95, r));
  float plis = (nPli.r - 0.5) * uPeauPlis * smoothstep(0.03, 0.45, r);
  float grainPeau = (nFin.g - 0.5) * uPeauGrain;
  cp *= 1.0 + plis * 0.8 + grainPeau * 0.35;
  float pore = texture(uBruit, vP * 1.6 + 0.11).a;
  cp *= 1.0 - pore * 0.1 * uPeauGrain;
  float hs = plis + grainPeau * 0.5 - pore * 0.08 * uPeauGrain;
  vec3 Np = normalize(vec3(-pente(hs) * 10.0, 1.0));
  vec4 mk = texture(uMarques, q);
  cp *= 1.0 + clamp(mk.g, 0.0, 1.0) * 0.4 * smoothstep(0.1, 0.6, r);
  cp = mix(cp, vec3(0.80, 0.18, 0.22), clamp(mk.r, 0.0, 1.0) * 0.55);
  float ombre = texture(uC0, q + vec2(0.010, 0.016)).r;
  cp *= 1.0 - uOmbre * 0.55 * clamp(ombre, 0.0, 1.0);
  float murs = smoothstep(0.3, 0.9, r);
  vec3 couleur = cp * (0.78 + 0.3 * max(dot(Np, L), 0.0))
    + vec3(1.0, 0.92, 0.88) * pow(max(dot(Np, H), 0.0), 45.0) * uBrillance * 0.45 * murs;

  // --- La cire.
  vec4 c0 = texture(uC0, q);
  float cov = c0.r;
  if (cov > 0.01) {
    float w = max(fwidth(cov) * 0.9, 0.004);
    float m = smoothstep(uSeuil - w, uSeuil + w, cov);
    float lache = clamp(c0.g / max(cov, 1e-3), 0.0, 1.0);
    float blanc = clamp(c0.b / max(cov, 1e-3), 0.0, 1.0);
    vec4 c1 = texture(uC1, q);
    vec2 uv = c1.rg / max(c1.a, 1e-3);
    float bosse = bosses(uv);
    // Pente des bosses calculée dans la cire elle-même (pas par pixel : ça scintillait).
    const float E = 0.004;
    vec2 pb = vec2(bosses(uv + vec2(E, 0.0)) - bosses(uv - vec2(E, 0.0)), bosses(uv + vec2(0.0, E)) - bosses(uv - vec2(0.0, E))) / (2.0 * E);
    pb *= 0.5 / uRayonPx; // unités de cire → pixels
    pb *= smoothstep(0.4, 0.9, c1.a); // au ras du bord, la place au repos est imprécise : pas de bosses
    // Le relief : la pente du champ lissé (bords arrondis) et les bosses du grain.
    vec2 g = vec2(
      texture(uC0, q + vec2(uTexel.x, 0.0)).r - texture(uC0, q - vec2(uTexel.x, 0.0)).r,
      texture(uC0, q + vec2(0.0, uTexel.y)).r - texture(uC0, q - vec2(0.0, uTexel.y)).r
    );
    vec3 N = normalize(vec3(-g * 3.0 * uRelief - pb * 40.0 * uGrain, 1.0));
    float epais = smoothstep(uSeuil, min(1.0, uSeuil + 0.4), cov);
    vec3 ambre = vec3(0.58, 0.34, 0.08);
    vec3 miel = vec3(0.90, 0.66, 0.28);
    vec3 cc = mix(ambre, miel, lache);
    cc *= 1.0 + bosse * 0.35 * uGrain;
    cc = mix(cc, vec3(0.98, 0.93, 0.80), blanc * 0.85);
    // Là où la cire est fine, la lumière la traverse : plus chaude, plus claire, la peau transparaît.
    cc = mix(cc * 1.25 + vec3(0.06, 0.03, 0.0), cc, epais);
    float diffus = 0.5 + 0.65 * max(dot(N, L), 0.0);
    float reflet = pow(max(dot(N, H), 0.0), uHumide) * uBrillance;
    vec3 cire = cc * diffus + vec3(1.0, 0.96, 0.86) * reflet;
    float alpha = m * mix(1.0 - uTranslucide, 1.0, epais);
    couleur = mix(couleur, cire, alpha);
  }

  // La lumière de l'endoscope faiblit vers les bords.
  couleur *= 1.12 - 0.42 * r * r;
  sortie = vec4(couleur, 1.0);
}`;

// ---------- Outils ----------

function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

function programme(gl: WebGL2RenderingContext, vs: string, fs: string, attributs: string[]): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compiler(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compiler(gl, gl.FRAGMENT_SHADER, fs));
  attributs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

interface Cible {
  fb: WebGLFramebuffer;
  tex: WebGLTexture[];
}

// ---------- Le rendu ----------

export class RenduGL {
  /** Vrai si la puce graphique a lâché (rare) : la page repasse alors au dessin simple. */
  perdu = false;
  private readonly gl: WebGL2RenderingContext;
  private readonly pMatiere: WebGLProgram;
  private readonly pFlou: WebGLProgram;
  private readonly pMarques: WebGLProgram;
  private readonly pScene: WebGLProgram;
  private readonly uni = new Map<string, WebGLUniformLocation | null>();
  private readonly bufMatiere: WebGLBuffer;
  private readonly bufIndices: WebGLBuffer;
  private readonly bufMarques: WebGLBuffer;
  private readonly bufCarre: WebGLBuffer;
  private readonly vaoMatiere: WebGLVertexArrayObject;
  private readonly vaoMarques: WebGLVertexArrayObject;
  private readonly vaoCarre: WebGLVertexArrayObject;
  private readonly texBruit: WebGLTexture;
  private readonly formatFlottant: boolean;
  private champA: Cible | null = null;
  private champB: Cible | null = null;
  private marques: Cible | null = null;
  private tailleChamp = 0;
  private donnees = new Float32Array(0);
  private indices = new Uint16Array(0);
  private marquesDon = new Float32Array(0);

  /** Crée le rendu, ou renvoie null si le téléphone ne sait pas faire (on garde alors le dessin simple). */
  static creer(toile: HTMLCanvasElement): RenduGL | null {
    try {
      const gl = toile.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
      if (!gl) return null;
      return new RenduGL(toile, gl);
    } catch (e) {
      console.warn('WebGL indisponible, dessin simple :', e);
      return null;
    }
  }

  private constructor(toile: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    toile.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.perdu = true;
    });
    this.formatFlottant = !!gl.getExtension('EXT_color_buffer_float');
    this.pMatiere = programme(gl, VS_MATIERE, FS_MATIERE, ['aPos', 'aDon']);
    this.pFlou = programme(gl, VS_PLEIN, FS_FLOU, ['aPos']);
    this.pMarques = programme(gl, VS_MARQUES, FS_MARQUES, ['aPos', 'aCol', 'aTaille']);
    this.pScene = programme(gl, VS_SCENE, FS_SCENE, ['aPos']);

    this.bufMatiere = gl.createBuffer()!;
    this.bufIndices = gl.createBuffer()!;
    this.vaoMatiere = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoMatiere);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufMatiere);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIndices);

    this.bufMarques = gl.createBuffer()!;
    this.vaoMarques = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoMarques);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufMarques);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);

    this.bufCarre = gl.createBuffer()!;
    this.vaoCarre = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoCarre);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCarre);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);

    this.texBruit = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texBruit);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TAILLE_BRUIT, TAILLE_BRUIT, 0, gl.RGBA, gl.UNSIGNED_BYTE, fabriquerBruit());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  private u(p: WebGLProgram, nom: string): WebGLUniformLocation | null {
    const cle = `${this.nomProgramme(p)}:${nom}`;
    if (!this.uni.has(cle)) this.uni.set(cle, this.gl.getUniformLocation(p, nom));
    return this.uni.get(cle)!;
  }

  private nomProgramme(p: WebGLProgram): string {
    return p === this.pMatiere ? 'm' : p === this.pFlou ? 'f' : p === this.pMarques ? 'k' : 's';
  }

  private creerCible(taille: number, nb: number, flottant: boolean): Cible {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const tex: WebGLTexture[] = [];
    for (let k = 0; k < nb; k++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (flottant) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, taille, taille, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, taille, taille, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0);
      tex.push(t);
    }
    gl.drawBuffers(tex.map((_, k) => gl.COLOR_ATTACHMENT0 + k));
    return { fb, tex };
  }

  private libererCible(c: Cible | null): void {
    if (!c) return;
    this.gl.deleteFramebuffer(c.fb);
    c.tex.forEach((t) => this.gl.deleteTexture(t));
  }

  private preparerChamp(taille: number): void {
    if (taille === this.tailleChamp) return;
    [this.champA, this.champB, this.marques].forEach((c) => this.libererCible(c));
    this.tailleChamp = taille;
    this.champA = this.creerCible(taille, 2, this.formatFlottant);
    this.champB = this.creerCible(taille, 2, this.formatFlottant);
    this.marques = this.creerCible(taille, 1, false);
  }

  /** Dessine la peau et la cire (le reste vient par-dessus, en 2D). */
  dessiner(sim: Simulation, peau: Peau, o: OptionsRendu): void {
    const gl = this.gl;
    if (this.perdu || gl.isContextLost()) {
      this.perdu = true;
      return;
    }
    const W = gl.drawingBufferWidth;
    const Hh = gl.drawingBufferHeight;
    // Le champ n'a pas besoin d'être plus fin que le flou ne le permet (12 pixels de champ pour le rayon du flou).
    const flouVue = Math.max(1e-3, o.douceur * sim.b.params.finesse);
    const N = Math.max(96, Math.min(1024, Math.round(2 * ETENDUE * o.rayon * o.ratio * o.qualite), Math.round((12 / flouVue) * 2 * ETENDUE)));
    this.preparerChamp(N);
    const pxParUnite = N / (2 * ETENDUE);
    const b = sim.b;
    const n = sim.n;
    const a = sim.fractionDePas();

    // 1. Les données de chaque point : position (lissée entre deux pas), colle, blanchiment, place au repos.
    if (this.donnees.length !== n * 6) this.donnees = new Float32Array(n * 6);
    const etir = new Float32Array(n);
    const seuilBlanc = o.blanchiment;
    for (let l = 0; l < b.lienA.length; l++) {
      if (!sim.lienOk[l]) continue;
      const e = sim.allongement(l) / sim.limite(l);
      const k = (e - seuilBlanc) / Math.max(1e-6, 1 - seuilBlanc);
      if (k <= 0) continue;
      if (k > etir[b.lienA[l]]) etir[b.lienA[l]] = k;
      if (k > etir[b.lienB[l]]) etir[b.lienB[l]] = k;
    }
    const d = this.donnees;
    for (let i = 0; i < n; i++) {
      const k = 6 * i;
      if (sim.sorti[i]) {
        d[k] = 9;
        d[k + 1] = 9;
        continue;
      }
      d[k] = sim.xAvant[i] + (sim.x[i] - sim.xAvant[i]) * a;
      d[k + 1] = sim.yAvant[i] + (sim.y[i] - sim.yAvant[i]) * a;
      const tient = sim.colleAuTour[i] ? sim.santeTour[i] : sim.colleAuFond[i] ? sim.sante[i] : 0;
      d[k + 2] = 1 - tient;
      d[k + 3] = Math.min(1, etir[i]);
      d[k + 4] = b.x0[i] * 0.5 + 0.5;
      d[k + 5] = b.y0[i] * 0.5 + 0.5;
    }
    const nt = b.triangles.length / 3;
    if (this.indices.length < nt * 3) this.indices = new Uint16Array(nt * 3);
    let ni = 0;
    for (let t = 0; t < nt; t++) {
      const p = b.triangles[3 * t];
      const q = b.triangles[3 * t + 1];
      const r = b.triangles[3 * t + 2];
      if (sim.sorti[p] || sim.sorti[q] || sim.sorti[r] || !sim.triangleIntact(t)) continue;
      this.indices[ni++] = p;
      this.indices[ni++] = q;
      this.indices[ni++] = r;
    }

    // 2. Le champ de cire, net.
    const A = this.champA!;
    const B = this.champB!;
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
    gl.viewport(0, 0, N, N);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pMatiere);
    gl.bindVertexArray(this.vaoMatiere);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufMatiere);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIndices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices.subarray(0, ni), gl.DYNAMIC_DRAW);
    gl.uniform1f(this.u(this.pMatiere, 'uTaille'), Math.max(2, b.params.finesse * 1.1 * pxParUnite));
    gl.uniform1i(this.u(this.pMatiere, 'uPoint'), 1);
    gl.uniform1f(this.u(this.pMatiere, 'uRayonUv'), b.params.finesse * 0.55 * 0.5);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.uniform1i(this.u(this.pMatiere, 'uPoint'), 0);
    if (ni > 0) gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_SHORT, 0);

    // 3. Le flou : deux passes (horizontale puis verticale), A → B → A.
    const pas = Math.max(0.25, (flouVue * pxParUnite) / PRISES) / N;
    gl.useProgram(this.pFlou);
    gl.bindVertexArray(this.vaoCarre);
    gl.uniform1i(this.u(this.pFlou, 'uA'), 0);
    gl.uniform1i(this.u(this.pFlou, 'uB'), 1);
    gl.uniform1fv(this.u(this.pFlou, 'uW'), POIDS);
    const passe = (de: Cible, vers: Cible, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, vers.fb);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, de.tex[0]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, de.tex[1]);
      gl.uniform2f(this.u(this.pFlou, 'uDir'), dx, dy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    passe(A, B, pas, 0);
    passe(B, A, 0, pas);

    // 4. Les marques sur la peau : là où elle a été dégagée (elle s'éclaircit), et les rougeurs.
    const M = this.marques!;
    const marques: number[] = [];
    const tache = Math.max(2, b.params.finesse * 3.2 * pxParUnite);
    for (let i = 0; i < n; i++) {
      if (!sim.sorti[i]) continue;
      const k = Math.min(1, (sim.temps - sim.sortiA[i]) / DUREE_ECLAIRCISSEMENT);
      marques.push(b.x0[i], b.y0[i], 0, 0.45 * k, tache);
    }
    for (const r of peau.rougeurs) {
      const f = peau.intensite(r, o.temps, o.dureeRougeur);
      if (f > 0) marques.push(r.x, r.y, f, 0, 0.24 * pxParUnite);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, M.fb);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (marques.length > 0) {
      if (this.marquesDon.length < marques.length) this.marquesDon = new Float32Array(marques.length * 2);
      this.marquesDon.set(marques);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.pMarques);
      gl.bindVertexArray(this.vaoMarques);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufMarques);
      gl.bufferData(gl.ARRAY_BUFFER, this.marquesDon.subarray(0, marques.length), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, marques.length / 5);
      gl.disable(gl.BLEND);
    }

    // 5. L'image finale.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, Hh);
    gl.clearColor(FOND_PAGE[0], FOND_PAGE[1], FOND_PAGE[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const s = this.pScene;
    gl.useProgram(s);
    gl.bindVertexArray(this.vaoCarre);
    const textures: [string, WebGLTexture][] = [
      ['uC0', A.tex[0]],
      ['uC1', A.tex[1]],
      ['uMarques', M.tex[0]],
      ['uBruit', this.texBruit],
    ];
    textures.forEach(([nom, t], k) => {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(this.u(s, nom), k);
    });
    gl.uniform2f(this.u(s, 'uCentre'), o.cx * o.ratio, o.cy * o.ratio);
    gl.uniform1f(this.u(s, 'uRayon'), o.rayon * o.ratio);
    gl.uniform2f(this.u(s, 'uEcran'), W, Hh);
    gl.uniform2f(this.u(s, 'uTexel'), 1 / N, 1 / N);
    gl.uniform1f(this.u(s, 'uSeuil'), 0.5);
    gl.uniform1f(this.u(s, 'uRelief'), o.relief);
    gl.uniform1f(this.u(s, 'uGrain'), o.grain);
    gl.uniform1f(this.u(s, 'uBrillance'), o.brillance);
    gl.uniform1f(this.u(s, 'uHumide'), o.humide);
    gl.uniform1f(this.u(s, 'uTranslucide'), o.translucide);
    gl.uniform1f(this.u(s, 'uPeauGrain'), o.peauGrain);
    gl.uniform1f(this.u(s, 'uPeauPlis'), o.peauPlis);
    gl.uniform1f(this.u(s, 'uOmbre'), o.ombre);
    gl.uniform1f(this.u(s, 'uRayonPx'), o.rayon * o.ratio);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
