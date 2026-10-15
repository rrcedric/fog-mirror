#version 300 es
precision highp float;

// Fait avancer le champ de densité d'une frame : diffusion, évaporation, souffles, traces de doigt.

#define MAX_BREATHS 4
#define MAX_SEGMENTS 32

in vec2 vUv;
in vec2 vTex;
out vec4 outDensity;

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

uniform int uBreathCount;
uniform vec4 uBreaths[MAX_BREATHS]; // x, y, rayon, intensité
uniform float uBreathRate;
uniform float uBreathSpread;

uniform int uSegmentCount;
uniform vec4 uSegments[MAX_SEGMENTS]; // ax, ay, bx, by
uniform vec2 uSegmentWidths[MAX_SEGMENTS]; // facteur de largeur en a et en b (selon la vitesse)
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

  float d = texture(uField, vTex).r;

  // Diffusion : la buée s'étale légèrement vers les zones voisines.
  float neighbors = 0.25 * (
    texture(uField, vTex + vec2(uTexel.x, 0.0)).r +
    texture(uField, vTex - vec2(uTexel.x, 0.0)).r +
    texture(uField, vTex + vec2(0.0, uTexel.y)).r +
    texture(uField, vTex - vec2(0.0, uTexel.y)).r
  );
  d = mix(d, neighbors, clamp(uDiffusion * uDt, 0.0, 1.0));

  // Évaporation, modulée par un bruit lent pour que la buée ne s'efface pas uniformément.
  float variation = 1.0 + uEvaporationVariation * (2.0 * fbm(p * 5.0 + uTime * 0.03) - 1.0);
  d -= uDt * max(variation, 0.0) * (uEvaporationFloor + uEvaporation * d);

  // Souffles : dépôt gaussien aux bords irréguliers.
  for (int i = 0; i < MAX_BREATHS; i++) {
    if (i >= uBreathCount) break;
    vec4 b = uBreaths[i];
    vec2 delta = (p - b.xy * scale) / b.z;
    float edge = 0.55 + 0.9 * fbm(p * 14.0 + uTime * 0.7);
    // Profil « super-gaussien » : avec uBreathSpread > 1, le plateau central s'élargit et les bords
    // de la nappe se remplissent plus vite.
    float deposit = exp(-pow(dot(delta, delta), uBreathSpread) * 2.5 * edge);
    d += uDt * uBreathRate * b.w * deposit * (1.0 - 0.5 * d);
  }

  // Traces de doigt : on retire la buée le long des segments.
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
      float across = dot(p - a, vec2(-dir.y, dir.x)) / uStrokeRadius;
      float along = dot(p, dir) / uStrokeRadius;
      streak = valueNoise(vec2(across * 4.0, along * 0.35));
    }
    // Bourrelet : l'eau poussée par un doigt en mouvement s'accumule juste au bord du trait.
    float ring = smoothstep(r * 0.8, r, dist) * (1.0 - smoothstep(r, r * 1.5, dist));
    rim = max(rim, ring * clamp(len / uStrokeRadius, 0.0, 1.0));
  }
  float before = d;
  float residue = uStrokeStreaks * smoothstep(0.5, 0.85, streak);
  d *= 1.0 - wipe * uStrokeStrength * (1.0 - residue);
  d += uStrokeRim * rim * (1.0 - wipe) * before;

  // Tramage : en 8 bits, sans lui, les petites variations par frame seraient arrondies à zéro.
  d += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uDither;

  outDensity = vec4(clamp(d, 0.0, 1.0), 0.0, 0.0, 1.0);
}
