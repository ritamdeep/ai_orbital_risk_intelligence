import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpaceObjectSummary, ConjunctionEvent } from '../../types/orbital';
import { formatCoordinates } from '../../utils/formatters';
import {
  computeSubSolarPoint,
  computeSunDirectionVector,
  latLonRadiusToCartesian,
  trueScaleRadius,
} from '../../utils/solarPosition';
import { createNightEarthTexture } from './earthTexture';
import {
  ATMOSPHERE_FRAGMENT_SHADER,
  ATMOSPHERE_VERTEX_SHADER,
  CLOUDS_FRAGMENT_SHADER,
  CLOUDS_VERTEX_SHADER,
  EARTH_FRAGMENT_SHADER,
  EARTH_VERTEX_SHADER,
  ORBIT_LINE_FRAGMENT_SHADER,
  ORBIT_LINE_VERTEX_SHADER,
  createMarkerGlowTexture,
  createRingTexture,
} from './earthShaders';
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

interface PulseRingEntry {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  phase: number;
}

interface SharedSpriteTextures {
  satGlow: THREE.CanvasTexture;
  selectedGlow: THREE.CanvasTexture;
  debrisGlow: THREE.CanvasTexture;
  hazardGlow: THREE.CanvasTexture;
  selectedRing: THREE.CanvasTexture;
  hazardRing: THREE.CanvasTexture;
}

const EARTH_RADIUS = 1.0;
const CLOUDS_RADIUS = 1.005;
const ATMOSPHERE_RADIUS = 1.12;
const SPHERE_SEGMENTS = 72;
// 1.5 degrees per minute in radians per second
const CLOUD_DRIFT_RAD_PER_SEC = ((1.5 * Math.PI) / 180) / 60;
const SUN_UPDATE_INTERVAL_MS = 60_000;
const ADAPTIVE_WINDOW_SEC = 2.0;
const ADAPTIVE_THRESHOLD_MS = 22.0;

function createSolidDataTexture(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function configureTexture(
  tex: THREE.Texture,
  maxAnisotropy: number,
  isColorMap: boolean
): THREE.Texture {
  tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function loadTextureAsync(
  loader: THREE.TextureLoader,
  url: string,
  maxAnisotropy: number,
  isColorMap: boolean
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => resolve(configureTexture(tex, maxAnisotropy, isColorMap)),
      undefined,
      (err) => reject(err)
    );
  });
}

function buildOrbitPoints(
  latDeg: number,
  lonDeg: number,
  inclinationDeg: number,
  orbitRadius: number,
  segments = 96
): THREE.Vector3[] {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const latRad = latDeg * DEG;
  const effIncRad = Math.max(Math.abs(latRad) + 0.002, Math.min(Math.PI - 0.002, inclinationDeg * DEG));
  const sinInc = Math.sin(effIncRad);
  const cosInc = Math.cos(effIncRad);

  const sinU = Math.max(-1, Math.min(1, Math.sin(latRad) / Math.max(sinInc, 1e-4)));
  const u0 = Math.asin(sinU);
  const dLon0 = Math.atan2(cosInc * Math.sin(u0), Math.cos(u0)) * RAD;
  const raanDeg = lonDeg - dLon0;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    const ptLatDeg = Math.asin(Math.max(-1, Math.min(1, sinInc * Math.sin(u)))) * RAD;
    const ptLonDeg = raanDeg + Math.atan2(cosInc * Math.sin(u), Math.cos(u)) * RAD;
    const c = latLonRadiusToCartesian(ptLatDeg, ptLonDeg, orbitRadius);
    pts.push(new THREE.Vector3(c.x, c.y, c.z));
  }
  return pts;
}

