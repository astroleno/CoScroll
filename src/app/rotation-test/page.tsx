"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import JadeModelLoader from '@/components/jade/JadeModelLoader';

/**
 * Rotation Control Test Page
 * Demonstrates the improved rotation control system with:
 * - Speed limits and damping
 * - Smooth transitions
 * - Velocity filtering
 * - Maximum rotation per frame
 */
export default function RotationTestPage() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [testMode, setTestMode] = useState<'normal' | 'rapid' | 'transition'>('normal');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const velocityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate different scroll velocity patterns
  useEffect(() => {
    if (velocityIntervalRef.current) {
      clearInterval(velocityIntervalRef.current);
    }

    switch (testMode) {
      case 'normal':
        setScrollVelocity(0.3);
        break;
      case 'rapid':
        let rapidCount = 0;
        velocityIntervalRef.current = setInterval(() => {
          // Rapid changes that would previously cause uncontrolled spinning
          const velocities = [2.0, -1.5, 3.0, -2.5, 1.8, -1.2, 2.8, -2.0];
          setScrollVelocity(velocities[rapidCount % velocities.length]);
          rapidCount++;
        }, 800);
        break;
      case 'transition':
        // Simulate background to foreground transition
        let transitionPhase = 0;
        velocityIntervalRef.current = setInterval(() => {
          if (transitionPhase === 0) {
            setScrollVelocity(0.1); // Background state
            setIsTransitioning(false);
          } else if (transitionPhase === 3) {
            setScrollVelocity(3.0); // Rapid scroll (foreground)
            setIsTransitioning(true);
          } else if (transitionPhase === 6) {
            setScrollVelocity(0.2); // Back to background
            setIsTransitioning(true);
          } else {
            setIsTransitioning(false);
          }
          transitionPhase = (transitionPhase + 1) % 10;
        }, 1000);
        break;
    }

    return () => {
      if (velocityIntervalRef.current) {
        clearInterval(velocityIntervalRef.current);
      }
    };
  }, [testMode]);

  const handleManualScroll = (event: React.ChangeEvent<HTMLInputElement>) => {
    setScrollVelocity(parseFloat(event.target.value));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Jade Model Rotation Control Test</h1>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Control Panel</h2>

          <div className="space-y-4">
            {/* Test Mode Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Test Mode</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setTestMode('normal')}
                  className={`px-4 py-2 rounded ${
                    testMode === 'normal'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setTestMode('rapid')}
                  className={`px-4 py-2 rounded ${
                    testMode === 'rapid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Rapid Changes
                </button>
                <button
                  onClick={() => setTestMode('transition')}
                  className={`px-4 py-2 rounded ${
                    testMode === 'transition'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Transitions
                </button>
              </div>
            </div>

            {/* Manual Velocity Control */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Manual Scroll Velocity: {scrollVelocity.toFixed(2)}
              </label>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={scrollVelocity}
                onChange={handleManualScroll}
                className="w-full"
              />
            </div>

            {/* Status Display */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Current Mode:</span>
                <span className="ml-2 font-mono">{testMode}</span>
              </div>
              <div>
                <span className="text-gray-400">Transitioning:</span>
                <span className={`ml-2 font-mono ${isTransitioning ? 'text-yellow-400' : 'text-green-400'}`}>
                  {isTransitioning ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Velocity:</span>
                <span className="ml-2 font-mono">{scrollVelocity.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Max Angular:</span>
                <span className="ml-2 font-mono">1.5 rad/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Model Display */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">3D Jade Model</h2>
          <div className="h-96 bg-gray-900 rounded-lg overflow-hidden">
            <Canvas
              camera={{ position: [0, 0, 5], fov: 45 }}
              gl={{
                alpha: true,
                antialias: true
              }}
            >
              <ambientLight intensity={0.4} />
              <directionalLight position={[2, 2, 2]} intensity={1.2} />
              <Environment
                files="/textures/qwantani_moon_noon_puresky_1k.hdr"
                background={false}
              />

              <JadeModelLoader
                modelPath="/models/10k_obj/001_空.obj"
                fitToView={true}
                enableRotation={true}
                rotationDurationSec={8}
                enableScrollControl={true}
                baseSpeed={0.1}
                speedMultiplier={1.0}
                externalVelocity={scrollVelocity}
                // Enhanced rotation control parameters
                maxAngularVelocity={1.5}
                enableDamping={true}
                dampingFactor={0.92}
                velocitySmoothing={0.15}
                maxRotationPerFrame={0.08}
                // Jade material properties
                innerColor="#2d6d8b"
                innerMetalness={1.0}
                innerRoughness={1.0}
                innerTransmission={0.0}
                enableEmissive={true}
                innerEmissiveColor="#0f2b38"
                innerEmissiveIntensity={12.0}
                innerEnvMapIntensity={2.0}
                outerColor="#ffffff"
                outerMetalness={0.0}
                outerRoughness={0.85}
                outerTransmission={1.0}
                outerIor={1.5}
                outerReflectivity={0.30}
                outerThickness={0.24}
                outerClearcoat={0.0}
                outerClearcoatRoughness={1.0}
                outerEnvMapIntensity={5.0}
                outerOffset={0.001}
                creaseAngle={30}
                smoothShading={true}
                innerSmoothShading={true}
                outerSmoothShading={true}
              />

              <OrbitControls enableZoom={true} enablePan={false} />
            </Canvas>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Test Instructions</h2>
          <div className="space-y-3 text-gray-300">
            <p><strong>Normal Mode:</strong> Shows smooth rotation with minimal velocity.</p>
            <p><strong>Rapid Changes Mode:</strong> Simulates fast scroll velocity changes that would previously cause uncontrolled spinning.</p>
            <p><strong>Transitions Mode:</strong> Demonstrates smooth background/foreground state transitions.</p>
            <p><strong>Manual Control:</strong> Use the slider to directly control scroll velocity and test the limits.</p>
          </div>

          <div className="mt-6 p-4 bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">Key Improvements:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>Maximum angular velocity limits prevent excessive spinning</li>
              <li>Damping system naturally stops rotation when input stops</li>
              <li>Velocity smoothing prevents sudden changes</li>
              <li>Maximum rotation per frame prevents jittery movement</li>
              <li>Smooth transitions between background and foreground states</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}