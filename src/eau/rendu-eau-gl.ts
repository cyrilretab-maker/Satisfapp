// Le dessin réaliste de l'eau, par la puce graphique (WebGL 2).
// L'inox brossé, la trace mouillée plus mate, l'eau transparente qui déforme l'inox vu au travers,
// ses bords brillants et ses reflets ; le rebord arrondi, la paroi de l'évier où l'eau ruisselle.
// L'eau est dessinée à partir de sa hauteur dans chaque case (moteur-eau.ts).

import { fabriquerBruit, TAILLE_BRUIT } from '../jeu/bruit';
import type { DispositionEau } from './ecran-eau';
import { NX, NY, type Eau } from './moteur-eau';

export interface OptionsEauGL {
  ratio: number;
  temps: number;
  lissage: number;
  reflets: number;
  refraction: number;
  traces: number;
  dureeTrace: number;
}

const VS = `#version 300 es
in vec2 aPos;
out vec2 vClip;
void main() { vClip = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vClip;
uniform sampler2D uEau;
uniform sampler2D uParoi;
uniform sampler2D uBruit;
uniform vec2 uEcran;      // pixels réels
uniform vec2 uOrigine;    // coin de l'égouttoir (pixels réels)
uniform float uCase;      // pixels réels par case
uniform float uParoiH;    // hauteur de la paroi (pixels réels)
uniform float uTemps;
uniform float uLissage;
uniform float uReflets;
uniform float uRefraction;
uniform float uTraces;
out vec4 sortie;

const vec2 N = vec2(${NX}.0, ${NY}.0);
const vec3 LUMIERE = vec3(-0.35, -0.55, 0.76);

/** L'inox brossé (rayures horizontales fines, reflet large d'une fenêtre). */
vec3 inox(vec2 g) {
  float fin = texture(uBruit, vec2(g.x * 0.015, g.y * 0.7)).b;
  float moyen = texture(uBruit, vec2(g.x * 0.004, g.y * 0.15)).g;
  float base = 0.56 + 0.07 * (fin - 0.5) + 0.05 * (moyen - 0.5);
  float fenetre = smoothstep(0.35, 0.0, abs((g.x / N.x) * 0.7 + (g.y / N.y) * 0.5 - 0.42)) * 0.12;
  return vec3(base + fenetre) * vec3(0.97, 0.99, 1.02);
}

// Lecture « bicubique » : la hauteur de l'eau varie en douceur d'une case à l'autre (bords ronds, pas d'escaliers).
vec4 poidsCubiques(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
vec4 lireCubique(sampler2D tex, vec2 uv) {
  vec2 taille = vec2(textureSize(tex, 0));
  vec2 p = uv * taille - 0.5;
  vec2 f = fract(p);
  p -= f;
  vec4 cx = poidsCubiques(f.x);
  vec4 cy = poidsCubiques(f.y);
  vec4 c = p.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(cx.xz + cx.yw, cy.xz + cy.yw);
  vec4 o = (c + vec4(cx.yw, cy.yw) / s) / taille.xxyy;
  vec4 a = texture(tex, o.xz);
  vec4 b = texture(tex, o.yz);
  vec4 d = texture(tex, o.xw);
  vec4 e = texture(tex, o.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(e, d, sx), mix(b, a, sx), sy);
}
float hauteur(vec2 g) { return lireCubique(uEau, (g + 0.5) / N).r * 4.0; }

float hauteurLisse(vec2 g) {
  float o = max(0.01, uLissage);
  return (hauteur(g) * 2.0 + hauteur(g + vec2(o, 0.0)) + hauteur(g - vec2(o, 0.0)) + hauteur(g + vec2(0.0, o)) + hauteur(g - vec2(0.0, o))) / 6.0;
}

void main() {
  vec2 p = vec2((vClip.x * 0.5 + 0.5) * uEcran.x, (0.5 - vClip.y * 0.5) * uEcran.y); // y vers le bas
  vec2 g = (p - uOrigine) / uCase - 0.5; // en cases
  vec3 couleur = vec3(0.078, 0.063, 0.063);
  float basGrille = N.y - 0.5;
  if (g.x < -0.5 || g.x > N.x - 0.5 || g.y < -0.5) { sortie = vec4(couleur, 1.0); return; }
  if (g.y <= basGrille) {
    // --- L'égouttoir.
    vec3 metal = inox(g);
    vec4 e = lireCubique(uEau, (g + 0.5) / N);
    float mouille = e.g;
    float h = hauteurLisse(g);
    float m = smoothstep(0.04, 0.12, h);
    // La trace mouillée : l'inox plus sombre et mat, qui s'éclaircit en séchant.
    metal *= 1.0 - 0.16 * uTraces * smoothstep(0.0, 0.3, mouille) * (1.0 - m);
    // La pente de l'eau donne sa forme : bords bombés, reflets, inox déformé au travers.
    float o = 0.8;
    vec2 grad = vec2(hauteurLisse(g + vec2(o, 0.0)) - hauteurLisse(g - vec2(o, 0.0)), hauteurLisse(g + vec2(0.0, o)) - hauteurLisse(g - vec2(0.0, o))) / (2.0 * o);
    vec3 Nn = normalize(vec3(-grad * 1.6, 1.0));
    // L'eau est transparente : on voit l'inox au travers, un peu déformé ; un fin bord sombre, des reflets.
    vec3 vu = inox(g + Nn.xy * uRefraction * 3.0) * vec3(0.97, 0.985, 1.0);
    float bord = smoothstep(0.05, 0.08, h) * (1.0 - smoothstep(0.08, 0.2, h));
    vec3 L = normalize(LUMIERE);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float reflet = pow(max(dot(Nn, H), 0.0), 120.0) * 1.2 + smoothstep(0.96, 0.995, dot(Nn, L)) * 0.35;
    float ombre = (1.0 - max(dot(Nn, L), 0.0)) * 0.6; // le côté de la goutte loin de la lumière
    vec3 eauC = vu * (1.0 - 0.35 * bord) * (1.0 - ombre * 0.25) + vec3(1.0) * reflet * uReflets;
    eauC += vec3(0.0, 0.01, 0.025) * min(1.0, h); // à peine bleutée
    couleur = mix(metal, eauC, m);
    // Le rebord : un bord roulé, plus clair sur son arrondi.
    float r = smoothstep(N.y - 1.8, N.y - 0.5, g.y);
    couleur = mix(couleur, couleur * (0.85 + 0.45 * sin(r * 3.14159)), r * (1.0 - m * 0.6));
  } else {
    // --- La paroi de l'évier : inox brossé vertical, plus sombre, où l'eau ruisselle.
    float y = (p.y - (uOrigine.y + N.y * uCase)) / uParoiH; // 0 en haut, 1 en bas
    if (y > 1.0) { sortie = vec4(couleur, 1.0); return; }
    float fin = texture(uBruit, vec2(g.x * 0.6, y * 0.05)).b;
    vec3 metal = vec3(0.36 + 0.05 * (fin - 0.5)) * (1.0 - 0.45 * y);
    float f = texture(uParoi, vec2((g.x + 0.5) / N.x, 0.5)).r;
    float filet = texture(uBruit, vec2(g.x * 0.12, (y * uParoiH / uCase) * 0.04 - uTemps * 1.4)).r;
    float eau = smoothstep(0.55, 0.75, filet + f * 0.9) * smoothstep(0.01, 0.05, f);
    couleur = mix(metal, metal * 1.25 + vec3(0.12, 0.14, 0.17), eau);
    couleur += vec3(0.5) * eau * smoothstep(0.6, 0.9, filet) * uReflets;
    // La goutte du rebord bombe et pend au-dessus de l'évier : plus elle est pleine, plus elle descend.
    float yc = (p.y - (uOrigine.y + N.y * uCase)) / uCase; // en cases sous le rebord
    float hr = hauteur(vec2(g.x, N.y - 1.0));
    float pend = max(0.0, hr - 0.6) * 0.7;
    if (yc < pend) {
      float k = yc / max(1e-3, pend);
      vec3 Ng = normalize(vec3(-(hauteur(vec2(g.x + 0.7, N.y - 1.0)) - hauteur(vec2(g.x - 0.7, N.y - 1.0))) * 0.8, k * 1.6, 1.0));
      vec3 L = normalize(LUMIERE);
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      float brille = pow(max(dot(Ng, H), 0.0), 80.0) * 1.3 + 0.25 * (1.0 - k);
      vec3 goutte = vec3(0.62, 0.66, 0.7) * (0.75 + 0.3 * (1.0 - k)) + vec3(1.0) * brille * uReflets;
      couleur = mix(couleur, goutte, smoothstep(1.0, 0.85, k));
    }
  }
  sortie = vec4(couleur, 1.0);
}`;

