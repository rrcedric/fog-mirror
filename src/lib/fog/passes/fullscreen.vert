#version 300 es
// Triangle plein écran généré à partir de gl_VertexID, sans buffer de sommets.
// vUv a son origine en haut à gauche, comme les coordonnées « écran » de coords.ts.
out vec2 vUv;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
