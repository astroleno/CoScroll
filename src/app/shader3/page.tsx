'use client'

import React, { useState } from 'react'
import { Shader3Model3D } from '@/components/core/Shader3'

export default function Shader3DemoPage() {
  const [preset, setPreset] = useState<'soft' | 'default' | 'intense'>('default')

  const presets = {
    default: {
      mainColor: '#ffb27d',
      secondaryColor: '#7dbbff',
      rimColor: '#ffd6c2',
      fresnelIntensity: 2.4,
      innerGlowIntensity: 1.8,
      gradientStrength: 0.55,
      grainIntensity: 0.55,
      breathingSpeed: 0.6,
      noiseScale: 1.2,
      noiseLayers: 4,
      noiseAmplitude: 0.6
    },
    soft: {
      mainColor: '#f6c9a8',
      secondaryColor: '#a8c8f6',
      rimColor: '#ffe8d8',
      fresnelIntensity: 1.8,
      innerGlowIntensity: 1.2,
      gradientStrength: 0.4,
      grainIntensity: 0.35,
      breathingSpeed: 0.5,
      noiseScale: 1.0,
      noiseLayers: 3,
      noiseAmplitude: 0.45
    },
    intense: {
      mainColor: '#ffad66',
      secondaryColor: '#66b3ff',
      rimColor: '#ffd1b3',
      fresnelIntensity: 3.0,
      innerGlowIntensity: 2.3,
      gradientStrength: 0.65,
      grainIntensity: 0.7,
      breathingSpeed: 0.8,
      noiseScale: 1.6,
      noiseLayers: 5,
      noiseAmplitude: 0.8
    }
  } as const

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background:'#000' }}>
      <div style={{ padding: 12, display: 'flex', gap: 8 }}>
        <span>Preset:</span>
        {(['soft','default','intense'] as const).map(k => (
          <button
            key={k}
            onClick={() => setPreset(k)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #ddd',
              background: preset === k ? '#111' : '#fff',
              color: preset === k ? '#fff' : '#111',
              cursor: 'pointer'
            }}
          >{k}</button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <Shader3Model3D
          modelPath={'/models/10k/003_道.glb'}
          config={presets[preset]}
          autoRotate
        />
      </div>
    </div>
  )
}


