#version 300 es
precision highp float;

// Image finale : la vidéo en miroir vue à travers la buée. La buée floute et voile l'image, avec
// un grain très fin et de légères variations d'intensité ; ses variations d'épaisseur (bords des
// traces, bord d'une nappe) captent la lumière comme une pellicule d'eau. Quelques gouttes, et la
// tête des gouttes qui coulent, font lentille et accrochent la lumière.

#define MAX_DRIPS 16

in vec2 vUv;
in vec2 vTex;
out vec4 outColor;

uniform sampler2D uVideo;
uniform sampler2D uBlurLight;
uniform sampler2D uBlurHeavy;
uniform sampler2D uField;
uniform vec2 uFieldTexel;
// videoUV = mirror(screenUV) * uCoverScale + uCoverOffset (voir coords.ts)
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;
uniform float uAspect;

uniform float uVeilOpacity;
uniform vec3 uFogColor;
uniform float uScatter;
uniform float uGrain;
uniform float uMottling;
uniform float uDroplets;
uniform float uDropletScale;
uniform float uWetEdge;
uniform float uRefraction;
uniform int uDripCount;
uniform vec4 uDrips[MAX_DRIPS]; // x, y (écran), rayon (hauteurs d'écran), inutilisé

#include "noise.glsl"

// Lumière venant du haut à gauche de l'écran (y vers le bas), vers l'utilisateur.
const vec3 LIGHT = vec3(-0.45, -0.55, 0.7);

vec2 toVideo(vec2 screenUv) {
  return vec2(1.0 - screenUv.x, screenUv.y) * uCoverScale + uCoverOffset;
}

// L'image derrière la buée : nette, puis de plus en plus floue avec la densité.
vec3 background(vec2 screenUv, float d) {
  vec2 v = toVideo(screenUv);
  vec3 c = mix(texture(uVideo, v).rgb, texture(uBlurLight, v).rgb, smoothstep(0.0, 0.25, d));
  return mix(c, texture(uBlurHeavy, v).rgb, smoothstep(0.15, 0.75, d));
}

// Gouttes posées sur la vitre (bruit cellulaire de Worley, fixe à l'écran). Rares, placées
// n'importe où dans leur cellule, de taille et de forme irrégulières ; elles rétrécissent quand
// la buée s'évapore au lieu de disparaître d'un coup.
// Renvoie (position dans la goutte rapportée à son rayon, couverture, rayon en hauteurs d'écran).
vec4 drops(vec2 p, float d) {
  vec2 g = p * uDropletScale;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec4 best = vec4(0.0);
  float growth = smoothstep(0.35, 0.95, d);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 id = cell + o;
      if (hash12(id + 41.7) > uDroplets * 0.35) continue;
      float size = (0.1 + 0.28 * hash12(id + 7.1)) * growth;
      if (size < 0.01) continue;
      vec2 delta = (f - o - vec2(hash12(id), hash12(id + 17.3))) / size;
      // Ellipse d'orientation et d'allongement aléatoires, contour légèrement bosselé.
      float a = 6.2832 * hash12(id + 3.3);
      vec2 e = mat2(cos(a), -sin(a), sin(a), cos(a)) * delta;
      e.x *= 0.75 + 0.5 * hash12(id + 5.5);
      vec2 around = normalize(e + 1e-5);
      float bump = 1.0 + 0.4 * (valueNoise(around * 1.7 + 10.0 * hash12(id + 9.9)) - 0.5);
      float cover = 1.0 - smoothstep(0.55, 1.0, dot(e, e) / (bump * bump));
      if (cover > best.z) best = vec4(delta, cover, size / uDropletScale);
    }
  }
  return best;
}

// Têtes des gouttes qui coulent : rondes en bas, effilées vers le haut.
vec4 dripHeads(vec2 p) {
  vec4 best = vec4(0.0);
  for (int i = 0; i < MAX_DRIPS; i++) {
    if (i >= uDripCount) break;
    vec4 h = uDrips[i];
    vec2 delta = (p - h.xy * vec2(uAspect, 1.0)) / h.z;
    vec2 e = vec2(delta.x * 1.1, delta.y < 0.0 ? delta.y * 0.55 : delta.y);
    float cover = 1.0 - smoothstep(0.55, 1.0, dot(e, e));
    if (cover > best.z) best = vec4(delta, cover, h.z);
  }
  return best;
}

void main() {
  float d = texture(uField, vTex).r;

  // Pente de la couche de buée, en coordonnées écran (vTex a l'axe y vers le haut).
  vec2 grad = 0.5 * vec2(
    texture(uField, vTex + vec2(uFieldTexel.x, 0.0)).r - texture(uField, vTex - vec2(uFieldTexel.x, 0.0)).r,
    texture(uField, vTex - vec2(0.0, uFieldTexel.y)).r - texture(uField, vTex + vec2(0.0, uFieldTexel.y)).r
  );

  // Miroir net, sans goutte qui coule : rien d'autre à calculer.
  if (d < 0.003 && dot(grad, grad) < 1e-8 && uDripCount == 0) {
    outColor = vec4(texture(uVideo, toVideo(vUv)).rgb, 1.0);
    return;
  }

  vec2 p = vUv * vec2(uAspect, 1.0);

  // Gouttes : posées sur la vitre, ou en train de couler.
  vec4 drop = drops(p, d);
  vec4 head = dripHeads(p);
  if (head.z > drop.z) drop = head;
  float cover = drop.z;

  // Normale de la surface : pente de la pellicule d'eau, bombé des gouttes.
  vec2 slope = -grad * uWetEdge * 8.0 + drop.xy * cover * 0.9;
  vec3 normal = normalize(vec3(slope, 1.0));

  // Réfraction : l'eau dévie légèrement l'image ; à travers une goutte, l'image est un peu plus
  // nette (moins de diffusion), sans l'être tout à fait pour ne pas faire de points de couleur.
  vec2 offset = (-grad * 0.02 - drop.xy * cover * drop.w * 0.25) * uRefraction;
  vec3 bg = background(vUv + offset / vec2(uAspect, 1.0), d * (1.0 - 0.3 * cover));

  // Voile : la buée diffuse la lumière, d'autant plus qu'elle est éclairée par la scène. Grain très
  // fin (les microgouttelettes) et légères variations d'intensité, fixes sur la vitre.
  float luminance = dot(bg, vec3(0.299, 0.587, 0.114));
  vec3 fog = uFogColor * mix(1.0, 0.45 + 0.9 * luminance, uScatter);
  float grain = 0.6 * valueNoise(p * 900.0) + 0.4 * hash12(floor(p * 1400.0));
  float mottling = 1.0 + uMottling * 1.2 * (fbm(p * 1.8 + 7.0) - 0.5);
  float veil = uVeilOpacity * smoothstep(0.0, 1.0, d) * mottling;
  veil *= (1.0 + uGrain * 0.6 * (grain - 0.5)) * (1.0 - 0.4 * cover);
  vec3 color = mix(bg, fog, clamp(veil, 0.0, 1.0));

  // Éclairage : relief de la pellicule et des gouttes, reflet spéculaire, bord sombre des gouttes.
  vec3 light = normalize(LIGHT);
  color += (dot(normal, light) - light.z) * 0.18;
  float spec = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  color += spec * (0.5 * cover + 0.2 * min(length(grad) * uWetEdge * 20.0, 1.0));
  color *= 1.0 - 0.15 * cover * smoothstep(0.5, 1.0, dot(drop.xy, drop.xy));

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
