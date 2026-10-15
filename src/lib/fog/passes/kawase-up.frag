#version 300 es
precision mediump float;

// Flou « dual Kawase », passe d'agrandissement : 8 lectures, sortie deux fois plus grande.

in vec2 vTex;
out vec4 outColor;

uniform sampler2D uSource;
uniform vec2 uHalfTexel; // demi-texel de la source × étalement

void main() {
  vec2 h = uHalfTexel;
  vec4 sum = texture(uSource, vTex + vec2(-h.x * 2.0, 0.0));
  sum += texture(uSource, vTex + vec2(-h.x, h.y)) * 2.0;
  sum += texture(uSource, vTex + vec2(0.0, h.y * 2.0));
  sum += texture(uSource, vTex + vec2(h.x, h.y)) * 2.0;
  sum += texture(uSource, vTex + vec2(h.x * 2.0, 0.0));
  sum += texture(uSource, vTex + vec2(h.x, -h.y)) * 2.0;
  sum += texture(uSource, vTex + vec2(0.0, -h.y * 2.0));
  sum += texture(uSource, vTex + vec2(-h.x, -h.y)) * 2.0;
  outColor = sum / 12.0;
}
