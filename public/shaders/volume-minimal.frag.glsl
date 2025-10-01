precision highp float;
precision highp sampler3D;

uniform sampler3D uVolumeTexture;
uniform float uTime;
uniform vec3 uCameraPos;
uniform bool uDebug;
uniform bool uSolid;
uniform mat4 uModelMatrixInv;

varying vec3 vWorldPos;
varying vec3 vNormal;

vec3 worldToUVW(vec3 worldPos) {
  // 使用模型逆矩阵将世界坐标转为局部坐标（归一化到[-1,1]盒）
  vec3 localPos = (uModelMatrixInv * vec4(worldPos, 1.0)).xyz;
  return (localPos + 1.0) * 0.5;
}

void main() {
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - uCameraPos);

  if (uSolid) {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    return;
  }

  // 调试路径：直接显示当前片元位置对应的体素灰度
  if (uDebug) {
    vec3 uvwDbg = worldToUVW(vWorldPos);
    float v = texture(uVolumeTexture, uvwDbg).r;
    gl_FragColor = vec4(vec3(v), 1.0);
    return;
  }

  // AABB 相交测试：在模型局部空间进行
  vec3 localOrigin = (uModelMatrixInv * vec4(rayOrigin, 1.0)).xyz;
  vec3 localDir = normalize((uModelMatrixInv * vec4(rayDir, 0.0)).xyz);
  vec3 boxMin = vec3(-1.0);
  vec3 boxMax = vec3(1.0);
  vec3 invDir = 1.0 / localDir;
  vec3 t0 = (boxMin - localOrigin) * invDir;
  vec3 t1 = (boxMax - localOrigin) * invDir;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  float tEnter = max(max(tMin.x, tMin.y), tMin.z);
  float tExit  = min(min(tMax.x, tMax.y), tMax.z);
  if (tExit <= max(0.0, tEnter)) discard; // 未命中体积

  const int MAX_STEPS = 8;
  float stepSize = 2.5 / float(MAX_STEPS);

  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float t = max(0.0, tEnter);

  for (int i = 0; i < MAX_STEPS; i++) {
    // 在世界空间推进，但采样与裁剪在局部空间
    vec3 p = rayOrigin + rayDir * t;
    vec3 uvw = worldToUVW(p);

    if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
      break;
    }

    float sdf = texture(uVolumeTexture, uvw).r * 2.0 - 1.0;
    float density = smoothstep(0.1, -0.1, sdf);

    if (density > 0.01) {
      vec3 sampleColor = vec3(0.3, 0.8, 0.6);
      float sampleAlpha = density * stepSize;
      color += sampleColor * sampleAlpha * (1.0 - alpha);
      alpha += sampleAlpha * (1.0 - alpha);
    }

    if (alpha > 0.95) break;
    t += stepSize;
  }

  gl_FragColor = vec4(color, alpha);
}


