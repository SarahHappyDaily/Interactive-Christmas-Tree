import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useLoader, extend } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { TextGeometry, FontLoader, MeshSurfaceSampler } from 'three-stdlib';
import { useTreeStore } from '../store';
import { foliageVertexShader, foliageFragmentShader, textVertexShader, textFragmentShader } from './TreeShaders';

// Extend for declarative use if needed
extend({ TextGeometry });

/**
 * Constants & Helpers
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TREE_HEIGHT = 7;
const TREE_WIDTH = 3.5;

// Insightful, Cheerful & Wise Quotes
const BLESSINGS = [
  "Keep your face\nalways toward\nthe sunshine.",
  "Turn your\nwounds into\nwisdom.",
  "Happiness\ndepends upon\nourselves.",
  "Believe you\ncan and you're\nhalfway there.",
  "It is never\ntoo late to be\nwhat you might\nhave been.",
  "Life is\neither a daring\nadventure or\nnothing.",
  "The best way\nto predict the\nfuture is to\ncreate it.",
  "You are\nnever too old\nto set another\ngoal.",
  "Spread love\neverywhere\nyou go.",
  "Every moment\nis a fresh\nbeginning.",
  "Simplicity is\nthe ultimate\nsophistication.",
  "Everything\nyou can imagine\nis real.",
  "Hope is\na waking\ndream.",
  "Do what\nyou love,\nlove what\nyou do.",
  "Peace begins\nwith a\nsmile.",
  "Dream big\nand dare\nto fail.",
  "Be the\nchange you\nwish to see.",
  "Silence is\na true friend\nwho never\nbetrays.",
  "Knowledge\nspeaks, but\nwisdom listens.",
  "Stars can't\nshine without\ndarkness.",
  "Count your\nage by friends,\nnot years.",
  "Life isn't about\nfinding yourself.\nIt's about\ncreating yourself.",
  "Rise above\nthe storm and\nyou will find\nthe sunshine.",
  "A joyous heart\nis the inevitable\nresult of a heart\nburning with love.",
  "Difficult roads\noften lead to\nbeautiful destinations.",
  "Your time\nis limited,\ndon't waste it.",
  "Wherever life\nplants you,\nbloom with grace.",
  "The journey\nof a thousand\nmiles begins\nwith one step.",
  "Kindness is\nfree, sprinkle\nit everywhere.",
  "Don't count\nthe days,\nmake the\ndays count."
];

// Generate a texture for the message card with varied styles and handwriting fonts
const createMessageTexture = (text: string, styleIndex: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512; 
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Define 4 distinct stationery styles with Handwriting Fonts
  const styles = [
    // 1. Vintage Kraft Paper
    { 
      bg: '#e8dcca', 
      text: '#4a3b2a', 
      border: '#8d6e63',
      font: '"Indie Flower", cursive', // Casual handwritten
      decorType: 'dashed'
    },
    // 2. Soft Pink Love Letter
    { 
      bg: '#fff0f5', 
      text: '#c2185b', 
      border: '#f48fb1',
      font: '"Great Vibes", cursive', // Elegant script
      decorType: 'hearts'
    },
    // 3. Winter Frost
    { 
      bg: '#e3f2fd', 
      text: '#01579b', 
      border: '#81d4fa',
      font: '"Caveat", cursive', // Playful marker
      decorType: 'snow'
    },
    // 4. Festive Holiday
    { 
      bg: '#fff8e1', 
      text: '#b71c1c', 
      border: '#ff6f00', 
      font: '"Dancing Script", cursive', // Rythmic script
      decorType: 'double'
    }
  ];

  const style = styles[styleIndex % styles.length];

  // Fill Background
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, 512, 640);

  // Decorations
  if (style.decorType === 'dashed') {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 15]);
    ctx.strokeRect(25, 25, 462, 590);
    ctx.setLineDash([]);
  } else if (style.decorType === 'hearts') {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 472, 600);
    // Draw dots as abstract hearts
    ctx.fillStyle = style.border;
    [40, 256, 472].forEach(x => {
        ctx.beginPath(); ctx.arc(x, 40, 10, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, 600, 10, 0, Math.PI*2); ctx.fill();
    });
  } else if (style.decorType === 'snow') {
     ctx.fillStyle = '#e1f5fe'; // Subtle lines
     for(let i=0; i<10; i++) ctx.fillRect(0, 60 + i*60, 512, 2);
     
     ctx.strokeStyle = style.border;
     ctx.lineWidth = 12;
     ctx.strokeRect(10, 10, 492, 620);
  } else {
     // Double border
     ctx.strokeStyle = style.border;
     ctx.lineWidth = 15;
     ctx.strokeRect(20, 20, 472, 600);
     ctx.lineWidth = 2;
     ctx.strokeRect(45, 45, 422, 550);
  }

  // Text Configuration
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.text;
  
  // Font logic - 60px to be legible
  ctx.font = `60px ${style.font}`;

  const lines = text.split('\n');
  const lineHeight = 75;
  const startY = 320 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, 256, startY + i * lineHeight);
  });
  
  // Footer Decoration
  ctx.font = `30px ${style.font}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText('~ Wisdom ~', 256, 580);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Anisotropy helps with oblique angles
  tex.anisotropy = 8;
  return tex;
};


// Helper to generate chaos position (random sphere)
const getChaosPos = (scale = 10, minRatio = 0) => {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  
  // Uniform volume distribution shell
  const minVol = Math.pow(minRatio, 3);
  const rRandom = Math.random() * (1 - minVol) + minVol;
  const r = Math.cbrt(rRandom) * scale;
  
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// Helper to generate tree position (Cone Shell)
const getTreePos = (t: number, theta: number, height: number, width: number) => {
  const y = height * t - height / 2;
  // STRICT shell: radius is fixed based on height
  const radius = width * (1 - t);
  const x = radius * Math.cos(theta);
  const z = radius * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
};

/**
 * Sub-Component: The Holy Star
 */
