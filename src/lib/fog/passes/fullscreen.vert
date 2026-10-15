#version 300 es
// Triangle plein écran généré à partir de gl_VertexID, sans buffer de sommets.
// - vUv : coordonnées « écran », origine en haut à gauche (comme coords.ts) ;
// - vTex : coordonnées de texture GL, origine en bas à gauche, pour lire une texture
//   dans laquelle on a dessiné (le champ de buée).
out vec2 vUv;
out vec2 vTex;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vTex = p;
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
