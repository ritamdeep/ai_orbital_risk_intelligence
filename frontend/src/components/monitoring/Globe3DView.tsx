import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SpaceObjectSummary, ConjunctionEvent } from '../../types/orbital';
import { formatCoordinates } from '../../utils/formatters';
import { createNightEarthTexture } from './earthTexture';

interface Globe3DViewProps {
  objects: SpaceObjectSummary[];
  conjunctions: ConjunctionEvent[];
  selectedObject: SpaceObjectSummary | null;
  onSelectObject: (obj: SpaceObjectSummary) => void;
  showOrbits?: boolean;
  showDebris?: boolean;
  autoRotate?: boolean;
  heightClassName?: string;
}

export const Globe3DView: React.FC<Globe3DViewProps> = ({
  objects,
  conjunctions,
  selectedObject,
  onSelectObject,
  showOrbits = true,
  showDebris = true,
  autoRotate = true,
  heightClassName,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredObject, setHoveredObject] = useState<SpaceObjectSummary | null>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const orbitsGroupRef = useRef<THREE.Group | null>(null);
  const hazardsGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);

  // Convert geodetic lat/lon/alt to 3D Cartesian coordinates
  const latLonAltToVector3 = (lat: number, lon: number, altKm: number, radius = 5): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const scaledR = radius + (altKm / 6371) * 2.8;
    const x = -(scaledR * Math.sin(phi) * Math.cos(theta));
    const z = scaledR * Math.sin(phi) * Math.sin(theta);
    const y = scaledR * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 640;

    // 1. Scene, Camera, Transparent Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 4, 15.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // 100% transparent to show starfield
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(16, 12, 14);
    scene.add(sunLight);

    // Subtle cyan rim back-light
    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.5);
    rimLight.position.set(-14, -8, -12);
    scene.add(rimLight);

    // 3. Earth Globe Mesh with Glowing Night Lights Texture
    const earthRadius = 5.0;
    const earthGroup = new THREE.Group();
    // Default tilt towards Indian Ocean / Eurasia
    earthGroup.rotation.y = 1.1;
    earthGroup.rotation.x = 0.22;
    scene.add(earthGroup);

    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = createNightEarthTexture();

    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      emissive: 0x071529,
      emissiveIntensity: 0.4,
      specular: 0x0284c7,
      shininess: 25,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // 4. Glowing Atmosphere Rim Halo (Fresnel Shader)
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.05, 64, 64);
    const atmoShader = {
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float rim = 1.0 - max(0.0, dot(vNormal, viewDir));
          float atmosphere = pow(rim, 2.6);
          // High intensity electric cyan atmosphere
          gl_FragColor = vec4(0.06, 0.75, 0.95, atmosphere * 0.92);
        }
      `,
    };

    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: atmoShader.vertexShader,
      fragmentShader: atmoShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 5. Dynamic Object & Orbit Groups
    const objectsGroup = new THREE.Group();
    earthGroup.add(objectsGroup);
    objectsGroupRef.current = objectsGroup;

    const orbitsGroup = new THREE.Group();
    earthGroup.add(orbitsGroup);
    orbitsGroupRef.current = orbitsGroup;

    const hazardsGroup = new THREE.Group();
    earthGroup.add(hazardsGroup);
    hazardsGroupRef.current = hazardsGroup;

    // 6. Mouse Interaction & Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(objectsGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object.userData.spaceObject as SpaceObjectSummary;
        if (hit) setHoveredObject(hit);
      } else {
        setHoveredObject(null);
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(objectsGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object.userData.spaceObject as SpaceObjectSummary;
        if (hit) onSelectObject(hit);
      }
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('click', onClick);

    // Drag-to-rotate camera controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onDragMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      earthGroup.rotation.y += deltaX * 0.005;
      earthGroup.rotation.x += deltaY * 0.005;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(9, Math.min(24, camera.position.z + e.deltaY * 0.01));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onDragMove);
    container.addEventListener('wheel', onWheel, { passive: false });

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Gentle auto-rotation
      if (autoRotate && !isDragging) {
        earthGroup.rotation.y += 0.0012;
      }

      // Animate hazard pulsating concentric rings
      hazardsGroup.children.forEach((hazardNode) => {
        const rings = hazardNode.userData.pulseRings as THREE.Mesh[];
        if (rings) {
          rings.forEach((ring, rIdx) => {
            const scale = 1.0 + ((elapsed * 2 + rIdx * 0.8) % 2.0) * 0.9;
            ring.scale.set(scale, scale, scale);
            const mat = ring.material as THREE.MeshBasicMaterial;
            if (mat) {
              mat.opacity = Math.max(0, 0.85 - (scale - 1.0) * 0.7);
            }
          });
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 640;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('click', onClick);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onDragMove);
      container.removeEventListener('wheel', onWheel);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      earthTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Update space objects, orbits, and conjunction hazards when props change
  useEffect(() => {
    const objectsGroup = objectsGroupRef.current;
    const orbitsGroup = orbitsGroupRef.current;
    const hazardsGroup = hazardsGroupRef.current;
    if (!objectsGroup || !orbitsGroup || !hazardsGroup) return;

    // Clear previous dynamic meshes
    while (objectsGroup.children.length > 0) objectsGroup.remove(objectsGroup.children[0]);
    while (orbitsGroup.children.length > 0) orbitsGroup.remove(orbitsGroup.children[0]);
    while (hazardsGroup.children.length > 0) hazardsGroup.remove(hazardsGroup.children[0]);

    // 1. Draw Space Object Markers (Cyan for satellites, Orange for debris)
    objects.forEach((obj) => {
      if (!showDebris && obj.object_type !== 'PAYLOAD') return;

      const isSelected = selectedObject?.norad_id === obj.norad_id;
      const isDebris = obj.object_type === 'DEBRIS' || obj.object_type === 'ROCKET_BODY';

      const pos = latLonAltToVector3(
        obj.current_position.latitude,
        obj.current_position.longitude,
        obj.current_position.altitude_km
      );

      // Sphere Marker
      const markerSize = isSelected ? 0.24 : isDebris ? 0.12 : 0.18;
      const markerGeo = new THREE.SphereGeometry(markerSize, 16, 16);
      const markerColor = isSelected ? 0x22d3ee : isDebris ? 0xf59e0b : 0x06b6d4;
      const markerMat = new THREE.MeshBasicMaterial({
        color: markerColor,
      });

      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.copy(pos);
      markerMesh.userData = { spaceObject: obj };
      objectsGroup.add(markerMesh);

      // Selected halo ring
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.35, 0.52, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos);
        ringMesh.lookAt(0, 0, 0);
        objectsGroup.add(ringMesh);
      }

      // 2. Draw Orbit Ellipses
      if (showOrbits && (obj.object_type === 'PAYLOAD' || isSelected)) {
        const orbitPts: THREE.Vector3[] = [];
        const numPts = 80;
        const incRad = (obj.inclination_deg * Math.PI) / 180;
        const avgAlt = (obj.perigee_km + obj.apogee_km) / 2;
        const orbitRadius = 5.0 + (avgAlt / 6371) * 2.8;

        for (let i = 0; i <= numPts; i++) {
          const theta = (i / numPts) * Math.PI * 2;
          const x = orbitRadius * Math.cos(theta);
          const y = orbitRadius * Math.sin(theta) * Math.sin(incRad);
          const z = orbitRadius * Math.sin(theta) * Math.cos(incRad);
          orbitPts.push(new THREE.Vector3(x, y, z));
        }

        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
        const orbitColor = isSelected ? 0x38bdf8 : isDebris ? 0xfb923c : 0xa5f3fc;
        const orbitMat = new THREE.LineBasicMaterial({
          color: orbitColor,
          transparent: true,
          opacity: isSelected ? 0.9 : 0.45,
          linewidth: isSelected ? 2 : 1,
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        orbitsGroup.add(orbitLine);
      }
    });

    // 3. Draw Close-Approach Pulsing Radar Target Rings (Concentric Red Rings)
    conjunctions.forEach((conj) => {
      const primary = objects.find(o => o.norad_id === conj.primary_object.norad_id);
      if (!primary) return;

      const pos = latLonAltToVector3(
        primary.current_position.latitude,
        primary.current_position.longitude,
        primary.current_position.altitude_km
      );

      const hazardNode = new THREE.Group();
      hazardNode.position.copy(pos);

      // Central glowing red sphere
      const centerGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const centerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      hazardNode.add(centerMesh);

      // Concentric pulsing radar rings
      const pulseRings: THREE.Mesh[] = [];
      const ringRadii = [0.45, 0.75, 1.05];

      ringRadii.forEach((r, idx) => {
        const ringGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.8 - idx * 0.2,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.lookAt(pos.clone().negate()); // Face outwards from Earth center
        hazardNode.add(ringMesh);
        pulseRings.push(ringMesh);
      });

      hazardNode.userData = { pulseRings };
      hazardsGroup.add(hazardNode);
    });
  }, [objects, conjunctions, selectedObject, showOrbits, showDebris]);

  return (
    <div className={`relative w-full ${heightClassName || 'h-[640px]'} overflow-hidden select-none`}>
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Hover Tooltip */}
      {hoveredObject && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 text-white backdrop-blur-xl px-4 py-2.5 rounded-xl border border-slate-700/60 text-xs shadow-2xl max-w-xs pointer-events-none font-mono">
          <div className="flex items-center justify-between space-x-3 mb-1">
            <span className="font-bold text-cyan-400">{hoveredObject.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {hoveredObject.object_type}
            </span>
          </div>
          <div className="text-slate-300 space-y-0.5 text-[11px]">
            <div>NORAD ID: <span className="text-white font-semibold">#{hoveredObject.norad_id}</span></div>
            <div>Altitude: <span className="text-white font-semibold">{hoveredObject.current_position.altitude_km.toFixed(0)} km</span></div>
            <div>Coord: <span className="text-slate-300">{formatCoordinates(hoveredObject.current_position.latitude, hoveredObject.current_position.longitude)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