const HolyStar = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const ref = useRef<THREE.Group>(null);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 0.5;
    const innerRadius = 0.2;

    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const a = (i / points) * Math.PI;
      const x = r * Math.sin(a);
      const y = r * Math.cos(a);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2
  }), []);

  useFrame((state, delta) => {
    if (ref.current) {
      const progress = progressRef.current;
      ref.current.rotation.y += delta * 0.5;
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      
      const targetScale = 1 + progress * 0.5; 
      const currentScale = ref.current.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 3);
      ref.current.scale.setScalar(newScale);
    }
  });

  return (
    <group ref={ref} position={[0, TREE_HEIGHT / 2 + 0.3, 0]}>
      <mesh>
        <extrudeGeometry args={[starShape, extrudeSettings]} />
        <meshStandardMaterial 
          color="#ffddaa" 
          emissive="#ffaa00" 
          emissiveIntensity={2.0} 
          roughness={0.1}
          metalness={1.0}
        />
      </mesh>
      <pointLight intensity={1.5} color="#ffaa00" distance={5} decay={2} />
    </group>
  );
};

/**
 * Sub-Component: 3D Particle Text
 */
const ParticleText = ({ text, position, size = 1.2, density = 2500, progressRef }: { text: string, position: [number, number, number], size?: number, density?: number, progressRef: React.MutableRefObject<number> }) => {
  const font = useLoader(FontLoader, 'https://cdn.jsdelivr.net/npm/three/examples/fonts/optimer_bold.typeface.json');
  const meshRef = useRef<THREE.Points>(null);
  
  const { geometry, uniforms } = useMemo(() => {
    if (!font) return { geometry: null, uniforms: null };

    const textGeo = new TextGeometry(text, {
      font: font,
      size: size,
      height: 0.2, 
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 3,
    });
    
    textGeo.center(); 
    
    const tempMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
    const sampler = new MeshSurfaceSampler(tempMesh).build();
    
    const count = density; 
    const aTargetPos = new Float32Array(count * 3);
    const aChaosPos = new Float32Array(count * 3);
    const aRandom = new Float32Array(count);
    
    const tempPos = new THREE.Vector3();
    
    for (let i = 0; i < count; i++) {
        sampler.sample(tempPos);
        aTargetPos[i * 3] = tempPos.x;
        aTargetPos[i * 3 + 1] = tempPos.y;
        aTargetPos[i * 3 + 2] = tempPos.z;
        
        // Scatter distance 20x for clean text
        const scatter = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5))
          .normalize()
          .multiplyScalar((Math.random() * 5 + 2) * 20);
        
        aChaosPos[i * 3] = tempPos.x + scatter.x;
        aChaosPos[i * 3 + 1] = tempPos.y + scatter.y;
        aChaosPos[i * 3 + 2] = tempPos.z + scatter.z;
        
        aRandom[i] = Math.random();
    }
    
    const bufferGeo = new THREE.BufferGeometry();
    bufferGeo.setAttribute('position', new THREE.BufferAttribute(aTargetPos, 3));
    bufferGeo.setAttribute('aTargetPos', new THREE.BufferAttribute(aTargetPos, 3));
    bufferGeo.setAttribute('aChaosPos', new THREE.BufferAttribute(aChaosPos, 3));
    bufferGeo.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 1));
    
    const unis = {
        uTime: { value: 0 },
        uProgress: { value: 0 },
    };

    return { geometry: bufferGeo, uniforms: unis };
  }, [font, text, size, density]);

  useFrame((state) => {
    if (meshRef.current && uniforms) {
        uniforms.uTime.value = state.clock.elapsedTime;
        uniforms.uProgress.value = THREE.MathUtils.lerp(uniforms.uProgress.value, progressRef.current, 0.1);
    }
  });

  if (!geometry) return null;

  return (
    <group position={position}>
       <points ref={meshRef} geometry={geometry}>
          <shaderMaterial 
             vertexShader={textVertexShader}
             fragmentShader={textFragmentShader}
             uniforms={uniforms}
             transparent
             depthWrite={false}
             blending={THREE.AdditiveBlending}
          />
       </points>
    </group>
  );
};