function disposeGroupChildren(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      } else if (obj instanceof THREE.Sprite) {
        obj.material?.dispose();
      }
    });
  }
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
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  // Persistent refs for Three.js objects across prop updates
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const orbitsGroupRef = useRef<THREE.Group | null>(null);
  const hazardsGroupRef = useRef<THREE.Group | null>(null);
  const pulseRingsRef = useRef<PulseRingEntry[]>([]);
  const spriteTexturesRef = useRef<SharedSpriteTextures | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const autoRotateRef = useRef<boolean>(autoRotate);
  const prefersReducedMotionRef = useRef<boolean>(false);
  const onSelectObjectRef = useRef(onSelectObject);

  useEffect(() => {
    onSelectObjectRef.current = onSelectObject;
  }, [onSelectObject]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate && !prefersReducedMotionRef.current;
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (ev: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = ev.matches;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current && !ev.matches;
      }
    };
    motionQuery.addEventListener?.('change', handleMotionChange);

    // 1. Create WebGLRenderer safely (fallback gracefully if WebGL is unavailable)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      motionQuery.removeEventListener?.('change', handleMotionChange);
      return;
    }

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 560;
    let currentDpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setSize(width, height);
    renderer.setPixelRatio(currentDpr);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // 2. Scene & Camera positioned to frame the real-time UTC terminator cleanly
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 100);
    const initialSubSolar = computeSubSolarPoint(new Date());
    // Frame the real-time UTC terminator cleanly (~55% sunlit day / ~45% amber city lights)
    // with generous breathing room for the r=1.12 atmosphere and LEO orbit rings
    const camPos = latLonRadiusToCartesian(20, initialSubSolar.longitudeDeg - 82, 3.65);
    camera.position.set(camPos.x, camPos.y, camPos.z);
    camera.lookAt(0, 0, 0);

    // 3. OrbitControls rotates the camera (never the Earth mesh) so lat/lon & UTC sun stay exact
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 1.65;
    controls.maxDistance = 12.0;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.75;
    controls.autoRotate = autoRotateRef.current && !prefersReducedMotionRef.current;
    controls.autoRotateSpeed = 0.4;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // 4. Real-time UTC Sun Direction Vector
    const sunDirVec = new THREE.Vector3();
    const updateSunDirection = () => {
      const v = computeSunDirectionVector(new Date());
      sunDirVec.set(v.x, v.y, v.z).normalize();
    };
    updateSunDirection();

    // 5. Fallback Procedural Texture + Placeholder Uniform Textures
    const fallbackTex = createNightEarthTexture();
    fallbackTex.colorSpace = THREE.SRGBColorSpace;
    const placeholderDay = createSolidDataTexture(16, 42, 78);
    const placeholderNight = createSolidDataTexture(0, 0, 0);
    const placeholderSpec = createSolidDataTexture(128, 128, 128);
    const placeholderNormal = createSolidDataTexture(128, 128, 255);
    const placeholderClouds = createSolidDataTexture(0, 0, 0, 0);

    const managedTextures: THREE.Texture[] = [
      fallbackTex,
      placeholderDay,
      placeholderNight,
      placeholderSpec,
      placeholderNormal,
      placeholderClouds,
    ];

    // 6. Earth Surface Sphere (single draw call)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const earthUniforms = {
      uDayMap: { value: placeholderDay as THREE.Texture },
      uNightMap: { value: placeholderNight as THREE.Texture },
      uSpecularMap: { value: placeholderSpec as THREE.Texture },
      uNormalMap: { value: placeholderNormal as THREE.Texture },
      uFallbackMap: { value: fallbackTex as THREE.Texture },
      uSunDir: { value: sunDirVec },
      uBlend: { value: 0.0 },
      uNormalScale: { value: 0.0 },
    };
    const earthMat = new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // 7. Clouds Sphere (r = 1.005, single draw call, depthWrite = false)
    const cloudsGeo = new THREE.SphereGeometry(CLOUDS_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const cloudsUniforms = {
      uCloudMap: { value: placeholderClouds as THREE.Texture },
      uSunDir: { value: sunDirVec },
      uOpacity: { value: 0.0 },
    };
    const cloudsMat = new THREE.ShaderMaterial({
      uniforms: cloudsUniforms,
      vertexShader: CLOUDS_VERTEX_SHADER,
      fragmentShader: CLOUDS_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.visible = false;
    scene.add(cloudsMesh);

    // 8. Atmosphere Fresnel Sphere (r = 1.12, BackSide, AdditiveBlending, single draw call)
    const atmoGeo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const atmoUniforms = {
      uSunDir: { value: sunDirVec },
    };
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: ATMOSPHERE_VERTEX_SHADER,
      fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 9. Shared Sprite Textures & Dynamic Overlay Groups (in Earth-fixed frame)
    const spriteTextures: SharedSpriteTextures = {
      satGlow: createMarkerGlowTexture('#22d3ee', 'rgba(6, 182, 212, 0.45)'),
      selectedGlow: createMarkerGlowTexture('#67e8f9', 'rgba(34, 211, 238, 0.65)'),
      debrisGlow: createMarkerGlowTexture('#fbbf24', 'rgba(245, 158, 11, 0.45)'),
      hazardGlow: createMarkerGlowTexture('#fb7185', 'rgba(244, 63, 94, 0.55)'),
      selectedRing: createRingTexture('#67e8f9', 'rgba(34, 211, 238, 0.9)'),
      hazardRing: createRingTexture('#f43f5e', 'rgba(244, 63, 94, 0.9)'),
    };
    spriteTexturesRef.current = spriteTextures;

    const objectsGroup = new THREE.Group();
    const orbitsGroup = new THREE.Group();
    const hazardsGroup = new THREE.Group();
    scene.add(orbitsGroup);
    scene.add(objectsGroup);
    scene.add(hazardsGroup);
    objectsGroupRef.current = objectsGroup;
    orbitsGroupRef.current = orbitsGroup;
    hazardsGroupRef.current = hazardsGroup;

    // 10. Asynchronous Self-Hosted NASA Texture Loading with Smooth Cross-Fade
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const isMobile =
      window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const supports4K =
      window.innerWidth > 1600 &&
      !isMobile &&
      renderer.capabilities.maxTextureSize >= 4096;

    const dayUrl = supports4K
      ? '/textures/earth_day_4096.jpg'
      : '/textures/earth_day_2048.jpg';
    let using4K = supports4K;
    let blendTarget = 0.0;
    let blendStartTime = 0.0;
    let blendActive = false;
    let cloudTargetOpacity = 0.0;

    const loader = new THREE.TextureLoader();

    Promise.all([
      loadTextureAsync(loader, dayUrl, maxAnisotropy, true),
      loadTextureAsync(loader, '/textures/earth_night_2048.jpg', maxAnisotropy, true),
      loadTextureAsync(loader, '/textures/earth_specular_2048.jpg', maxAnisotropy, false),
    ])
      .then(([dayTex, nightTex, specTex]) => {
        if (disposed) {
          dayTex.dispose();
          nightTex.dispose();
          specTex.dispose();
          return;
        }
        managedTextures.push(dayTex, nightTex, specTex);
        earthUniforms.uDayMap.value = dayTex;
        earthUniforms.uNightMap.value = nightTex;
        earthUniforms.uSpecularMap.value = specTex;
        blendTarget = 1.0;
        blendStartTime = performance.now();
        blendActive = true;
      })
      .catch(() => {
        // Keep procedural fallback globe cleanly without crashing
      });

    if (!isMobile) {
      loadTextureAsync(loader, '/textures/earth_normal_2048.jpg', maxAnisotropy, false)
        .then((normalTex) => {
          if (disposed) {
            normalTex.dispose();
            return;
          }
          managedTextures.push(normalTex);
          earthUniforms.uNormalMap.value = normalTex;
          earthUniforms.uNormalScale.value = 0.35;
        })
        .catch(() => {
          // Optional relief map: silently skip
        });

      loadTextureAsync(loader, '/textures/earth_clouds_1024.png', maxAnisotropy, true)
        .then((cloudsTex) => {
          if (disposed) {
            cloudsTex.dispose();
            return;
          }
          managedTextures.push(cloudsTex);
          cloudsUniforms.uCloudMap.value = cloudsTex;
          cloudsMesh.visible = true;
          cloudTargetOpacity = 0.92;
        })
        .catch(() => {
          // Optional clouds layer: silently skip
        });
    }

    // Recompute UTC sun position every 60 seconds
    const sunIntervalId = window.setInterval(updateSunDirection, SUN_UPDATE_INTERVAL_MS);

    // 11. Pointer Raycasting (occluded back-side markers cannot be hovered/clicked)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const pickVisibleSatellite = (clientX: number, clientY: number): SpaceObjectSummary | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const spriteHits = raycaster.intersectObjects(objectsGroup.children, false);
      if (spriteHits.length === 0) return null;

      // Ensure marker is not behind the Earth sphere
      const earthHits = raycaster.intersectObject(earthMesh, false);
      const earthDist = earthHits.length > 0 ? earthHits[0].distance : Infinity;

      for (let i = 0; i < spriteHits.length; i++) {
        const hit = spriteHits[i];
        const obj = hit.object.userData?.spaceObject as SpaceObjectSummary | undefined;
        if (obj && hit.distance < earthDist) {
          return obj;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const hit = pickVisibleSatellite(e.clientX, e.clientY);
      setHoveredObject((prev) => (prev?.norad_id === hit?.norad_id ? prev : hit));
      renderer.domElement.style.cursor = hit ? 'pointer' : '';
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (moved > 6) return;
      const hit = pickVisibleSatellite(e.clientX, e.clientY);
      if (hit) {
        onSelectObjectRef.current(hit);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // 12. Adaptive Quality Downgrade Helper
    let qualityDegraded = false;
    let adaptiveAccumSec = 0;
    let adaptiveFrames = 0;

    const downgradeQuality = () => {
      if (qualityDegraded) return;
      qualityDegraded = true;
      cloudsMesh.visible = false;
      earthUniforms.uNormalScale.value = 0.0;
      currentDpr = Math.min(currentDpr, 1.0);
      renderer.setPixelRatio(currentDpr);

      if (using4K) {
        using4K = false;
        loadTextureAsync(loader, '/textures/earth_day_2048.jpg', maxAnisotropy, true)
          .then((tex2k) => {
            if (disposed) {
              tex2k.dispose();
              return;
            }
            managedTextures.push(tex2k);
            earthUniforms.uDayMap.value = tex2k;
          })
          .catch(() => {});
      }
    };

    // 13. Zero-Allocation Animation Loop with Tab-Visibility Pause
    let rafId: number | null = null;
    let lastTimestamp = performance.now();
    let elapsedSec = 0;

    const animate = (now: number) => {
      if (disposed || document.hidden) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(animate);

      const rawDtMs = now - lastTimestamp;
      lastTimestamp = now;
      const dtSec = Math.min(rawDtMs / 1000, 0.1);
      elapsedSec += dtSec;

      // Adaptive quality monitor (average frame time > 22 ms over 2 s)
      if (!qualityDegraded && rawDtMs > 0 && rawDtMs < 250) {
        adaptiveAccumSec += rawDtMs / 1000;
        adaptiveFrames += 1;
        if (adaptiveAccumSec >= ADAPTIVE_WINDOW_SEC) {
          const avgFrameMs = (adaptiveAccumSec * 1000) / Math.max(adaptiveFrames, 1);
          if (avgFrameMs > ADAPTIVE_THRESHOLD_MS) {
            downgradeQuality();
          }
          adaptiveAccumSec = 0;
          adaptiveFrames = 0;
        }
      }

      // Smooth cross-fade from procedural fallback to NASA textures (~650 ms)
      if (blendActive) {
        const progress = Math.min(1.0, (now - blendStartTime) / 650);
        const eased = 1 - Math.pow(1 - progress, 3);
        earthUniforms.uBlend.value = eased * blendTarget;
        if (cloudsMesh.visible) {
          cloudsUniforms.uOpacity.value = eased * cloudTargetOpacity;
        }
        if (progress >= 1.0) {
          blendActive = false;
        }
      } else if (cloudsMesh.visible && cloudsUniforms.uOpacity.value < cloudTargetOpacity) {
        cloudsUniforms.uOpacity.value = Math.min(
          cloudTargetOpacity,
          cloudsUniforms.uOpacity.value + dtSec * 1.6
        );
      }

      // Slow cloud drift (~1.5 deg/min relative to Earth)
      if (cloudsMesh.visible && !prefersReducedMotionRef.current) {
        cloudsMesh.rotation.y += CLOUD_DRIFT_RAD_PER_SEC * dtSec;
      }

      // Pulsing close-approach crimson halos (zero allocations)
      const rings = pulseRingsRef.current;
      if (rings.length > 0 && !prefersReducedMotionRef.current) {
        for (let i = 0; i < rings.length; i++) {
          const entry = rings[i];
          const cycle = (elapsedSec * 0.72 + entry.phase) % 1.0;
          const s = 0.042 + cycle * 0.068;
          entry.sprite.scale.set(s, s, 1);
          entry.material.opacity = (1.0 - cycle) * 0.85;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (disposed || document.hidden || rafId !== null) return;
      lastTimestamp = performance.now();
      rafId = requestAnimationFrame(animate);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        updateSunDirection();
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startLoop();

    // 14. Responsive Resize Observer
    const handleResize = () => {
      if (!container || disposed) return;
      const newWidth = container.clientWidth || 560;
      const newHeight = container.clientHeight || 560;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearInterval(sunIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery.removeEventListener?.('change', handleMotionChange);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      controls.dispose();
      controlsRef.current = null;

      disposeGroupChildren(objectsGroup);
      disposeGroupChildren(orbitsGroup);
      disposeGroupChildren(hazardsGroup);
      pulseRingsRef.current = [];

      earthGeo.dispose();
      earthMat.dispose();
      cloudsGeo.dispose();
      cloudsMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();

      managedTextures.forEach((t) => t.dispose());
      Object.values(spriteTextures).forEach((t) => t.dispose());
      spriteTexturesRef.current = null;

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync true-scale satellite/debris sprites, depth-faded orbit lines, and pulsing hazard halos
  useEffect(() => {
    const objectsGroup = objectsGroupRef.current;
    const orbitsGroup = orbitsGroupRef.current;
    const hazardsGroup = hazardsGroupRef.current;
    const textures = spriteTexturesRef.current;
    if (!objectsGroup || !orbitsGroup || !hazardsGroup || !textures) return;

    disposeGroupChildren(objectsGroup);
    disposeGroupChildren(orbitsGroup);
    disposeGroupChildren(hazardsGroup);
    const nextPulseRings: PulseRingEntry[] = [];

    objects.forEach((obj) => {
      if (!showDebris && obj.object_type !== 'PAYLOAD') return;

      const isSelected = selectedObject?.norad_id === obj.norad_id;
      const isDebris = obj.object_type === 'DEBRIS' || obj.object_type === 'ROCKET_BODY';

      // True orbital scale: radius = (6371 + altitude_km) / 6371
      const r = trueScaleRadius(obj.current_position.altitude_km);
      const pos = latLonRadiusToCartesian(
        obj.current_position.latitude,
        obj.current_position.longitude,
        r
      );

      // Fixed screen-size glowing sprite with proper depth testing (hidden behind Earth)
      const markerMat = new THREE.SpriteMaterial({
        map: isSelected
          ? textures.selectedGlow
          : isDebris
          ? textures.debrisGlow
          : textures.satGlow,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
      });
      const markerSprite = new THREE.Sprite(markerMat);
      markerSprite.position.set(pos.x, pos.y, pos.z);
      const baseScale = isSelected ? 0.044 : isDebris ? 0.028 : 0.036;
      markerSprite.scale.set(baseScale, baseScale, 1);
      markerSprite.userData = { spaceObject: obj };
      objectsGroup.add(markerSprite);

      // Crisp cyan selection halo ring
      if (isSelected) {
        const ringMat = new THREE.SpriteMaterial({
          map: textures.selectedRing,
          transparent: true,
          opacity: 0.95,
          depthTest: true,
          depthWrite: false,
          sizeAttenuation: false,
          blending: THREE.AdditiveBlending,
        });
        const ringSprite = new THREE.Sprite(ringMat);
        ringSprite.position.set(pos.x, pos.y, pos.z);
        ringSprite.scale.set(0.068, 0.068, 1);
        objectsGroup.add(ringSprite);
      }

      // Depth-faded glowing orbit trajectory at true scale
      if (showOrbits && (obj.object_type === 'PAYLOAD' || isSelected)) {
        const avgAlt = (obj.perigee_km + obj.apogee_km) / 2;
        const orbitRadius = trueScaleRadius(avgAlt);
        const orbitPts = buildOrbitPoints(
          obj.current_position.latitude,
          obj.current_position.longitude,
          obj.inclination_deg,
          orbitRadius,
          96
        );
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
        const orbitColor = new THREE.Color(
          isSelected ? 0x38bdf8 : isDebris ? 0xfb923c : 0x67e8f9
        );
        const orbitMat = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: orbitColor },
            uBaseOpacity: { value: isSelected ? 0.85 : 0.42 },
          },
          vertexShader: ORBIT_LINE_VERTEX_SHADER,
          fragmentShader: ORBIT_LINE_FRAGMENT_SHADER,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        orbitsGroup.add(orbitLine);
      }
    });

    // Pulsing crimson close-approach markers (deduplicated per primary object)
    const seenPrimaryIds = new Set<number>();
    conjunctions.forEach((conj) => {
      const primary = objects.find((o) => o.norad_id === conj.primary_object.norad_id);
      if (!primary || seenPrimaryIds.has(primary.norad_id)) return;
      seenPrimaryIds.add(primary.norad_id);

      const r = trueScaleRadius(primary.current_position.altitude_km);
      const pos = latLonRadiusToCartesian(
        primary.current_position.latitude,
        primary.current_position.longitude,
        r
      );

      const coreMat = new THREE.SpriteMaterial({
        map: textures.hazardGlow,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: false,
        blending: THREE.AdditiveBlending,
      });
      const coreSprite = new THREE.Sprite(coreMat);
      coreSprite.position.set(pos.x, pos.y, pos.z);
      coreSprite.scale.set(0.042, 0.042, 1);
      hazardsGroup.add(coreSprite);

      [0.0, 0.5].forEach((phase) => {
        const ringMat = new THREE.SpriteMaterial({
          map: textures.hazardRing,
          transparent: true,
          opacity: 0.75,
          depthTest: true,
          depthWrite: false,
          sizeAttenuation: false,
          blending: THREE.AdditiveBlending,
        });
        const ringSprite = new THREE.Sprite(ringMat);
        ringSprite.position.set(pos.x, pos.y, pos.z);
        ringSprite.scale.set(0.068, 0.068, 1);
        hazardsGroup.add(ringSprite);
        nextPulseRings.push({ sprite: ringSprite, material: ringMat, phase });
      });
    });

    pulseRingsRef.current = nextPulseRings;
  }, [objects, conjunctions, selectedObject, showOrbits, showDebris]);

  return (
    <div
      className={`relative aspect-square ${heightClassName || 'w-full max-w-[min(74vh,560px)]'} flex items-center justify-center select-none`}
    >
      {/* Subtle radial atmosphere backdrop glow centered behind the globe */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          className="w-[74%] h-[74%] rounded-full opacity-50 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.20) 0%, rgba(56, 189, 248, 0.10) 48%, rgba(99, 102, 241, 0.05) 70%, transparent 82%)',
          }}
        />
      </div>

      {/* 3D WebGL Canvas or Graceful Non-WebGL Fallback */}
      {webglUnavailable ? (
        <div className="relative z-10 w-[78%] h-[78%] rounded-full bg-gradient-to-br from-[#0c2748] via-[#071a33] to-[#030b1a] border border-cyan-400/30 shadow-[0_0_60px_rgba(34,211,238,0.22)] flex flex-col items-center justify-center text-center p-6">
          <span className="type-label text-cyan-300">2D Fallback Active</span>
          <p className="text-xs text-[#b4c6dc] mt-2 max-w-[220px]">
            WebGL rendering is unavailable in this environment. Orbital telemetry remains active.
          </p>
        </div>
      ) : (
        <div
          ref={mountRef}
          className="relative z-10 w-full h-full cursor-grab active:cursor-grabbing"
        />
      )}

      {/* Hover Tooltip */}
      {hoveredObject && (
        <GlassCard
          variant="chip"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-3 text-xs max-w-xs pointer-events-none"
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
