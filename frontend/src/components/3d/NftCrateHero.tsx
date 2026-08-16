'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function RotatingGoldCrate() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.4;
      meshRef.current.rotation.y += delta * 0.6;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y -= delta * 0.1;
    }
  });

  // Particle positions array
  const particleCount = 120;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 8;
  }

  return (
    <group>
      {/* 3D Floating NFT Gold Crate Mesh */}
      <Float speed={2.5} rotationIntensity={0.8} floatIntensity={1.2}>
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={[2.2, 2.2, 2.2]} />
          <MeshDistortMaterial
            color="#C8922A"
            roughness={0.2}
            metalness={0.9}
            distort={0.25}
            speed={2}
          />
        </mesh>
      </Float>

      {/* Outer ambient gold dust particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          color="#E2A83B"
          transparent
          opacity={0.65}
          sizeAttenuation
        />
      </points>

      {/* Warm studio lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} color="#FFF5E6" />
      <pointLight position={[-5, -4, -4]} color="#C8922A" intensity={2} />
    </group>
  );
}

function LightweightFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-48 h-48 rounded-3xl bg-gradient-to-tr from-amber-600 to-yellow-400 opacity-80 blur-xl animate-pulse" />
      <div className="absolute text-center">
        <span className="text-4xl font-serif text-amber-900 font-bold">OSNM-Z</span>
      </div>
    </div>
  );
}

export default function NftCrateHero() {
  const [isLowPower, setIsLowPower] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsLowPower(true);
    }
  }, []);

  if (isLowPower) {
    return <LightweightFallback />;
  }

  return (
    <div className="w-full h-[400px] md:h-[480px] relative">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <RotatingGoldCrate />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 3} />
      </Canvas>
    </div>
  );
}