/**
 * Sub-Component: Gift Pile
 */
const GiftPile = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const count = 35; 
  const gifts = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.2 + 1.2; 
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = -TREE_HEIGHT/2 + (Math.random() * 0.8) - 0.2; 
      const scale = Math.random() * 0.4 + 0.3;
      const palettes = [
          { box: '#b30000', ribbon: '#ffbf00' }, 
          { box: '#005500', ribbon: '#b30000' }, 
          { box: '#f0f0f0', ribbon: '#b30000' }, 
          { box: '#b30000', ribbon: '#f0f0f0' }, 
          { box: '#002244', ribbon: '#c0c0c0' }, 
          { box: '#ffbf00', ribbon: '#f0f0f0' }, 
      ];
      const theme = palettes[Math.floor(Math.random() * palettes.length)];
      return { 
          pos: new THREE.Vector3(x, y, z), 
          scale, 
          boxColor: theme.box, 
          ribbonColor: theme.ribbon,
          rot: new THREE.Euler(0, Math.random() * Math.PI * 2, 0) 
      };
    });
  }, []);

  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (ref.current) {
        const progress = progressRef.current;
        const s = 1 + progress * 0.5; // Reduce scale up
        ref.current.scale.setScalar(s);
        ref.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <group ref={ref}>
       {gifts.map((d, i) => (
         <GiftBox key={i} {...d} />
       ))}
    </group>
  );
}

const GiftBox = ({ pos, scale, boxColor, ribbonColor, rot }: any) => {
  return (
    <group position={pos} rotation={rot} scale={[scale, scale, scale]}>
       <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={boxColor} roughness={0.3} />
       </mesh>
       <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.02, 1.02, 0.15]} />
          <meshStandardMaterial color={ribbonColor} metalness={0.3} roughness={0.2} />
       </mesh>
       <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.15, 1.02, 1.02]} />
          <meshStandardMaterial color={ribbonColor} metalness={0.3} roughness={0.2} />
       </mesh>
       <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusKnotGeometry args={[0.22, 0.04, 64, 8, 2, 3]} /> 
            <meshStandardMaterial color={ribbonColor} metalness={0.3} roughness={0.2} />
       </mesh>
    </group>
  )
}

/**
 * Sub-Component: Foliage (Particle System)
 */
