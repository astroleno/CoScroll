// 纯几何 mask shader：内=1，外=0，不混入任何 Fresnel/噪声
precision mediump float;
void main(){
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
