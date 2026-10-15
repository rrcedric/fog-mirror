#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVideo;
// videoUV = mirror(screenUV) * uCoverScale + uCoverOffset (voir coords.ts)
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;

void main() {
  vec2 videoUv = vec2(1.0 - vUv.x, vUv.y) * uCoverScale + uCoverOffset;
  outColor = vec4(texture(uVideo, videoUv).rgb, 1.0);
}
