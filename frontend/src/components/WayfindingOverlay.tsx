import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WayfindingOverlayProps {
  vector: { angle_deg: number; distance_m: number } | null;
  active: boolean;
}

export const WayfindingOverlay: React.FC<WayfindingOverlayProps> = ({ vector, active }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const arrowRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !vector || !mountRef.current) {
      // Clear canvas if inactive
      if (rendererRef.current) {
        rendererRef.current.clear();
      }
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create scene with transparent background
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Orthographic camera for clean 2D/3D UI overlays
    const aspect = width / height;
    const viewSize = 5;
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect,
      viewSize * aspect,
      viewSize,
      -viewSize,
      0.1,
      100
    );
    camera.position.set(0, 0, 10);
    cameraRef.current = camera;

    // WebGL Renderer with alpha enabled
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    
    // Clear old canvases
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create glowing arrow group
    const arrowGroup = new THREE.Group();
    
    // Cylinder geometry for arrow shaft
    const shaftGeom = new THREE.CylinderGeometry(0.12, 0.12, 2.0, 16);
    // Move shaft up so rotation origin is at the base
    shaftGeom.translate(0, 1.0, 0);
    
    // Cone geometry for arrow tip
    const tipGeom = new THREE.ConeGeometry(0.35, 0.8, 16);
    // Position tip at the top of the shaft
    tipGeom.translate(0, 2.4, 0);

    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00A550, // FIFA Green
      transparent: true,
      opacity: 0.8,
    });

    const shaftMesh = new THREE.Mesh(shaftGeom, arrowMaterial);
    const tipMesh = new THREE.Mesh(tipGeom, arrowMaterial);

    arrowGroup.add(shaftMesh);
    arrowGroup.add(tipMesh);

    // Position arrow in center of overlay
    arrowGroup.position.set(0, 0, 0);
    
    // Rotate arrow group.
    // Three.js angle in radians. 0 radians points UP.
    // positive rotation is counter-clockwise.
    const radians = (vector.angle_deg * Math.PI) / 180;
    arrowGroup.rotation.z = -radians; // Negative for clockwise rotation matching standard navigation compass

    scene.add(arrowGroup);
    arrowRef.current = arrowGroup;

    // Add subtle lighting just in case (though basic material doesn't need it)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      // opacity pulsing: 0.5 to 1.0 to 0.5 over 1.2 second cycle
      // Formula: center + amplitude * sin(frequency * t)
      // frequency = 2 * PI / cycle = 2 * 3.1415 / 1.2 ≈ 5.236
      const opacity = 0.75 + 0.25 * Math.sin(5.236 * elapsedTime);
      arrowMaterial.opacity = opacity;
      
      // Floating height bounce effect
      const scale = 1.0 + 0.05 * Math.sin(5.236 * elapsedTime);
      arrowGroup.scale.set(scale, scale, scale);

      renderer.render(scene, camera);
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      
      const asp = w / h;
      camera.left = -viewSize * asp;
      camera.right = viewSize * asp;
      camera.top = viewSize;
      camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      // Clean up geometries and materials
      shaftGeom.dispose();
      tipGeom.dispose();
      arrowMaterial.dispose();
      renderer.dispose();
    };
  }, [vector, active]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};
