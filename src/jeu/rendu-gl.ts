// Le dessin réaliste, fait par la puce graphique du téléphone (WebGL 2).
//
// V2 : on regarde dans le conduit. Le fond (le tympan, et le bouchon posé dessus) paraît petit et
// lointain ; la paroi fuit vers lui, salie de cire près du fond. Voir perspective.ts pour la géométrie.
//
// À chaque image :
//  1. « Champ de cire » (en unités de matière) : chaque point et chaque triangle intact sont peints
//     dans des images cachées : présence, colle, blanchiment, place au repos, hauteur, nature.
//  2. Ce champ est flouté (masse lisse), et une version très floue donne le volume bombé.
//  3. Les marques sur la peau (peau dégagée, rougeurs).
//  4. L'image finale : pour chaque pixel, on retrouve l'endroit du conduit qu'il montre
//     (fond ou paroi), puis on dessine la peau, la cire des parois, et la cire du bouchon.
// Les outils, le bord de la vue et la zone du pouce restent dessinés par-dessus en Canvas 2D.

import { COLLANTE, DURE, MOLLE } from '../matiere/bouchon';
import type { Simulation } from '../matiere/moteur';
import { ANGLES, RANGS } from '../matiere/parois';
import { fabriquerBruit, TAILLE_BRUIT } from './bruit';
import { ENTREE, FOND } from './perspective';
import type { Peau } from './peau';

const ETENDUE = 1.05; // le champ de cire couvre la matière de -ETENDUE à +ETENDUE
const ETENDUE_MARQUES = 1.45; // les marques couvrent aussi la paroi
const FLOTTANTS_PAR_POINT = 10; // x, y, décollé, blanchi, u, v, hauteur, dure, collante, molle
const DUREE_ECLAIRCISSEMENT = 2.5;
const FOND_PAGE = [0x14 / 255, 0x10 / 255, 0x10 / 255];
const f3 = (v: number) => v.toFixed(3);

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
  epaisseur: number; // bombé du bouchon
  arrondi: number; // largeur de l'arrondi des bords (unités de matière)
  contact: number; // ombre là où la cire touche la peau
  leve: number; // hauteur de la cire décollée (unités de matière) : longueur de son ombre portée
  fond: number; // rayon du fond à l'écran (0..1) : la profondeur du conduit
  fuiteX: number; // décalage du point de fuite (effet 3D)
  fuiteY: number;
  dechire: number; // irrégularité des bords arrachés
}

// ---------- Les programmes de la puce graphique ----------

const VS_MATIERE = `#version 300 es
in vec2 aPos;
in vec4 aDon;
in float aLeve;
in vec3 aNature;
uniform float uTaille;
out vec4 vDon;
out float vLeve;
out vec3 vNature;
void main() {
  vDon = aDon;
  vLeve = aLeve;
  vNature = aNature;
  gl_Position = vec4(aPos / ${f3(ETENDUE)}, 0.0, 1.0);
  gl_PointSize = uTaille;
}`;

const FS_MATIERE = `#version 300 es
precision highp float;
in vec4 vDon;
in float vLeve;
in vec3 vNature;
uniform bool uPoint;
uniform float uRayonUv; // rayon d'un disque, en unités de « place au repos »
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  vec2 uv = vDon.zw;
  if (uPoint) {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    if (dot(d, d) > 1.0) discard;
    // Le grain continue à l'intérieur du disque (sinon chaque disque a un grain uniforme : escaliers).
    uv += vec2(d.x, -d.y) * uRayonUv;
  }
  o0 = vec4(1.0, vDon.x, vDon.y, 1.0);
  o1 = vec4(uv, vLeve, 1.0); // b = hauteur de la cire au-dessus de la peau
  o2 = vec4(vNature, 1.0); // dure, collante, molle
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
uniform sampler2D uC;
uniform vec2 uDir;
uniform float uW[${PRISES + 1}];
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
void main() {
  vec4 a = texture(uA, vUv) * uW[0];
  vec4 b = texture(uB, vUv) * uW[0];
  vec4 c = texture(uC, vUv) * uW[0];
  for (int i = 1; i <= ${PRISES}; i++) {
    vec2 o = uDir * float(i);
    a += (texture(uA, vUv + o) + texture(uA, vUv - o)) * uW[i];
    b += (texture(uB, vUv + o) + texture(uB, vUv - o)) * uW[i];
    c += (texture(uC, vUv + o) + texture(uC, vUv - o)) * uW[i];
  }
  o0 = a;
  o1 = b;
  o2 = c;
}`;

