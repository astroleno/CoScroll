import { FrontSide, MeshPhysicalMaterial, ShaderChunk } from 'three';

// These values are fixed for the lifetime of the loader's memoized material.
// The loader creates a new material when a corresponding prop changes. Keeping
// the original equations lets the driver remove constant work (e.g. metalness
// 1 or transmission 1) without replacing Three's physical shading model.
const STATIC_PARAMETERS = [
  'roughness', 'metalness', 'ior', 'transmission', 'thickness', 'opacity', 'specularIntensity',
] as const;
const PROGRAM_VERSION = 'coscroll-physical-static-v2';

interface FixedBinding {
  name: string;
  type: 'float' | 'vec2' | 'vec3';
  literal: string | null;
}

function floatLiteral(value: number): string | null {
  const rounded = Math.fround(value);
  if (!Number.isFinite(rounded)) return null;
  if (Object.is(rounded, -0)) return '-0.0';
  const literal = String(rounded);
  return /[.e]/i.test(literal) ? literal : `${literal}.0`;
}

function vectorLiteral(values: number[]): string | null {
  const components = values.map(floatLiteral);
  return components.some(value => value === null) ? null : `vec${values.length}(${components.join(', ')})`;
}

export function specializePhysicalMaterial(material: MeshPhysicalMaterial, options: {dynamicColors?: boolean} = {}): MeshPhysicalMaterial {
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;
  const values: FixedBinding[] = STATIC_PARAMETERS.map(name => ({
    name, type: 'float', literal: floatLiteral(material[name]),
  }));
  if (!options.dynamicColors) values.push(
    {name: 'diffuse', type: 'vec3', literal: vectorLiteral(material.color.toArray())},
    {
      name: 'emissive', type: 'vec3',
      literal: vectorLiteral(material.emissive.toArray().map(value => value * material.emissiveIntensity)),
    },
  );
  values.push({name: 'specularColor', type: 'vec3', literal: vectorLiteral(material.specularColor.toArray())});
  // Three flips normalScale while drawing back faces of a double-sided
  // transmissive object. Only specialize it for the loader's front-side layers.
  if (material.side === FrontSide) {
    values.push({name: 'normalScale', type: 'vec2', literal: vectorLiteral(material.normalScale.toArray())});
  }
  const signature = JSON.stringify(values);

  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    // Expand only the public chunks declaring fixed values; keep their equations
    // and the renderer's stock transmission passes intact.
    let fragment = shader.fragmentShader;
    for (const name of ['transmission_pars_fragment', 'normalmap_pars_fragment'] as const) {
      fragment = fragment.replace(new RegExp(`^[\\t ]*#include +<${name}>`, 'gm'), () => ShaderChunk[name]);
    }
    for (const {name, type, literal} of values) {
      if (literal === null) continue;
      fragment = fragment.replace(
        new RegExp(`\\buniform\\s+${type}\\s+${name}\\s*;`, 'g'),
        `const ${type} ${name} = ${literal};`,
      );
    }
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = function() {
    return `${previousCacheKey.call(this)}|${PROGRAM_VERSION}|${signature}`;
  };
  return material;
}
