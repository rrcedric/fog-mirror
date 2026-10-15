#version 300 es
precision mediump float;

// Copie réduite du champ de buée dans une texture 8 bits, relue par le processeur.

in vec2 vTex;
out vec4 outColor;

uniform sampler2D uField;

void main() {
  outColor = vec4(texture(uField, vTex).rg, 0.0, 1.0);
}
