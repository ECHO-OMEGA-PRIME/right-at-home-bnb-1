'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

interface HeroSceneProps {
  className?: string;
}

export default function HeroScene({ className = '' }: HeroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 50;
    cameraRef.current = camera;

    // Renderer with post-processing ready config
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Particle system - 2000 floating particles
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    // Texas A&M Maroon color palette
    const maroonColors = [
      new THREE.Color(0x500000), // Official Aggie Maroon
      new THREE.Color(0x6b0f1a), // Lighter maroon
      new THREE.Color(0x8b1538), // Rose maroon
      new THREE.Color(0xd4a574), // Gold accent
      new THREE.Color(0xffffff), // White sparkle
    ];

    for (let i = 0; i < particleCount; i++) {
      // Position - spread across viewport
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      // Color - weighted toward maroon
      const colorIndex = Math.random() < 0.7
        ? Math.floor(Math.random() * 3)
        : Math.floor(Math.random() * 5);
      const color = maroonColors[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size variation
      sizes[i] = Math.random() * 3 + 0.5;

      // Speed for animation
      speeds[i] = Math.random() * 0.5 + 0.1;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for glowing particles
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uPixelRatio;

        void main() {
          vColor = color;

          vec3 pos = position;

          // Gentle floating motion
          pos.y += sin(uTime * 0.5 + position.x * 0.01) * 2.0;
          pos.x += cos(uTime * 0.3 + position.y * 0.01) * 1.5;
          pos.z += sin(uTime * 0.4 + position.z * 0.01) * 1.0;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Size attenuation with distance
          gl_PointSize = size * uPixelRatio * (100.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;

          // Alpha based on depth
          vAlpha = smoothstep(100.0, 20.0, -mvPosition.z) * 0.8;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Circular soft particle with glow
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);

          // Soft falloff
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= vAlpha;

          // Core glow
          float core = 1.0 - smoothstep(0.0, 0.2, dist);
          vec3 color = vColor + vec3(core * 0.3);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // Floating geometric shapes - houses/buildings silhouettes
    const houseGroup = new THREE.Group();

    for (let i = 0; i < 8; i++) {
      const houseGeometry = new THREE.BoxGeometry(
        Math.random() * 4 + 2,
        Math.random() * 6 + 3,
        Math.random() * 4 + 2
      );

      const houseMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x500000),
        transparent: true,
        opacity: 0.15,
        wireframe: true,
      });

      const house = new THREE.Mesh(houseGeometry, houseMaterial);
      house.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 30 - 10,
        (Math.random() - 0.5) * 40 - 20
      );
      house.rotation.y = Math.random() * Math.PI;
      houseGroup.add(house);
    }
    scene.add(houseGroup);

    // Mouse move handler
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      const time = performance.now() * 0.001;

      // Update particle shader time
      if (particlesRef.current) {
        (particlesRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
        particlesRef.current.rotation.y = time * 0.02;
      }

      // Rotate house group slowly
      houseGroup.rotation.y = time * 0.05;
      houseGroup.children.forEach((house, i) => {
        house.rotation.y += 0.001;
        house.position.y += Math.sin(time + i) * 0.01;
      });

      // Camera follows mouse slightly
      if (cameraRef.current) {
        cameraRef.current.position.x += (mouseRef.current.x * 5 - cameraRef.current.position.x) * 0.02;
        cameraRef.current.position.y += (mouseRef.current.y * 3 - cameraRef.current.position.y) * 0.02;
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 -z-10 ${className}`}
      style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0505 50%, #150808 100%)' }}
    />
  );
}
