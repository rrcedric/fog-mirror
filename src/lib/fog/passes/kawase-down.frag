#version 300 es
precision mediump float;

// Flou « dual Kawase » (Bjørge, 2015), passe de réduction : 5 lectures, sortie deux fois plus petite.

in vec2 vTex;
out vec4 outColor;

uniform sampler2D uSource;
uniform vec2 uHalfTexel; // demi-texel de la source × étalement

void main() {
  vec4 sum = texture(uSource, vTex) * 4.0;
  sum += texture(uSource, vTex - uHalfTexel);
  sum += texture(uSource, vTex + uHalfTexel);
  sum += texture(uSource, vTex + vec2(uHalfTexel.x, -uHalfTexel.y));
  sum += texture(uSource, vTex - vec2(uHalfTexel.x, -uHalfTexel.y));
  outColor = sum / 8.0;
}
