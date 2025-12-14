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

  // Define 4 distinct stationery styles with CLEAR Handwriting Fonts (No hard-to-read cursives)
  const styles = [
    // 1. Vintage Kraft Paper
    { 
      bg: '#e8dcca', 
      text: '#4a3b2a', 
      border: '#8d6e63',
      font: '"Indie Flower", cursive', // Very readable
      decorType: 'dashed'
    },
    // 2. Soft Pink Love Letter
    { 
      bg: '#fff0f5', 
      text: '#c2185b', 
      border: '#f48fb1',
      font: '"Caveat", cursive', // Clear marker style
      decorType: 'hearts'
    },
    // 3. Winter Frost
    { 
      bg: '#e3f2fd', 
      text: '#01579b', 
      border: '#81d4fa',
      font: '"Caveat", cursive', 
      decorType: 'snow'
    },
    // 4. Festive Holiday
    { 
      bg: '#fff8e1', 
      text: '#b71c1c', 
      border: '#ff6f00', 
      font: '"Indie Flower", cursive',
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
  
  // Font logic - Increased size for readability (was 60px)
  ctx.font = `90px ${style.font}`;

  const lines = text.split('\n');
  const lineHeight = 100; // Increased line height
  const startY = 320 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, 256, startY + i * lineHeight);
  });
  
  // Footer Decoration
  ctx.font = `40px ${style.font}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText('~ Wisdom ~', 256, 580);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Anisotropy helps with oblique angles
  tex.anisotropy = 8;
  return tex;
};


// Helper to generate chaos position (SOLID VOLUME, random distribution)
const getChaosPos = (maxRadius = 10) => {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = maxRadius * Math.cbrt(Math.random());
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
};

const getTreePos = (t: number, theta: number, height: number, width: number) => {
  const y = height * t - height / 2;
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
 * Sub-Component: Gift Pile (Updated for Random Cloud Scatter with Motion)
 */
const GiftPile = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const count = 70; 
  const gifts = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.2 + 1.2; 
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = -TREE_HEIGHT/2 + (Math.random() * 0.8) - 0.2; 
      const target = new THREE.Vector3(x, y, z);
      const chaos = getChaosPos(15); 
      const scale = Math.random() * 0.4 + 0.3;
      
      const palettes = [
          { box: '#b30000', ribbon: '#ffbf00' }, 
          { box: '#005500', ribbon: '#b30000' }, 
          { box: '#f0f0f0', ribbon: '#b30000' }, 
          { box: '#b30000', ribbon: '#f0f0f0' }, 
          { box: '#002244', ribbon: '#c0c0c0' }, 
          { box: '#ffbf00', ribbon: '#f0f0f0' }, 
          { box: '#ffffff', ribbon: '#ff0000' }, 
          { box: '#ff0000', ribbon: '#ffffff' }, 
      ];
      const theme = palettes[Math.floor(Math.random() * palettes.length)];
      
      return { 
          target,
          chaos,
          scale, 
          boxColor: theme.box, 
          ribbonColor: theme.ribbon,
          rot: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
          chaosRot: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI) 
      };
    });
  }, []);

  return (
    <group>
       {gifts.map((d, i) => (
         <ScatteringGiftBox key={i} {...d} progressRef={progressRef} />
       ))}
    </group>
  );
}

const ScatteringGiftBox = ({ target, chaos, scale, boxColor, ribbonColor, rot, chaosRot, progressRef }: any) => {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(target.clone());

  useFrame((state, delta) => {
    if (!ref.current) return;
    const progress = progressRef.current;
    
    // Lerp Base Position
    const dest = progress > 0.5 ? chaos : target;
    pos.current.lerp(dest, delta * 3);
    ref.current.position.copy(pos.current);

    // Rotation Logic
    // If scattered, we add floating movement and continuous gentle rotation
    const time = state.clock.elapsedTime;
    
    if (progress > 0.8) {
      // Gentle Float (Speed Increased 3x)
      ref.current.position.y += Math.sin(time * 2.4 + chaos.x * 10) * 0.005;
      ref.current.position.x += Math.cos(time * 1.5 + chaos.z * 10) * 0.005;
      
      // Continuous Rotation (Speed Increased 3x approx)
      ref.current.rotation.x += Math.sin(time * 0.9 + chaos.y) * 0.015;
      ref.current.rotation.y += Math.cos(time * 0.6 + chaos.x) * 0.015;
    } else {
       // Transition to target static rotation
       const targetRot = progress > 0.5 ? chaosRot : rot;
       ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, targetRot.x, delta * 2);
       ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, targetRot.y, delta * 2);
       ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, targetRot.z, delta * 2);
    }
    
    const s = scale * (1 + progress * 0.2); 
    ref.current.scale.setScalar(s);
  });

  return (
    <group ref={ref} rotation={rot} scale={[scale, scale, scale]}>
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
  const count = 9000;
  const meshRef = useRef<THREE.Points>(null);
  
  const { aTargetPos, aChaosPos, aRandom } = useMemo(() => {
    const target = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const random = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const t = 1 - Math.sqrt((i + 1) / (count + 1));
      const theta = i * GOLDEN_ANGLE;
      const tPos = getTreePos(t, theta, TREE_HEIGHT, TREE_WIDTH);
      
      const noiseAmp = 0.05;
      tPos.x += (Math.random() - 0.5) * noiseAmp;
      tPos.y += (Math.random() - 0.5) * noiseAmp;
      tPos.z += (Math.random() - 0.5) * noiseAmp;
      
      target[i * 3] = tPos.x;
      target[i * 3 + 1] = tPos.y;
      target[i * 3 + 2] = tPos.z;

      const cPos = getChaosPos(125); 
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
        chaos: getChaosPos(18),
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

  useFrame((state, delta) => {
    if (!ref.current) return;
    
    const progress = progressRef.current;
    const dest = progress > 0.5 ? chaos : target;
    currentPos.current.lerp(dest, delta * 3);

    ref.current.position.copy(currentPos.current);
    
    // Scale Logic
    const s = scaleBase * scale * (1 - progress * 0.3);
    ref.current.scale.set(s, s, s);
    
    // Rotation & Float Logic
    if (progress > 0.8) {
        // Floating (Disordered movement - Speed Increased 3x)
        const time = state.clock.elapsedTime;
        ref.current.position.y += Math.sin(time * 3.0 + chaos.x * 10) * 0.01;
        ref.current.position.z += Math.cos(time * 3.0 + chaos.y * 10) * 0.01;

        // Gentle disordered rotation (Speed Increased 3x)
        ref.current.rotation.x += delta * 0.6;
        ref.current.rotation.y += delta * 0.45;
    } else {
        // Standard Tree Spin
        ref.current.rotation.x += delta;
        ref.current.rotation.y += delta;
    }
  });

  return <Instance ref={ref} />;
};

/**
 * Sub-Component: Message Card
 */
const MessageCard = ({ text, styleIndex, isFocused }: { text: string, styleIndex: number, isFocused: boolean }) => {
  const texture = useMemo(() => createMessageTexture(text, styleIndex), [text, styleIndex]);

  // Create Curled Paper Geometry
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.7, 0.85, 16, 16);
    const pos = geo.attributes.position;
    for(let i=0; i < pos.count; i++){
        const y = pos.getY(i); 
        const v = (y + 0.425) / 0.85; 
        const curl = 0.15 * Math.pow(1 - v, 3);
        pos.setZ(i, pos.getZ(i) + curl);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.08, 0.011]} geometry={geometry}>
        <meshBasicMaterial 
          map={texture} 
          side={THREE.FrontSide} 
          transparent 
          color={isFocused ? "#ffffff" : "#e0e0e0"} 
        /> 
      </mesh>
      <mesh position={[0, 0.08, 0.0105]} geometry={geometry}>
        <meshStandardMaterial 
          color="#f5f5dc" 
          side={THREE.BackSide} 
          roughness={0.8}
        /> 
      </mesh>
    </group>
  );
};

/**
 * Sub-Component: Polaroids (Blessing Cards)
 */
const Polaroids = ({ progressRef }: { progressRef: React.MutableRefObject<number> }) => {
  const count = 48;
  const { isHandOpen } = useTreeStore();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

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
      const chaos = getChaosPos(15);
      const chaosRotation = new THREE.Euler(
          (Math.random() - 0.5) * 0.5, 
          Math.random() * Math.PI * 2, 
          (Math.random() - 0.5) * 0.3  
      );
      return {
        target: getTreePos(t, theta, TREE_HEIGHT, TREE_WIDTH * 1.1),
        chaos,
        chaosRotation
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
  const targetQuaternion = useRef(new THREE.Quaternion());
  const dummyObj = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const progress = progressRef.current;
    
    // --- POSITION & ROTATION LOGIC ---
    if (isFocused) {
        // Focused: Fly to camera
        const camPos = state.camera.position;
        const camDir = new THREE.Vector3();
        state.camera.getWorldDirection(camDir);
        const target = camPos.clone().add(camDir.multiplyScalar(3.0));
        
        currentPos.current.lerp(target, delta * 5);
        groupRef.current.position.copy(currentPos.current);
        
        const targetScale = 2.5;
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);

        dummyObj.position.copy(currentPos.current);
        dummyObj.lookAt(state.camera.position);
        targetQuaternion.current.copy(dummyObj.quaternion);

    } else {
        // Normal State (Tree or Chaos)
        const dest = progress > 0.5 ? data.chaos : data.target;
        currentPos.current.lerp(dest, delta * 2);
        groupRef.current.position.copy(currentPos.current);
        
        const isScattered = progress > 0.5;
        const baseScale = isScattered ? 3.0 : 1.0;
        groupRef.current.scale.lerp(new THREE.Vector3(baseScale, baseScale, baseScale), delta * 2);

        if (progress > 0.5) {
            // Chaos State: Floating gently
            const euler = data.chaosRotation;
            
            // Minimal drift to keep them readable but alive
            const driftX = Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.05;
            const driftY = Math.cos(state.clock.elapsedTime * 0.3 + index) * 0.05;
            
            dummyObj.rotation.set(euler.x + driftX, euler.y + driftY, euler.z);
            targetQuaternion.current.setFromEuler(dummyObj.rotation);
        } else {
            // Tree State: Strict upright facing outward
            const angle = Math.atan2(currentPos.current.x, currentPos.current.z);
            dummyObj.rotation.set(0, angle, 0);
            targetQuaternion.current.setFromEuler(dummyObj.rotation);
        }
    }
    
    groupRef.current.quaternion.slerp(targetQuaternion.current, delta * 3);
  });

  return (
    <group 
      ref={groupRef} 
      onClick={(e) => {
         if (isHandOpen) {
            e.stopPropagation();
            setFocusedIndex(isFocused ? null : index);
         }
      }}
      onPointerOver={() => { if(isHandOpen) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
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
    
    // ADJUSTED SPEEDS
    const lerpSpeed = isHandOpen ? 4.0 : 10.0;
    
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * lerpSpeed);

    if (rotatingGroupRef.current) {
       rotatingGroupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group>
      <group ref={rotatingGroupRef}>
        <Foliage progressRef={progressRef} />

        {/* Ornaments */}
        <OrnamentLayer count={120} color="#ffcc00" geometry={ballGeo} scaleBase={0.15} progressRef={progressRef} emissiveIntensity={0.5} />
        <OrnamentLayer count={90} color="#C0C0C0" geometry={ballGeo} scaleBase={0.15} progressRef={progressRef} emissiveIntensity={0.6} />

        <OrnamentLayer count={90} color="#800080" geometry={ballGeo} scaleBase={0.12} progressRef={progressRef} />
        <OrnamentLayer count={60} color="#ff0000" geometry={ballGeo} scaleBase={0.08} progressRef={progressRef} />
        
        {/* Lights */}
        <OrnamentLayer count={24} color="#ff0055" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={24} color="#00ff55" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={24} color="#0055ff" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />
        <OrnamentLayer count={24} color="#ffaa00" geometry={ballGeo} scaleBase={0.06} progressRef={progressRef} emissiveIntensity={3.5} />

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