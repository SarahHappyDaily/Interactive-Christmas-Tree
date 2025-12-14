import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { OrbitControls, Environment, PerspectiveCamera, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import LuxuryTree from './components/ParticleTree'; 
import VisionManager from './components/VisionManager';
import { useTreeStore } from './store';

// Camera Controller Component
const GestureController = () => {
  const { camera } = useThree();
  const { handX, handY, handZ, isTracking } = useTreeStore();
  
  // Smooth damped values
  const currentPos = useRef(new THREE.Vector3(0, 2, 14));
  const targetPos = useRef(new THREE.Vector3(0, 2, 14));

  useFrame((state, delta) => {
    // Enable gesture control whenever a hand is tracked (Open or Closed)
    if (isTracking) {
      // Mapping Hand Gestures to Camera Position
      
      // 1. Azimuth (Orbit Left/Right)
      // handX 0 (Left) -> Angle -1.5 rad
      // handX 1 (Right) -> Angle +1.5 rad
      // handX 0.5 (Center) -> Angle 0
      const azimuth = (handX - 0.5) * 2.5; // range -1.25 to 1.25 radians
      
      // 2. Elevation (Orbit Up/Down)
      // handY 0 (Top) -> Look from Above (High Y)
      // handY 1 (Bottom) -> Look from Below (Low Y)
      // Map 0..1 to +8 .. -2
      const elevation = THREE.MathUtils.lerp(8, -2, handY);
      
      // 3. Distance (Zoom/Push/Pull)
      // handZ is proxy for scale/closeness.
      // Small handZ (0.1) -> Hand Far -> Camera Far (Zoom Out)
      // Large handZ (0.3) -> Hand Close -> Camera Close (Zoom In)
      // We map handZ range ~0.1-0.3 to Distance 25-8
      // Clamp handZ input first to avoid extreme jumps
      const zInput = THREE.MathUtils.clamp(handZ, 0.05, 0.35);
      const distance = THREE.MathUtils.mapLinear(zInput, 0.05, 0.35, 22, 6);

      // Convert Spherical to Cartesian
      // x = d * sin(azimuth)
      // z = d * cos(azimuth)
      // y = elevation
      targetPos.current.set(
        distance * Math.sin(azimuth),
        elevation,
        distance * Math.cos(azimuth)
      );

      // Lerp camera position for smoothness
      currentPos.current.lerp(targetPos.current, delta * 3); // Fast response
      
      camera.position.copy(currentPos.current);
      camera.lookAt(0, 3, 0); // Look at tree center
    } else {
       // When not tracking, we leave the camera where it is.
       // OrbitControls can take over if enabled in App, but we need to sync position
       currentPos.current.copy(camera.position);
    }
  });

  return null;
};

const App: React.FC = () => {
  const { isTracking } = useTreeStore();

  return (
    <div className="relative w-full h-screen bg-[#020205]">
      
      {/* 2. Vision Logic (Webcam) */}
      <VisionManager />

      {/* 3. 3D Scene */}
      <Canvas
        dpr={[1, 2]} 
        gl={{ antialias: false, toneMappingExposure: 1.2 }} 
        shadows
      >
        <PerspectiveCamera makeDefault position={[0, 2, 14]} fov={50} />
        
        {/* Gesture Controller */}
        <GestureController />

        {/* Dark Starry Background */}
        <color attach="background" args={['#020005']} />
        
        {/* Environment: Stars & Dust */}
        <Stars radius={100} depth={50} count={7000} factor={6} saturation={0} fade speed={0.5} />
        <Sparkles count={800} scale={15} size={4} speed={0.3} opacity={0.6} color="#ffd700" />
        
        {/* Warm Magical Lighting */}
        <ambientLight intensity={0.2} color="#503060" /> 
        <spotLight 
          position={[10, 20, 10]} 
          angle={0.5} 
          penumbra={1} 
          intensity={2.8} // Reduced from 4 (approx 30%)
          color="#ffaa55" // Warm Golden Light
          castShadow 
          shadow-bias={-0.0001}
        />
        <pointLight position={[-8, 6, -8]} intensity={2} color="#cc33ff" distance={20} /> 
        <pointLight position={[0, -2, 5]} intensity={1} color="#ff3333" distance={10} /> 
        
        <Environment preset="city" blur={0.8} />

        <Suspense fallback={null}>
          <LuxuryTree />
          
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.5} radius={0.5} />
            <Vignette eskil={false} offset={0.1} darkness={0.8} />
            <Noise opacity={0.02} />
          </EffectComposer>
        </Suspense>

        {/* Controls: Disabled when tracking active to prevent conflict */}
        <OrbitControls 
          enabled={!isTracking}
          enableZoom={true} 
          enablePan={false} 
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.6}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
      
      <div className="absolute bottom-6 w-full text-center text-amber-500/20 text-[10px] tracking-[0.5em] pointer-events-none font-mono">
        MERRY CHRISTMAS • 2024
      </div>
    </div>
  );
};

export default App;