const Foliage = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  // Increased count to 9000 for Denser Surface
  const count = 9000;
  const meshRef = useRef<THREE.Points>(null);
  
  const { aTargetPos, aChaosPos, aRandom } = useMemo(() => {
    const target = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const random = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Uniform Cone Distribution
      const t = 1 - Math.sqrt((i + 1) / (count + 1));
      const theta = i * GOLDEN_ANGLE;
      
      const tPos = getTreePos(t, theta, TREE_HEIGHT, TREE_WIDTH);
      
      // REDUCED NOISE: Keep particles tight to the "Shell" (surface)
      const noiseAmp = 0.05;
      tPos.x += (Math.random() - 0.5) * noiseAmp;
      tPos.y += (Math.random() - 0.5) * noiseAmp;
      tPos.z += (Math.random() - 0.5) * noiseAmp;
      
      target[i * 3] = tPos.x;
      target[i * 3 + 1] = tPos.y;
      target[i * 3 + 2] = tPos.z;

      // Chaos distribution
      // UPDATED: Scatter radius decreased to 125 (was 250) based on user request (50% reduction)
      const cPos = getChaosPos(125, 0.5);
      chaos[i * 3] = cPos.x;
      chaos[i * 3 + 1] = cPos.y;
      chaos[i * 3 + 2] = cPos.z;

      random[i] = Math.random();
    }
    return { aTargetPos: target, aChaosPos: chaos, aRandom: random };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uSize: { value: 1.8 }, 
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uProgress.value = THREE.MathUtils.lerp(mat.uniforms.uProgress.value, progressRef.current, 0.1);
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={aTargetPos} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={aTargetPos} itemSize={3} />
        <bufferAttribute attach="attributes-aChaosPos" count={count} array={aChaosPos} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={aRandom} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={foliageVertexShader}
        fragmentShader={foliageFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/**
 * Sub-Component: Ornaments (Balls & Gifts)
 */
const OrnamentLayer = ({ 
  count, 
  color, 
  geometry, 
  scaleBase,
  progressRef,
  emissiveIntensity = 0.3
}: { 
  count: number, 
  color: string, 
  geometry: THREE.BufferGeometry, 
  scaleBase: number,
  progressRef: React.MutableRefObject<number>,
  emissiveIntensity?: number
}) => {
  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const t = 1 - Math.sqrt((i + 1) / (count + 1));
      const theta = i * GOLDEN_ANGLE * 13.0; 
      return {
        target: getTreePos(t, theta, TREE_HEIGHT, TREE_WIDTH * 0.9),
        chaos: getChaosPos(20, 0.3),
        scale: Math.random() * 0.5 + 0.5,
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      }
    });
  }, [count]);

  return (
    <Instances range={count} geometry={geometry}>
      <meshStandardMaterial 
        color={color} 
        roughness={0.2} 
        metalness={0.9} 
        emissive={color}
        emissiveIntensity={emissiveIntensity}
      />
      {data.map((d, i) => (
        <OrnamentInstance 
          key={i} 
          data={d} 
          scaleBase={scaleBase} 
          progressRef={progressRef} 
        />
      ))}
    </Instances>
  );
};

const OrnamentInstance = ({ data, scaleBase, progressRef }: any) => {
  const ref = useRef<any>(null);
  const { target, chaos, scale } = data;
  const currentPos = useRef(target.clone());

  useFrame((_, delta) => {
    if (!ref.current) return;
    
    const progress = progressRef.current;
    const dest = progress > 0.5 ? chaos : target;
    currentPos.current.lerp(dest, delta * 3);

    ref.current.position.copy(currentPos.current);
    
    const s = scaleBase * scale * (1 - progress * 0.3);
    ref.current.scale.set(s, s, s);
    
    ref.current.rotation.x += delta;
    ref.current.rotation.y += delta;
  });

  return <Instance ref={ref} />;
};

/**
 * Sub-Component: Message Card (Replaces PhotoPlane)
 */
const MessageCard = ({ text, styleIndex, isFocused }: { text: string, styleIndex: number, isFocused: boolean }) => {
  const texture = useMemo(() => createMessageTexture(text, styleIndex), [text, styleIndex]);

  return (
    <mesh position={[0, 0.08, 0.011]} rotation={[0, 0, 0]}>
      <planeGeometry args={[0.7, 0.85]} /> 
      {/* 
        Unfocused brightness increased to #e0e0e0 (~88%) for better visibility.
        Focused state remains pure white #ffffff.
      */}
      <meshBasicMaterial 
        map={texture} 
        side={THREE.DoubleSide} 
        transparent 
        color={isFocused ? "#ffffff" : "#e0e0e0"} 
      /> 
    </mesh>
  );
};

/**
 * Sub-Component: Polaroids (Now Blessing Cards)
 */
const Polaroids = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const count = 48;
  const { isHandOpen } = useTreeStore();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Reset focus if hand closes (Tree mode)
  useEffect(() => {
    if (!isHandOpen) setFocusedIndex(null);
  }, [isHandOpen]);

  const geometry = useMemo(() => new THREE.BoxGeometry(0.5, 0.625, 0.01), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ffffff', 
    roughness: 0.9,
    metalness: 0.0 
  }), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const t = 1 - Math.sqrt((i+1)/(count+1));
      const theta = i * GOLDEN_ANGLE;
      return {
        target: getTreePos(t, theta, TREE_HEIGHT, TREE_WIDTH * 1.1),
        // Photos stay in the center void (radius 12), while stars are pushed to 12.5+
        chaos: getChaosPos(12, 0),
      }
    });
  }, [count]);

  return (
    <group>
      {data.map((d, i) => {
        const message = BLESSINGS[i % BLESSINGS.length];
        const styleIndex = i; 
        return (
          <SinglePolaroid 
            key={i} 
            data={d} 
            progressRef={progressRef} 
            geometry={geometry} 
            material={material}
            message={message}
            styleIndex={styleIndex}
            index={i}
            isFocused={focusedIndex === i}
            setFocusedIndex={setFocusedIndex}
            isHandOpen={isHandOpen}
          />
        );
      })}
    </group>
  );
};

