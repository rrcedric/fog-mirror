#version 300 es
precision highp float;

// Image finale : la vidéo en miroir, floutée et voilée là où il y a de la buée.

#define BLUR_TAPS 12

in vec2 vUv;
in vec2 vTex;
out vec4 outColor;

uniform sampler2D uVideo;
uniform sampler2D uField;
// videoUV = mirror(screenUV) * uCoverScale + uCoverOffset (voir coords.ts)
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;
uniform float uAspect;
uniform vec2 uVideoSize;
uniform float uBlurRadius;
uniform float uVeilOpacity;
uniform vec3 uFogColor;

#include "noise.glsl"

vec2 toVideo(vec2 screenUv) {
  return vec2(1.0 - screenUv.x, screenUv.y) * uCoverScale + uCoverOffset;
}

void main() {
  float d = texture(uField, vTex).r;
  vec3 color = texture(uVideo, toVideo(vUv)).rgb;

  if (d > 0.003) {
    // Flou sur un disque (spirale de Vogel), rayon croissant avec la densité. On lit un niveau
    // de mipmap adapté à l'espacement des échantillons pour éviter un aspect granuleux.
    float radius = uBlurRadius * smoothstep(0.0, 0.7, d);
    float radiusPx = radius * uCoverScale.y * uVideoSize.y;
    float lod = log2(max(radiusPx / 3.0, 1.0));
    float angle0 = 6.2832 * hash12(gl_FragCoord.xy);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < BLUR_TAPS; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / float(BLUR_TAPS)) * radius;
      float a = angle0 + fi * 2.39996;
      vec2 offset = vec2(cos(a), sin(a)) * r / vec2(uAspect, 1.0);
      sum += textureLod(uVideo, toVideo(vUv + offset), lod).rgb;
    }
    color = sum / float(BLUR_TAPS);

    // Voile : la buée diffuse la lumière, éclaircit et désature l'image.
    float veil = uVeilOpacity * smoothstep(0.0, 1.0, d);
    color = mix(color, uFogColor, veil);
  }

  outColor = vec4(color, 1.0);
}