function compiler(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export class RenduEauGL {
  perdu = false;
  private readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly texEau: WebGLTexture;
  private readonly texParoi: WebGLTexture;
  private readonly texBruit: WebGLTexture;
  private readonly pixels = new Uint8Array(NX * NY * 4);
  private readonly pixelsParoi = new Uint8Array(NX * 4);
  private readonly uni = new Map<string, WebGLUniformLocation | null>();

  static creer(toile: HTMLCanvasElement): RenduEauGL | null {
    try {
      const gl = toile.getContext('webgl2', { antialias: false, alpha: false });
      return gl ? new RenduEauGL(toile, gl) : null;
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
    const p = gl.createProgram()!;
    gl.attachShader(p, compiler(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compiler(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    this.prog = p;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    const texture = (l: number, h: number, repeter: boolean, donnees: Uint8Array | null) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, l, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, donnees);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const w = repeter ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
      return t;
    };
    this.texEau = texture(NX, NY, false, null);
    this.texParoi = texture(NX, 1, false, null);
    this.texBruit = texture(TAILLE_BRUIT, TAILLE_BRUIT, true, fabriquerBruit(11));
  }

  private u(nom: string): WebGLUniformLocation | null {
    if (!this.uni.has(nom)) this.uni.set(nom, this.gl.getUniformLocation(this.prog, nom));
    return this.uni.get(nom)!;
  }

  dessiner(eau: Eau, d: DispositionEau, o: OptionsEauGL): void {
    const gl = this.gl;
    if (this.perdu || gl.isContextLost()) {
      this.perdu = true;
      return;
    }
    const px = this.pixels;
    for (let k = 0; k < NX * NY; k++) {
      px[4 * k] = Math.min(255, Math.round((eau.h[k] / 4) * 255));
      px[4 * k + 1] = Math.min(255, Math.round((eau.mouille[k] / Math.max(0.1, o.dureeTrace)) * 255));
      px[4 * k + 2] = Math.min(255, Math.round(eau.debit[k] * 12));
      px[4 * k + 3] = 255;
    }
    for (let x = 0; x < NX; x++) this.pixelsParoi[4 * x] = Math.min(255, Math.round(eau.paroi[x] * 255));
    gl.bindTexture(gl.TEXTURE_2D, this.texEau);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NX, NY, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindTexture(gl.TEXTURE_2D, this.texParoi);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NX, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelsParoi);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    [
      ['uEau', this.texEau],
      ['uParoi', this.texParoi],
      ['uBruit', this.texBruit],
    ].forEach(([nom, t], k) => {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, t as WebGLTexture);
      gl.uniform1i(this.u(nom as string), k);
    });
    const r = o.ratio;
    gl.uniform2f(this.u('uEcran'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(this.u('uOrigine'), d.ox * r, d.oy * r);
    gl.uniform1f(this.u('uCase'), d.taille * r);
    gl.uniform1f(this.u('uParoiH'), d.paroiH * r);
    gl.uniform1f(this.u('uTemps'), o.temps);
    gl.uniform1f(this.u('uLissage'), o.lissage);
    gl.uniform1f(this.u('uReflets'), o.reflets);
    gl.uniform1f(this.u('uRefraction'), o.refraction);
    gl.uniform1f(this.u('uTraces'), o.traces);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