const SinglePolaroid = ({ 
    data, 
    progressRef, 
    geometry, 
    material, 
    message, 
    styleIndex,
    index,
    isFocused,
    setFocusedIndex,
    isHandOpen
}: any) => {
  const groupRef = useRef<THREE.Group>(null);
  const currentPos = useRef(data.target.clone());
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const progress = progressRef.current;
    
    if (isFocused) {
        // --- FOCUSED STATE ---
        // Lerp to position just in front of camera
        const camPos = state.camera.position;
        const camDir = new THREE.Vector3();
        state.camera.getWorldDirection(camDir);
        
        // Target: 2.5 units in front of camera
        const target = camPos.clone().add(camDir.multiplyScalar(3.0));
        currentPos.current.lerp(target, delta * 5); // Fast smooth transition
        
        groupRef.current.position.copy(currentPos.current);
        groupRef.current.lookAt(state.camera.position);
        
        // Scale Up (2.5x)
        const targetScale = 2.5;
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);

    } else {
        // --- NORMAL STATE ---
        const dest = progress > 0.5 ? data.chaos : data.target;
        currentPos.current.lerp(dest, delta * 2);
        groupRef.current.position.copy(currentPos.current);
        
        // Scale Normal (1.0)
        groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 2);

        if (progress > 0.5) {
            // Chaos State: Float and look at camera
            groupRef.current.lookAt(state.camera.position);
        } else {
            // Tree State: Strict upright facing outward
            const angle = Math.atan2(currentPos.current.x, currentPos.current.z);
            groupRef.current.rotation.set(0, angle, 0);
        }
    }
  });

  return (
    <group 
      ref={groupRef} 
      onClick={(e) => {
         // Only allow interaction when scattered (Hand Open)
         if (isHandOpen) {
            e.stopPropagation();
            setFocusedIndex(isFocused ? null : index);
         }
      }}
      // Cursor pointer when interactable
      onPointerOver={() => { if(isHandOpen) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <MessageCard text={message} styleIndex={styleIndex} isFocused={isFocused} />
    </group>
  );
}


/**
 * Main Component: LuxuryTree
 */
const LuxuryTree: React.FC = () => {
  const rotatingGroupRef = useRef<THREE.Group>(null);
  const { isHandOpen } = useTreeStore();
  const progressRef = useRef(0);
  const ballGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);

  useFrame((state, delta) => {
    const target = isHandOpen ? 1 : 0;
    
    // ADJUSTED SPEEDS based on user feedback:
    // Retract (target=0): 2.0 (Double previous 1.0) for faster closing.
    // Scatter (target=1): 4.0 for immediate, snappy reaction when gesture is detected.
    const lerpSpeed = isHandOpen ? 4.0 : 2.0;
    
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * lerpSpeed);

    if (rotatingGroupRef.current) {
       rotatingGroupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group>
      <group ref={rotatingGroupRef}>
        <Foliage progressRef={progressRef} />

        {/* Ornament counts */}
        <OrnamentLayer count={40} color="#ffcc00" geometry={ballGeo} scaleBase={0.15} progressRef={progressRef} emissiveIntensity={0.5} />
        <OrnamentLayer count={30} color="#800080" geometry={ballGeo} scaleBase={0.12} progressRef={progressRef} />
        <OrnamentLayer count={20} color="#ff0000" geometry={ballGeo} scaleBase={0.08} progressRef={progressRef} />
        
        {/* Lights */}
        <OrnamentLayer count={8} color="#ff0055" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={8} color="#00ff55" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={8} color="#0055ff" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={8} color="#ffaa00" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />

        <Polaroids progressRef={progressRef} />

        <HolyStar progressRef={progressRef} />
        <GiftPile progressRef={progressRef} />
      </group>
      
      <ParticleText text="MERRY" position={[-6.5, 0, 0]} size={1.2} density={4000} progressRef={progressRef} />
      <ParticleText text="CHRISTMAS" position={[8.5, 0, 0]} size={1.2} density={5000} progressRef={progressRef} />

    </group>
  );
};

export default LuxuryTree;