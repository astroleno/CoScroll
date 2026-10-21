import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import ts from 'typescript';
import {DoubleSide, MeshPhysicalMaterial, ShaderChunk, ShaderLib, UniformsUtils} from 'three';

await mkdir(resolve('.cache'), {recursive:true});
const temporary = await mkdtemp(join(resolve('.cache'), 'physical-material-test-'));
let specializePhysicalMaterial;
try {
  const source = await readFile(new URL('../../src/components/jade/specializePhysicalMaterial.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2020}}).outputText;
  const path = join(temporary, 'specializePhysicalMaterial.mjs');
  await writeFile(path, compiled);
  ({specializePhysicalMaterial} = await import(pathToFileURL(path).href));
} finally {
  await rm(temporary, {recursive:true, force:true});
}

const parameters = {roughness:.82, metalness:0, ior:1.52, transmission:1, thickness:.24};
function compile(material) {
  const shader = {vertexShader:ShaderLib.physical.vertexShader,
    fragmentShader:ShaderLib.physical.fragmentShader, uniforms:UniformsUtils.clone(ShaderLib.physical.uniforms)};
  material.onBeforeCompile(shader, {});
  return shader;
}

test('specialization changes only fixed declarations, preserving the stock equations and sampling', () => {
  const beforeChunk = ShaderChunk.transmission_pars_fragment;
  const material = specializePhysicalMaterial(new MeshPhysicalMaterial(parameters));
  const shader = compile(material);
  let restored = shader.fragmentShader;
  for (const [name, value] of Object.entries(parameters)) {
    const match = new RegExp(`const float ${name} = ([^;]+);`).exec(restored);
    assert.ok(match, name);
    assert.equal(Math.fround(Number(match[1])), Math.fround(value));
    restored = restored.replace(match[0], `uniform float ${name};`);
  }
  restored = restored.replace(/const (float|vec2|vec3) (\w+) = [^;]+;/g, (match, type, name) => {
    if (['opacity', 'specularIntensity', 'diffuse', 'emissive', 'specularColor', 'normalScale'].includes(name)) return `uniform ${type} ${name};`;
    return match;
  });
  const expanded = ShaderLib.physical.fragmentShader
    .replace(/^[\t ]*#include +<transmission_pars_fragment>/gm, () => beforeChunk)
    .replace(/^[\t ]*#include +<normalmap_pars_fragment>/gm, () => ShaderChunk.normalmap_pars_fragment);
  assert.equal(restored, expanded);
  assert.equal(shader.vertexShader, ShaderLib.physical.vertexShader);
  assert.equal(ShaderChunk.transmission_pars_fragment, beforeChunk);
  assert.equal(material.transmission, 1);
});

test('fixed colors use the same float32 values as material uniform uploads', () => {
  const material = new MeshPhysicalMaterial({...parameters, color:'#2d6d8b', emissive:'#0f2b38', emissiveIntensity:12});
  const expected = material.emissive.toArray().map(value => Math.fround(value * 12));
  specializePhysicalMaterial(material);
  const match = /const vec3 emissive = vec3\(([^)]+)\);/.exec(compile(material).fragmentShader);
  assert.deepEqual(match[1].split(',').map(Number), expected);
  const backFaces = specializePhysicalMaterial(new MeshPhysicalMaterial({...parameters, side:DoubleSide}));
  assert.match(compile(backFaces).fragmentShader, /uniform vec2 normalScale;/);
});

test('program identity separates different constants and reuses equal float32 inputs', () => {
  const a = specializePhysicalMaterial(new MeshPhysicalMaterial(parameters));
  const b = specializePhysicalMaterial(new MeshPhysicalMaterial({...parameters, roughness:.85}));
  const equal = specializePhysicalMaterial(new MeshPhysicalMaterial({...parameters, roughness:Math.fround(.82)}));
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
  assert.equal(a.customProgramCacheKey(), equal.customProgramCacheKey());
  assert.equal(a.roughness, .82);
  assert.equal(b.roughness, .85);
});

test('an existing compile hook and custom program identity survive specialization', () => {
  const material = new MeshPhysicalMaterial(parameters);
  material.onBeforeCompile = shader => {shader.fragmentShader += '\n// original hook';};
  material.customProgramCacheKey = () => 'prior-key';
  specializePhysicalMaterial(material);
  assert.ok(compile(material).fragmentShader.endsWith('// original hook'));
  assert.ok(material.customProgramCacheKey().startsWith('prior-key|'));
});

test('non-finite scalars remain uniforms rather than producing invalid GLSL literals', () => {
  const material = new MeshPhysicalMaterial({...parameters, roughness:NaN, thickness:Infinity});
  material.color.r = NaN;
  specializePhysicalMaterial(material);
  const shader = compile(material);
  assert.match(shader.fragmentShader, /uniform float roughness;/);
  assert.match(shader.fragmentShader, /uniform float thickness;/);
  assert.match(shader.fragmentShader, /uniform vec3 diffuse;/);
  assert.doesNotMatch(shader.fragmentShader, /const float \w+ = (?:NaN|Infinity)/);
});

test('live jade colors do not change program identity or remove physical scalar specialization', () => {
  const a = specializePhysicalMaterial(new MeshPhysicalMaterial({...parameters, color: '#2d6d8b'}), {dynamicColors: true});
  const b = specializePhysicalMaterial(new MeshPhysicalMaterial({...parameters, color: '#36745a'}), {dynamicColors: true});
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
  const source = compile(a).fragmentShader;
  assert.match(source, /uniform vec3 diffuse;/);
  assert.match(source, /uniform vec3 emissive;/);
  assert.match(source, /const float transmission = 1.0;/);
  a.color.set('#8b7037');
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
  a.dispose(); b.dispose();
});