const VS_MARQUES = `#version 300 es
in vec2 aPos;
in vec2 aCol;
in float aTaille;
out vec2 vCol;
void main() {
  vCol = aCol;
  gl_Position = vec4(aPos / ${f3(ETENDUE_MARQUES)}, 0.0, 1.0);
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
uniform sampler2D uC2;
uniform sampler2D uMarques;
uniform sampler2D uBruit;
uniform sampler2D uDome;
uniform sampler2D uParois;
uniform vec2 uTexel;
uniform vec2 uTexelDome;
uniform float uSeuil;
uniform float uRelief;
uniform float uGrain;
uniform float uBrillance;
uniform float uHumide;
uniform float uTranslucide;
uniform float uPeauGrain;
uniform float uPeauPlis;
uniform float uOmbre;
uniform float uPxParUnite;
uniform float uEpaisseur;
uniform float uContact;
uniform float uLeve;
uniform float uFond;
uniform vec2 uFuite;
uniform float uDechire;
out vec4 sortie;

const float FOND = ${f3(FOND)};
const float ENTREE = ${f3(ENTREE)};
const float ETENDUE = ${f3(ETENDUE)};
const float ETENDUE_MARQUES = ${f3(ETENDUE_MARQUES)};
const float TOUR = 6.2831853;
const vec3 LUMIERE = vec3(-0.28, -0.38, 0.88);
// La lumière vient d'en haut à gauche : les ombres partent vers le bas à droite.
const vec2 VERS_OMBRE = vec2(0.59, 0.81);

vec2 pente(float h) { return vec2(dFdx(h), -dFdy(h)); }

// Les bosses de la cire, lues dans sa place « au repos » (elles bougent avec elle).
float bosses(vec2 uv) {
  return (texture(uBruit, uv * 1.3).r - 0.5) * 0.7 + (texture(uBruit, uv * 0.9 + 0.5).g - 0.5) * 0.3;
}

float hauteurEn(vec2 p) {
  vec4 c = texture(uC1, p);
  return c.a > 0.02 ? c.b / c.a : 0.0;
}

/** Ombre portée sur ce point par la cire soulevée autour (0 = aucune, 1 = pleine). */
float ombrePortee(vec2 q, float hauteurIci) {
  float s = 0.0;
  for (int k = 1; k <= 5; k++) {
    float o = float(k) / 5.0 * uLeve;
    vec2 p = q - VERS_OMBRE * o;
    float present = smoothstep(0.35, 0.6, texture(uC0, p).r);
    float dessus = (hauteurEn(p) - hauteurIci) * uLeve;
    s = max(s, present * smoothstep(o * 0.5, o, dessus));
  }
  return s;
}

void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  vec3 L = normalize(LUMIERE);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

  // --- Quel endroit du conduit ce pixel montre-t-il ? (même calcul que perspective.ts)
  vec2 A = vP - uFuite;
  float ac = dot(A, uFuite);
  float c2 = dot(uFuite, uFuite);
  float u = (ac + sqrt(max(0.0, ac * ac + (1.0 - c2) * dot(A, A)))) / max(1e-6, 1.0 - c2);
  vec2 dir = u > 1e-5 ? (A + uFuite * u) / u : vec2(1.0, 0.0);
  float K = 1.0 / uFond - 1.0;
  bool auFond = u <= uFond;
  float s = auFond ? u / uFond * FOND : FOND + (1.0 - (1.0 / u - 1.0) / K) * (ENTREE - FOND);
  float z = auFond ? 1.0 : (1.0 / u - 1.0) / K; // profondeur : 1 au fond, 0 à l'entrée
  vec2 S = dir * s; // l'endroit, en unités de matière
  float w = clamp((s - FOND) / (ENTREE - FOND), 0.0, 1.0); // sur la paroi : 0 au fond, 1 à l'entrée
  float ang = atan(dir.y, dir.x) / TOUR;
  // La lumière de l'endoscope faiblit avec la distance.
  float lumFond = mix(0.45, 0.95, uFond);
  float lum = mix(1.18, lumFond, pow(z, 0.8));

  vec3 couleur;
  vec4 mk = texture(uMarques, S / ETENDUE_MARQUES * 0.5 + 0.5);
  if (auFond) {
    // --- Le fond : le tympan, nacré, avec son reflet en triangle.
    float rho = s / FOND;
    vec3 nacre = vec3(0.80, 0.70, 0.68);
    vec3 bordRose = vec3(0.72, 0.46, 0.40);
    vec3 cp = mix(nacre, bordRose, smoothstep(0.45, 1.0, rho));
    vec4 nT = texture(uBruit, S * 0.9 + 0.2);
    cp *= 1.0 + (nT.g - 0.5) * 0.25 * uPeauGrain;
    float a = atan(S.y, S.x);
    float cone = smoothstep(0.32, 0.0, abs(mod(a - 2.2 + 3.14159, 6.28318) - 3.14159)) * smoothstep(0.12, 0.35, rho) * smoothstep(0.95, 0.55, rho);
    cp += vec3(0.30, 0.28, 0.26) * cone;
    // Le manche du marteau (petit os) qui transparaît.
    vec2 m1 = vec2(0.0), m2 = vec2(-0.22, -0.48);
    vec2 pm = S - m1, dm = m2 - m1;
    float tm = clamp(dot(pm, dm) / dot(dm, dm), 0.0, 1.0);
    cp = mix(cp, vec3(0.92, 0.86, 0.80), smoothstep(0.05, 0.015, length(pm - dm * tm)) * 0.5);
    cp *= mix(0.6, 1.0, smoothstep(1.0, 0.82, rho)); // le pli au pied de la paroi
    cp *= 1.0 + clamp(mk.g, 0.0, 1.0) * 0.25;
    couleur = cp;
  } else {
    // --- La paroi du conduit : peau rose, plis dans le sens du conduit, grain, éclat humide.
    vec4 nPli = texture(uBruit, vec2(ang * 16.0, w * 1.4));
    vec4 nFin = texture(uBruit, vec2(ang * 48.0, w * 9.0));
    vec3 cp = mix(vec3(0.78, 0.50, 0.43), vec3(0.93, 0.66, 0.56), w);
    float plis = (nPli.r - 0.5) * uPeauPlis;
    float grainPeau = (nFin.g - 0.5) * uPeauGrain;
    cp *= 1.0 + plis * 0.7 + grainPeau * 0.3;
    float hs = plis + grainPeau * 0.4;
    vec3 Np = normalize(vec3(-pente(hs) * 10.0, 1.0));
    cp *= mix(0.62, 1.0, smoothstep(0.0, 0.12, w)); // le creux au pied de la paroi, contre le fond
    cp *= 1.0 + clamp(mk.g, 0.0, 1.0) * 0.3;
    couleur = cp * (0.8 + 0.25 * max(dot(Np, L), 0.0))
      + vec3(1.0, 0.92, 0.88) * pow(max(dot(Np, H), 0.0), 40.0) * 0.35 * smoothstep(0.2, 0.9, w);

    // --- La cire des parois : traînées collantes, cire humide, plaques sèches, miettes.
    vec4 dep = texture(uParois, vec2(ang, w));
    vec4 n1 = texture(uBruit, vec2(ang * 22.0, w * 5.0));
    vec4 n2 = texture(uBruit, vec2(ang * 60.0, w * 14.0) + 0.3);
    float coll = smoothstep(0.12, 0.55, dep.g + (n1.g - 0.5) * 0.25);
    vec3 cCollant = vec3(0.50, 0.27, 0.07) * (0.9 + n2.r * 0.2);
    couleur = mix(couleur, cCollant + vec3(0.18) * pow(max(dot(Np, H), 0.0), 25.0) * uBrillance, coll * 0.8);
    float li = smoothstep(0.18, 0.5, dep.b + (n1.b - 0.5) * 0.3);
    vec3 cLiquide = vec3(0.86, 0.66, 0.27) + vec3(1.0, 0.95, 0.8) * pow(max(dot(normalize(vec3(-pente(n1.b) * 25.0, 1.0)), H), 0.0), 30.0) * uBrillance * 1.5;
    couleur = mix(couleur, cLiquide, li * 0.75);
    float crBrut = dep.r + (n1.r - 0.5) * 0.45 * uDechire;
    float cr = smoothstep(0.32, 0.42, crBrut);
    // Une plaque a du relief : bord éclairé d'un côté, ombré de l'autre ; écailles et couches dedans.
    float hcr = smoothstep(0.3, 0.7, crBrut) + (n2.g - 0.5) * 0.3;
    vec3 Nc = normalize(vec3(-pente(hcr) * 6.0, 1.0));
    vec3 cCroute = mix(vec3(0.46, 0.26, 0.09), vec3(0.66, 0.42, 0.17), n2.g) * (0.85 + 0.3 * n1.g);
    cCroute *= 0.62 + 0.5 * max(dot(Nc, L), 0.0);
    cCroute *= 1.0 - texture(uBruit, vec2(ang * 90.0, w * 24.0)).a * 0.4; // éclats
    couleur = mix(couleur, cCroute, cr);
    couleur *= 1.0 - 0.3 * (smoothstep(0.2, 0.32, crBrut) - cr) ; // ombre au pied de la plaque
    float mi = step(1.0 - dep.a * 0.75, texture(uBruit, vec2(ang * 150.0, w * 40.0)).b);
    couleur = mix(couleur, vec3(0.48, 0.28, 0.10) * (0.8 + n2.r * 0.4), mi * 0.9);
  }
  couleur = mix(couleur, vec3(0.80, 0.18, 0.22), clamp(mk.r, 0.0, 1.0) * 0.55);

  // --- Le bouchon (et les morceaux en train de sortir).
  vec2 q = S / ETENDUE * 0.5 + 0.5;
  float ombre = s < ETENDUE + 0.05 ? texture(uC0, q + vec2(0.010, 0.016)).r : 0.0;
  float dome = s < ETENDUE + 0.05 ? texture(uDome, q).r : 0.0;
  couleur *= 1.0 - uOmbre * 0.55 * clamp(ombre, 0.0, 1.0);
  couleur *= 1.0 - uContact * 0.45 * smoothstep(0.05, 0.6, dome);
  if (uLeve > 0.0 && s < ETENDUE) couleur *= 1.0 - 0.6 * ombrePortee(q, 0.0);
  vec4 c0 = s < ETENDUE ? texture(uC0, q) : vec4(0.0);
  float cov = c0.r;
  if (cov > 0.01) {
    float lache = clamp(c0.g / max(cov, 1e-3), 0.0, 1.0);
    float blanc = clamp(c0.b / max(cov, 1e-3), 0.0, 1.0);
    vec4 c1 = texture(uC1, q);
    vec2 uv = c1.rg / max(c1.a, 1e-3);
    vec4 cn = texture(uC2, q);
    vec3 nat = clamp(cn.rgb / max(cn.a, 1e-3), 0.0, 1.0); // dure, collante, molle
    float compacte = clamp(1.0 - nat.x - nat.y - nat.z, 0.0, 1.0);
    // Bords arrachés : le seuil du contour est bruité dans la cire (sauf la cire molle, qui coule).
    float arrache = (texture(uBruit, uv * 6.0).b - 0.5) * 0.6 + (texture(uBruit, uv * 2.6).g - 0.5) * 0.4;
    float seuil = uSeuil + arrache * uDechire * 0.4 * (1.0 - nat.z) * smoothstep(0.2, 0.9, c1.a);
    float fw = max(fwidth(cov) * 0.9, 0.004);
    float m = smoothstep(seuil - fw, seuil + fw, cov);
    float bosse = bosses(uv);
    // Pente des bosses calculée dans la cire elle-même (pas par pixel : ça scintillait).
    const float E = 0.004;
    vec2 pb = vec2(bosses(uv + vec2(E, 0.0)) - bosses(uv - vec2(E, 0.0)), bosses(uv + vec2(0.0, E)) - bosses(uv - vec2(0.0, E))) / (2.0 * E);
    pb *= 0.5 / uPxParUnite; // unités de cire → pixels
    pb *= smoothstep(0.4, 0.9, c1.a); // au ras du bord, la place au repos est imprécise : pas de bosses
    float grainN = compacte * 1.0 + nat.x * 1.7 + nat.y * 0.45 + nat.z * 0.15;
    vec2 g = vec2(
      texture(uC0, q + vec2(uTexel.x, 0.0)).r - texture(uC0, q - vec2(uTexel.x, 0.0)).r,
      texture(uC0, q + vec2(0.0, uTexel.y)).r - texture(uC0, q - vec2(0.0, uTexel.y)).r
    );
    vec2 gd = vec2(
      texture(uDome, q + vec2(uTexelDome.x, 0.0)).r - texture(uDome, q - vec2(uTexelDome.x, 0.0)).r,
      texture(uDome, q + vec2(0.0, uTexelDome.y)).r - texture(uDome, q - vec2(0.0, uTexelDome.y)).r
    ) / (4.0 * ETENDUE * uTexelDome.x);
    float hauteurIci = hauteurEn(q);
    vec3 N = normalize(vec3(-gd * uEpaisseur * 0.22 - g * 3.0 * uRelief - pb * 40.0 * uGrain * grainN, 1.0));
    float epais = smoothstep(uSeuil, min(1.0, uSeuil + 0.4), cov);
    // Les couleurs : mates et brun-orangé, chaque nature la sienne ; plus claire quand elle est décollée.
    vec3 cCompacte = mix(vec3(0.50, 0.27, 0.08), vec3(0.68, 0.42, 0.16), lache);
    vec3 cDure = mix(vec3(0.30, 0.16, 0.06), vec3(0.44, 0.26, 0.10), lache);
    vec3 cCollante = mix(vec3(0.36, 0.17, 0.04), vec3(0.52, 0.29, 0.07), lache);
    vec3 cMolle = mix(vec3(0.62, 0.40, 0.12), vec3(0.84, 0.62, 0.24), 0.5 + bosse);
    vec3 cc = cCompacte * compacte + cDure * nat.x + cCollante * nat.y + cMolle * nat.z;
    cc *= 1.0 + bosse * 0.4 * uGrain * grainN;
    // En couches (compacte et dure) ; éclats sombres dans la dure.
    float couches = sin(uv.x * 70.0 + uv.y * 25.0 + bosse * 9.0);
    cc *= 1.0 + couches * 0.07 * (compacte + nat.x);
    cc *= 1.0 - texture(uBruit, uv * 3.5).a * 0.35 * nat.x;
    cc = mix(cc, vec3(0.98, 0.93, 0.80), blanc * 0.85);
    cc = mix(cc * 1.2 + vec3(0.05, 0.03, 0.0), cc, epais);
    float tranche = (1.0 - smoothstep(uSeuil, uSeuil + 0.22, cov)) * smoothstep(0.25, 0.7, dome) * min(1.0, uEpaisseur);
    cc = mix(cc, vec3(0.30, 0.15, 0.04), tranche * 0.55 * (1.0 - nat.z));
    cc *= mix(0.82, 1.0, mix(1.0, smoothstep(0.15, 0.75, dome), min(1.0, uEpaisseur)));
    cc *= 1.0 + hauteurIci * 0.12;
    if (uLeve > 0.0) cc *= 1.0 - 0.45 * ombrePortee(q, hauteurIci);
    float diffus = 0.5 + 0.65 * max(dot(N, L), 0.0);
    // Mate en général ; la collante luit un peu, la molle est mouillée.
    float brillN = compacte * 0.35 + nat.x * 0.1 + nat.y * 0.9 + nat.z * 1.6;
    float reflet = pow(max(dot(N, H), 0.0), uHumide * (1.0 + nat.z)) * uBrillance * brillN;
    vec3 cire = cc * diffus + vec3(1.0, 0.96, 0.86) * reflet;
    // La cire molle est mouillée : un voile brillant qui suit ses bosses, même quand le reste est mat.
    cire += vec3(1.0, 0.95, 0.82) * nat.z * 0.35 * pow(max(dot(N, H), 0.0), 18.0);
    float alpha = m * mix(1.0 - uTranslucide, 1.0, epais) * (1.0 - nat.z * 0.2);
    couleur = mix(couleur, cire * lumFond * 1.15, alpha);
  }

  couleur *= lum;
  // Le bord de la vue : la lumière de l'endoscope faiblit.
  couleur *= 1.06 - 0.25 * r * r;
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
  private readonly texParois: WebGLTexture;
  private readonly pixelsParois = new Uint8Array(ANGLES * RANGS * 4);
  private versionParois = -1;
  private paroisVues: unknown = null;
  private readonly formatFlottant: boolean;
  private champA: Cible | null = null;
  private champB: Cible | null = null;
  private marques: Cible | null = null;
  private domeA: Cible | null = null;
  private domeB: Cible | null = null;
  private tailleDome = 0;
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
    this.pMatiere = programme(gl, VS_MATIERE, FS_MATIERE, ['aPos', 'aDon', 'aLeve', 'aNature']);
    this.pFlou = programme(gl, VS_PLEIN, FS_FLOU, ['aPos']);
    this.pMarques = programme(gl, VS_MARQUES, FS_MARQUES, ['aPos', 'aCol', 'aTaille']);
    this.pScene = programme(gl, VS_SCENE, FS_SCENE, ['aPos']);

    const pas = 4 * FLOTTANTS_PAR_POINT;
    this.bufMatiere = gl.createBuffer()!;
    this.bufIndices = gl.createBuffer()!;
    this.vaoMatiere = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoMatiere);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufMatiere);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, pas, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, pas, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, pas, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, pas, 28);
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

    // La cire des parois : une petite image (tour du conduit × profondeur), renvoyée quand elle change.
    this.texParois = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texParois);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ANGLES, RANGS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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
    [this.champA, this.champB, this.marques, this.domeA, this.domeB].forEach((c) => this.libererCible(c));
    this.tailleChamp = taille;
    this.tailleDome = Math.max(32, Math.round(taille / 4));
    this.champA = this.creerCible(taille, 3, this.formatFlottant);
    this.champB = this.creerCible(taille, 3, this.formatFlottant);
    this.domeA = this.creerCible(this.tailleDome, 3, this.formatFlottant);
    this.domeB = this.creerCible(this.tailleDome, 3, this.formatFlottant);
    this.marques = this.creerCible(taille, 1, false);
  }

  /** Dessine le conduit, la cire des parois et le bouchon (le reste vient par-dessus, en 2D). */
  dessiner(sim: Simulation, peau: Peau, o: OptionsRendu): void {
    const gl = this.gl;
    if (this.perdu || gl.isContextLost()) {
      this.perdu = true;
      return;
    }
    const W = gl.drawingBufferWidth;
    const Hh = gl.drawingBufferHeight;
    // Pixels réels par unité de matière, au fond du conduit.
    const pxParUnite = (o.rayon * o.ratio * o.fond) / FOND;
    // Le champ n'a pas besoin d'être plus fin que le flou ne le permet (12 pixels de champ pour le rayon du flou).
    const flouVue = Math.max(1e-3, o.douceur * sim.b.params.finesse);
    const N = Math.max(
      96,
      Math.min(1024, Math.round(2 * ETENDUE * pxParUnite * o.qualite), Math.round((12 / flouVue) * 2 * ETENDUE)),
    );
    this.preparerChamp(N);
    const pxChamp = N / (2 * ETENDUE);
    const b = sim.b;
    const n = sim.n;
    const a = sim.fractionDePas();

    // 1. Les données de chaque point : position (lissée entre deux pas), colle, blanchiment,
    //    place au repos, hauteur, nature.
    if (this.donnees.length !== n * FLOTTANTS_PAR_POINT) this.donnees = new Float32Array(n * FLOTTANTS_PAR_POINT);
    const tenu = new Uint8Array(n);
    if (sim.outil.ferme) for (const i of sim.outil.prise) tenu[i] = 1;
    const etir = new Float32Array(n);
    const seuilBlanc = o.blanchiment;
    for (let l = 0; l < b.lienA.length; l++) {
      if (!sim.lienOk[l] || sim.lienMou(l)) continue;
      const e = sim.allongement(l) / sim.limite(l);
      const k = (e - seuilBlanc) / Math.max(1e-6, 1 - seuilBlanc);
      if (k <= 0) continue;
      if (k > etir[b.lienA[l]]) etir[b.lienA[l]] = k;
      if (k > etir[b.lienB[l]]) etir[b.lienB[l]] = k;
    }
    const d = this.donnees;
    for (let i = 0; i < n; i++) {
      const k = FLOTTANTS_PAR_POINT * i;
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
      // La cire décollée se soulève (le « petit sac ») ; tenue par la pince, elle monte encore.
      d[k + 6] = Math.min(1, (1 - tient) * 0.6 + (tenu[i] ? 0.4 : 0));
      const nat = b.nature[i];
      d[k + 7] = nat === DURE ? 1 : 0;
      d[k + 8] = nat === COLLANTE ? 1 : 0;
      d[k + 9] = nat === MOLLE ? 1 : 0;
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
    gl.uniform1f(this.u(this.pMatiere, 'uTaille'), Math.max(2, b.params.finesse * 1.1 * pxChamp));
    gl.uniform1i(this.u(this.pMatiere, 'uPoint'), 1);
    gl.uniform1f(this.u(this.pMatiere, 'uRayonUv'), b.params.finesse * 0.55 * 0.5);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.uniform1i(this.u(this.pMatiere, 'uPoint'), 0);
    if (ni > 0) gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_SHORT, 0);

    // 3. Le flou : deux passes (horizontale puis verticale), A → B → A.
    const pas = Math.max(0.25, (flouVue * pxChamp) / PRISES) / N;
    gl.useProgram(this.pFlou);
    gl.bindVertexArray(this.vaoCarre);
    gl.uniform1i(this.u(this.pFlou, 'uA'), 0);
    gl.uniform1i(this.u(this.pFlou, 'uB'), 1);
    gl.uniform1i(this.u(this.pFlou, 'uC'), 2);
    gl.uniform1fv(this.u(this.pFlou, 'uW'), POIDS);
    const passe = (de: Cible, vers: Cible, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, vers.fb);
      for (let k = 0; k < 3; k++) {
        gl.activeTexture(gl.TEXTURE0 + k);
        gl.bindTexture(gl.TEXTURE_2D, de.tex[k]);
      }
      gl.uniform2f(this.u(this.pFlou, 'uDir'), dx, dy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    passe(A, B, pas, 0);
    passe(B, A, 0, pas);

    // 3 bis. Le volume : le même champ, en petit et très flou, donne une masse bombée.
    const D1 = this.domeA!;
    const D2 = this.domeB!;
    const M0 = this.tailleDome;
    gl.viewport(0, 0, M0, M0);
    const pasDome = o.arrondi / (2 * ETENDUE) / PRISES;
    passe(A, D1, pasDome, 0);
    passe(D1, D2, 0, pasDome);
    passe(D2, D1, pasDome, 0);
    passe(D1, D2, 0, pasDome);
    gl.viewport(0, 0, N, N);

    // 4. Les marques sur la peau : là où elle a été dégagée (elle s'éclaircit), et les rougeurs.
    const M = this.marques!;
    const marques: number[] = [];
    const pxMarques = N / (2 * ETENDUE_MARQUES);
    const tache = Math.max(2, b.params.finesse * 3.2 * pxMarques);
    for (let i = 0; i < n; i++) {
      if (!sim.sorti[i]) continue;
      const k = Math.min(1, (sim.temps - sim.sortiA[i]) / DUREE_ECLAIRCISSEMENT);
      marques.push(b.x0[i], b.y0[i], 0, 0.45 * k, tache);
    }
    for (const r of peau.rougeurs) {
      const f = peau.intensite(r, o.temps, o.dureeRougeur);
      if (f > 0) marques.push(r.x, r.y, f, 0, 0.24 * pxMarques);
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

    // 5. La cire des parois : renvoyée seulement si elle a changé.
    if (sim.parois !== this.paroisVues || sim.parois.version !== this.versionParois) {
      this.paroisVues = sim.parois;
      this.versionParois = sim.parois.version;
      sim.parois.texture(this.pixelsParois);
      gl.bindTexture(gl.TEXTURE_2D, this.texParois);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ANGLES, RANGS, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelsParois);
    }

    // 6. L'image finale.
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
      ['uC2', A.tex[2]],
      ['uMarques', M.tex[0]],
      ['uBruit', this.texBruit],
      ['uDome', D2.tex[0]],
      ['uParois', this.texParois],
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
    gl.uniform2f(this.u(s, 'uTexelDome'), 1 / M0, 1 / M0);
    gl.uniform1f(this.u(s, 'uSeuil'), 0.5);
    gl.uniform1f(this.u(s, 'uRelief'), o.relief);
    gl.uniform1f(this.u(s, 'uGrain'), o.grain);
    gl.uniform1f(this.u(s, 'uBrillance'), o.brillance);
    gl.uniform1f(this.u(s, 'uHumide'), o.humide);
    gl.uniform1f(this.u(s, 'uTranslucide'), o.translucide);
    gl.uniform1f(this.u(s, 'uPeauGrain'), o.peauGrain);
    gl.uniform1f(this.u(s, 'uPeauPlis'), o.peauPlis);
    gl.uniform1f(this.u(s, 'uOmbre'), o.ombre);
    gl.uniform1f(this.u(s, 'uPxParUnite'), pxParUnite);
    gl.uniform1f(this.u(s, 'uEpaisseur'), o.epaisseur);
    gl.uniform1f(this.u(s, 'uContact'), o.contact);
    gl.uniform1f(this.u(s, 'uLeve'), o.leve / (2 * ETENDUE));
    gl.uniform1f(this.u(s, 'uFond'), o.fond);
    gl.uniform2f(this.u(s, 'uFuite'), o.fuiteX, o.fuiteY);
    gl.uniform1f(this.u(s, 'uDechire'), o.dechire);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
