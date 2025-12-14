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
  
  // Adjusted default position to 16. This moves the camera closer so the tree fills ~1/5 of the screen.
  const currentPos = useRef(new THREE.Vector3(0, 0, 16));
  const targetPos = useRef(new THREE.Vector3(0, 0, 16));

  useFrame((state, delta) => {
    // Enable gesture control whenever a hand is tracked (Open or Closed)
    if (isTracking) {
      // Mapping Hand Gestures to Camera Position
      
      // 1. Azimuth (Orbit Left/Right)
      const azimuth = (handX - 0.5) * 2.5; // range -1.25 to 1.25 radians
      
      // 2. Elevation (Orbit Up/Down)
      // Map 0..1 to +12 .. -6 (Wider range for far camera)
      const elevation = THREE.MathUtils.lerp(12, -6, handY);
      
      // 3. Distance (Zoom/Push/Pull)
      // handZ range ~0.1-0.3. 
      // New range: 28 (Far) to 10 (Close). Default start is 16.
      const zInput = THREE.MathUtils.clamp(handZ, 0.05, 0.35);
      const distance = THREE.MathUtils.mapLinear(zInput, 0.05, 0.35, 28, 10);

      // Convert Spherical to Cartesian
      targetPos.current.set(
        distance * Math.sin(azimuth),
        elevation,
        distance * Math.cos(azimuth)
      );

      // Lerp camera position for smoothness
      currentPos.current.lerp(targetPos.current, delta * 3); // Fast response
      
      camera.position.copy(currentPos.current);
      camera.lookAt(0, 0, 0); // Look at center
    } else {
       // When not tracking, we leave the camera where it is.
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
        {/* Adjusted default position to [0, 0, 16] */}
        <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={50} />
        
        {/* Gesture Controller */}
        <GestureController />

        {/* Dark Starry Background */}
        <color attach="background" args={['#020005']} />
        
        {/* Environment: Stars & Dust */}
        <Stars radius={100} depth={50} count={7000} factor={6} saturation={0} fade speed={0.5} />
        <Sparkles count={800} scale={20} size={4} speed={0.3} opacity={0.6} color="#ffd700" />
        
        {/* Warm Magical Lighting */}
        <ambientLight intensity={0.2} color="#503060" /> 
        <spotLight 
          position={[10, 20, 10]} 
          angle={0.5} 
          penumbra={1} 
          intensity={2.8} 
          color="#ffaa55" // Warm Golden Light
          castShadow 
          shadow-bias={-0.0001}
        />
        <pointLight position={[-8, 6, -8]} intensity={2} color="#cc33ff" distance={30} /> 
        <pointLight position={[0, -2, 5]} intensity={1} color="#ff3333" distance={20} /> 
        
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