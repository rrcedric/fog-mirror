#version 300 es
precision highp float;

// Fait avancer le champ de buée d'une frame. Deux canaux :
// - R : la buée visible ;
// - G : l'humidité, c'est-à-dire la buée qui se reformerait si on n'y touchait pas.
// Le doigt essuie la buée visible ; elle se reforme ensuite lentement vers l'humidité, si bien
// qu'un tracé s'estompe peu à peu, en commençant par ses parties les plus anciennes.

#define MAX_BREATHS 4
#define MAX_SEGMENTS 32

in vec2 vUv;
in vec2 vTex;
out vec4 outField;

uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;
uniform float uDt;
uniform float uDither;

uniform float uEvaporation;
uniform float uEvaporationFloor;
uniform float uEvaporationVariation;
uniform float uDiffusion;
uniform float uRefogTime;
uniform float uRefogAmount;

uniform int uBreathCount;
uniform vec4 uBreaths[MAX_BREATHS]; // x, y, rayon, intensité
uniform float uBreathRate;
uniform float uBreathSpread;
uniform float uBreathWarp;

uniform int uSegmentCount;
uniform vec4 uSegments[MAX_SEGMENTS]; // ax, ay, bx, by
uniform vec2 uSegmentWidths[MAX_SEGMENTS]; // facteur de largeur en a et en b
uniform float uStrokeRadius;
uniform float uStrokeStrength;
uniform float uStrokeEdgeNoise;
uniform float uStrokeStreaks;
uniform float uStrokeRim;

#include "noise.glsl"

void main() {
  // Espace où les distances sont isotropes : x mis à l'échelle de l'aspect, unité = hauteur d'écran.
  vec2 scale = vec2(uAspect, 1.0);
  vec2 p = vUv * scale;

  vec2 f = texture(uField, vTex).rg;

  // Diffusion : la buée et l'humidité s'étalent légèrement vers les zones voisines.
  vec2 neighbors = 0.25 * (
    texture(uField, vTex + vec2(uTexel.x, 0.0)).rg +
    texture(uField, vTex - vec2(uTexel.x, 0.0)).rg +
    texture(uField, vTex + vec2(0.0, uTexel.y)).rg +
    texture(uField, vTex - vec2(0.0, uTexel.y)).rg
  );
  f = mix(f, neighbors, clamp(uDiffusion * uDt, 0.0, 1.0));

  // Évaporation de l'humidité, modulée par un bruit lent pour qu'elle ne soit pas uniforme.
  float variation = 1.0 + uEvaporationVariation * (2.0 * fbm(p * 5.0 + uTime * 0.03) - 1.0);
  f.g -= uDt * max(variation, 0.0) * (uEvaporationFloor + uEvaporation * f.g);

  // Re-condensation : la buée essuyée se reforme vers le niveau d'humidité.
  if (f.g > f.r) f.r += (f.g - f.r) * (1.0 - exp(-uDt / max(uRefogTime, 0.01)));
  // La buée visible ne peut pas dépasser l'humidité (quand celle-ci s'évapore).
  f.r = min(f.r, f.g);

  // Souffles : nappe de forme organique. Le domaine est déformé par un bruit lent, fixé sur la
  // vitre et qui dérive doucement ; la nappe est plus large que haute et monte un peu (l'air
  // chaud s'élève).
  for (int i = 0; i < MAX_BREATHS; i++) {
    if (i >= uBreathCount) break;
    vec4 b = uBreaths[i];
    vec2 delta = (p - b.xy * scale) / b.z;
    // Deux échelles de déformation : de grands lobes (≈ moitié du rayon) et un contour plus fin.
    vec2 q = p / b.z * 0.9 + vec2(uTime * 0.05, -uTime * 0.04);
    delta += uBreathWarp * 1.6 * (vec2(fbm(q), fbm(q + 19.7)) - 0.5);
    delta += uBreathWarp * 0.5 * (vec2(valueNoise(q * 3.0 + 5.1), valueNoise(q * 3.0 + 31.3)) - 0.5);
    delta *= vec2(0.85, delta.y < 0.0 ? 0.8 : 1.2);
    float edge = 0.8 + 0.4 * fbm(p * 12.0 + uTime * 0.3);
    // Profil « super-gaussien » : avec uBreathSpread > 1, le plateau central s'élargit et les bords
    // de la nappe se remplissent plus vite.
    float deposit = exp(-pow(dot(delta, delta), uBreathSpread) * 2.5 * edge);
    float amount = uDt * uBreathRate * b.w * deposit;
    f.r += amount * (1.0 - 0.5 * f.r);
    f.g += amount * (1.0 - 0.5 * f.g);
  }

  // Traces de doigt (et traînées des gouttes qui coulent) : on retire la buée le long des segments.
  float wipe = 0.0;
  float streak = 0.0;
  float rim = 0.0;
  // Bruit fixé dans l'espace (pas dans le temps) : le bord du trait est irrégulier sans « bouillir ».
  float edgeNoise = fbm(p / (uStrokeRadius * 0.9)) - 0.5;
  for (int i = 0; i < MAX_SEGMENTS; i++) {
    if (i >= uSegmentCount) break;
    vec2 a = uSegments[i].xy * scale;
    vec2 b = uSegments[i].zw * scale;
    vec2 ab = b - a;
    float len = length(ab);
    float t = clamp(dot(p - a, ab) / max(len * len, 1e-10), 0.0, 1.0);
    float dist = length(p - a - ab * t);
    vec2 w = uSegmentWidths[i];
    float r = uStrokeRadius * mix(w.x, w.y, t) * (1.0 + uStrokeEdgeNoise * edgeNoise);

    float m = 1.0 - smoothstep(r * 0.6, r, dist);
    if (m > wipe) {
      wipe = m;
      // Coordonnées dans le repère du trait : en travers et le long. Le bruit, étiré le long du
      // trait, dessine de fines stries parallèles, comme les sillons laissés par un doigt.
      vec2 dir = len > 1e-6 ? ab / len : vec2(1.0, 0.0);
      float across = dot(p - a, vec2(-dir.y, dir.x)) / r;
      float along = dot(p, dir) / r;
      streak = valueNoise(vec2(across * 4.0, along * 0.35));
    }
    // Bourrelet : l'eau poussée par un doigt en mouvement s'accumule juste au bord du trait.
    float ring = smoothstep(r * 0.8, r, dist) * (1.0 - smoothstep(r, r * 1.5, dist));
    rim = max(rim, ring * clamp(len / r, 0.0, 1.0));
  }
  vec2 before = f;
  float residue = uStrokeStreaks * smoothstep(0.5, 0.85, streak);
  float cleared = wipe * uStrokeStrength * (1.0 - residue);
  f.r *= 1.0 - cleared;
  // Le doigt emporte une partie de l'eau : le tracé ne se reforme qu'à hauteur de uRefogAmount.
  f.g *= 1.0 - cleared * (1.0 - uRefogAmount);
  f += uStrokeRim * rim * (1.0 - wipe) * before;

  // Tramage : en 8 bits, sans lui, les petites variations par frame seraient arrondies à zéro.
  f += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uDither;

  outField = vec4(clamp(f, 0.0, 1.0), 0.0, 1.0);
}
