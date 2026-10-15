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

uniform int uSegmentCount;
uniform vec4 uSegments[MAX_SEGMENTS]; // ax, ay, bx, by
uniform float uStrokeRadius;
uniform float uStrokeStrength;

#include "noise.glsl"

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}

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
    float deposit = exp(-dot(delta, delta) * 2.5 * edge);
    d += uDt * uBreathRate * b.w * deposit * (1.0 - 0.5 * d);
  }

  // Traces de doigt : on retire la buée le long des segments.
  float wipe = 0.0;
  for (int i = 0; i < MAX_SEGMENTS; i++) {
    if (i >= uSegmentCount) break;
    vec4 s = uSegments[i];
    float dist = segmentDistance(p, s.xy * scale, s.zw * scale);
    wipe = max(wipe, 1.0 - smoothstep(uStrokeRadius * 0.55, uStrokeRadius, dist));
  }
  d *= 1.0 - wipe * uStrokeStrength;

  // Tramage : en 8 bits, sans lui, les petites variations par frame seraient arrondies à zéro.
  d += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uDither;

  outDensity = vec4(clamp(d, 0.0, 1.0), 0.0, 0.0, 1.0);
}
