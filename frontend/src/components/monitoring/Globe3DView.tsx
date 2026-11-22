import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SpaceObjectSummary, ConjunctionEvent } from '../../types/orbital';
import { formatCoordinates } from '../../utils/formatters';
import { createNightEarthTexture } from './earthTexture';
import { GlassCard } from '../common/GlassCard';

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
  const autoRotateRef = useRef<boolean>(autoRotate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  const earthRadius = 4.95;

  // Convert geodetic lat/lon/alt to 3D Cartesian coordinates
  const latLonAltToVector3 = (
    lat: number,
    lon: number,
    altKm: number,
    radius = earthRadius
  ): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const scaledR = radius + (altKm / 6371) * 2.75;
    const x = -(scaledR * Math.sin(phi) * Math.cos(theta));
    const z = scaledR * Math.sin(phi) * Math.sin(theta);
    const y = scaledR * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 580;

    // 1. Scene, Centered Camera, Transparent Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    // Centered cleanly inside the viewport so the globe and outer orbit rings are never clipped
    camera.position.set(0, 0.2, 18.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting — Key sun + soft cyan & indigo rim lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.35);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.25);
    sunLight.position.set(16, 10, 14);
    scene.add(sunLight);

    const cyanRimLight = new THREE.DirectionalLight(0x22d3ee, 2.0);
    cyanRimLight.position.set(-14, 6, -10);
    scene.add(cyanRimLight);

    const indigoRimLight = new THREE.DirectionalLight(0x6366f1, 1.2);
    indigoRimLight.position.set(10, -12, -12);
    scene.add(indigoRimLight);

    // 3. Earth Globe Mesh with Night Lights Texture
    const earthGroup = new THREE.Group();
    earthGroup.rotation.y = 1.1;
    earthGroup.rotation.x = 0.22;
    scene.add(earthGroup);

    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTex = createNightEarthTexture();

    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      emissive: 0x071a33,
      emissiveIntensity: 0.45,
      specular: 0x38bdf8,
      shininess: 30,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // 4a. Crisp Inner Rim Light Fresnel Shader
    const rimGeo = new THREE.SphereGeometry(earthRadius * 1.02, 64, 64);
    const rimMat = new THREE.ShaderMaterial({
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
          float glow = pow(rim, 3.2);
          gl_FragColor = vec4(0.22, 0.85, 0.98, glow * 0.65);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(rimGeo, rimMat));

    // 4b. Outer Soft Atmosphere Halo (BackSide Fresnel)
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.10, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
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
          float rim = 1.0 - max(0.0, dot(-vNormal, viewDir));
          float atmosphere = pow(clamp(rim, 0.0, 1.0), 3.6);
          vec3 col = mix(vec3(0.06, 0.78, 0.96), vec3(0.39, 0.40, 0.95), 0.32);
          gl_FragColor = vec4(col, atmosphere * 0.72);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

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
      camera.position.z = Math.max(10.5, Math.min(24, camera.position.z + e.deltaY * 0.01));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onDragMove);
    container.addEventListener('wheel', onWheel, { passive: false });

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (autoRotateRef.current && !isDragging) {
        earthGroup.rotation.y += 0.0012;
      }

      hazardsGroup.children.forEach((hazardNode) => {
        const rings = hazardNode.userData.pulseRings as THREE.Mesh[];
        if (rings) {
          rings.forEach((ring, rIdx) => {
            const scale = 1.0 + ((elapsed * 1.6 + rIdx * 0.75) % 2.0) * 0.85;
            ring.scale.set(scale, scale, scale);
            const mat = ring.material as THREE.MeshBasicMaterial;
            if (mat) {
              mat.opacity = Math.max(0, 0.8 - (scale - 1.0) * 0.65);
            }
          });
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 720;
      const newHeight = container.clientHeight || 580;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
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

    while (objectsGroup.children.length > 0) objectsGroup.remove(objectsGroup.children[0]);
    while (orbitsGroup.children.length > 0) orbitsGroup.remove(orbitsGroup.children[0]);
    while (hazardsGroup.children.length > 0) hazardsGroup.remove(hazardsGroup.children[0]);

    objects.forEach((obj) => {
      if (!showDebris && obj.object_type !== 'PAYLOAD') return;

      const isSelected = selectedObject?.norad_id === obj.norad_id;
      const isDebris = obj.object_type === 'DEBRIS' || obj.object_type === 'ROCKET_BODY';

      const pos = latLonAltToVector3(
        obj.current_position.latitude,
        obj.current_position.longitude,
        obj.current_position.altitude_km
      );

      const markerSize = isSelected ? 0.25 : isDebris ? 0.13 : 0.18;
      const markerGeo = new THREE.SphereGeometry(markerSize, 16, 16);
      const markerColor = isSelected ? 0x22d3ee : isDebris ? 0xf59e0b : 0x06b6d4;
      const markerMat = new THREE.MeshBasicMaterial({ color: markerColor });

      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.copy(pos);
      markerMesh.userData = { spaceObject: obj };
      objectsGroup.add(markerMesh);

      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.36, 0.54, 32);
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

      if (showOrbits && (obj.object_type === 'PAYLOAD' || isSelected)) {
        const orbitPts: THREE.Vector3[] = [];
        const numPts = 80;
        const incRad = (obj.inclination_deg * Math.PI) / 180;
        const avgAlt = (obj.perigee_km + obj.apogee_km) / 2;
        const orbitRadius = earthRadius + (avgAlt / 6371) * 2.75;

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
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        orbitsGroup.add(orbitLine);
      }
    });

    conjunctions.forEach((conj) => {
      const primary = objects.find((o) => o.norad_id === conj.primary_object.norad_id);
      if (!primary) return;

      const pos = latLonAltToVector3(
        primary.current_position.latitude,
        primary.current_position.longitude,
        primary.current_position.altitude_km
      );

      const hazardNode = new THREE.Group();
      hazardNode.position.copy(pos);

      const centerGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const centerMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      hazardNode.add(new THREE.Mesh(centerGeo, centerMat));

      const pulseRings: THREE.Mesh[] = [];
      [0.45, 0.75, 1.05].forEach((r, idx) => {
        const ringGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.8 - idx * 0.2,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.lookAt(pos.clone().negate());
        hazardNode.add(ringMesh);
        pulseRings.push(ringMesh);
      });

      hazardNode.userData = { pulseRings };
      hazardsGroup.add(hazardNode);
    });
  }, [objects, conjunctions, selectedObject, showOrbits, showDebris]);

  return (
    <div
      className={`relative w-full ${heightClassName || 'h-[540px] lg:h-[620px]'} flex items-center justify-center select-none`}
    >
      {/* Subtle radial atmosphere backdrop glow centered behind the globe */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          className="w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] lg:w-[540px] lg:h-[540px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.22) 0%, rgba(56, 189, 248, 0.10) 46%, rgba(99, 102, 241, 0.06) 68%, transparent 80%)',
          }}
        />
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="relative z-10 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Hover Tooltip */}
      {hoveredObject && (
        <GlassCard
          variant="chip"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-3 text-xs max-w-xs pointer-events-none"
        >
          <div className="flex items-center justify-between space-x-3 mb-1.5">
            <span className="font-display font-semibold text-cyan-300 text-sm">
              {hoveredObject.name}
            </span>
            <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/10">
              {hoveredObject.object_type}
            </span>
          </div>
          <div className="text-[#b4c6dc] space-y-1 text-xs">
            <div>
              NORAD ID:{' '}
              <span className="text-white font-data font-semibold">#{hoveredObject.norad_id}</span>
            </div>
            <div>
              Altitude:{' '}
              <span className="text-white font-data font-semibold">
                {hoveredObject.current_position.altitude_km.toFixed(0)} km
              </span>
            </div>
            <div>
              Coord:{' '}
              <span className="text-slate-200 font-data">
                {formatCoordinates(
                  hoveredObject.current_position.latitude,
                  hoveredObject.current_position.longitude
                )}
              </span>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
