
 
1 of 1 unhandled error
Next.js (14.0.4) is outdated (learn more)

Unhandled Runtime Error
TypeError: Cannot read properties of undefined (reading 'uTime')

Source
src/components/volume/VolumeRenderer.tsx (195:26) @ uTime

  193 | if (volumeMesh) {
  194 |   const material = volumeMesh.material as THREE.ShaderMaterial;
> 195 |   material.uniforms.uTime.value = elapsed;
      |                    ^
  196 |   material.uniforms.uCameraPos.value.copy(camera.position);
  197 |   material.uniforms.uModelMatrixInv.value.copy(volumeMesh.matrixWorld).invert();
  198 | }