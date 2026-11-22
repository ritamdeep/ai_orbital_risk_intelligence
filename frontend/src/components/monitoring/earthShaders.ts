import * as THREE from 'three';

/**
 * Custom GLSL shaders for ASTRAVIGIL's photorealistic Earth:
 * 1. Earth surface: NASA Blue Marble (day) + Black Marble (night city lights),
 *    real UTC terminator with soft twilight scatter, tangent-space topography relief,
 *    ocean-only specular sun glint, subtle blue night ambient, and smooth fallback cross-fade.
 * 2. Clouds layer: sun-lit transparent cloud sphere at r = 1.005 (bright by day, nearly invisible at night).
 * 3. Atmosphere: BackSide Fresnel cyan-blue rim + bright horizon limb at r = 1.12, stronger on sun side.
 * 4. Orbit lines: depth-faded orbital trajectories with subtle glow.
 */

export const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uFallbackMap;
  uniform vec3 uSunDir;
  uniform float uBlend;
  uniform float uNormalScale;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  // Screen-space tangent frame for normal-map relief without requiring vertex tangents
  vec3 perturbNormal(vec3 N, vec3 pos, vec2 uv, vec3 mapN, float scale) {
    vec3 dp1 = dFdx(pos);
    vec3 dp2 = dFdy(pos);
    vec2 duv1 = dFdx(uv);
    vec2 duv2 = dFdy(uv);

    vec3 dp2perp = cross(dp2, N);
    vec3 dp1perp = cross(N, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-6);
    mat3 TBN = mat3(T * invmax, B * invmax, N);
    vec3 n = mapN * 2.0 - 1.0;
    n.xy *= scale;
    return normalize(TBN * normalize(n));
  }

  void main() {
    vec3 geomNormal = normalize(vWorldNormal);
    vec3 sunDir = normalize(uSunDir);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // Subtle topography relief on land (skipped when uNormalScale == 0.0 on mobile/low quality)
    vec3 surfaceNormal = geomNormal;
    if (uNormalScale > 0.001) {
      vec3 normalSample = texture2D(uNormalMap, vUv).rgb;
      surfaceNormal = perturbNormal(geomNormal, vWorldPosition, vUv, normalSample, uNormalScale);
    }

    // Use geometric normal for clean terminator, perturbed normal for diffuse/glint micro-relief
    float ndotlGeom = dot(geomNormal, sunDir);
    float ndotlSurf = max(0.0, dot(surfaceNormal, sunDir));

    // Soft day/night transition with realistic twilight band
    float dayFactor = smoothstep(-0.14, 0.22, ndotlGeom);
    float nightMask = smoothstep(0.06, -0.20, ndotlGeom);
    float twilightBand = exp(-pow((ndotlGeom + 0.02) / 0.13, 2.0));

    // Sample textures (Three.js decodes sRGB color maps automatically when colorSpace = SRGBColorSpace)
    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    vec3 nightTex = texture2D(uNightMap, vUv).rgb;
    float oceanMask = texture2D(uSpecularMap, vUv).r;

    // Day lighting: crisp solar diffuse + gentle blue atmospheric bounce
    float diffuse = 0.08 + 0.96 * pow(ndotlSurf, 0.92);
    vec3 dayColor = dayTex * diffuse;

    // Soft ocean specular sun glint (ocean shiny, land matte — never a mirror)
    vec3 halfVec = normalize(sunDir + viewDir);
    float specAngle = max(0.0, dot(surfaceNormal, halfVec));
    float specBroad = pow(specAngle, 22.0) * 0.20;
    float specSharp = pow(specAngle, 68.0) * 0.34;
    vec3 sunGlint = vec3(0.95, 0.97, 1.0) * (specBroad + specSharp) * oceanMask * smoothstep(0.0, 0.25, ndotlGeom);
    dayColor += sunGlint;

    // Subtle warm-amber twilight tint along the terminator
    vec3 twilightTint = vec3(0.55, 0.24, 0.10) * twilightBand * 0.16;

    // Night side: dark navy-blue ambient (not pure black) + warm amber Black Marble city lights
    vec3 nightAmbient = dayTex * vec3(0.018, 0.036, 0.072) + vec3(0.008, 0.018, 0.040);
    // Warm amber glow strictly on the night side
    vec3 cityLights = nightTex * vec3(1.45, 1.02, 0.56) * nightMask * 1.45;
    vec3 nightColor = nightAmbient + cityLights;

    // Subtle cyan atmospheric Fresnel haze on the surface edge
    float fresnel = pow(1.0 - max(0.0, dot(geomNormal, viewDir)), 3.2);
    float sunSideBias = mix(0.22, 1.0, smoothstep(-0.3, 0.5, ndotlGeom));
    vec3 surfaceAtmo = vec3(0.10, 0.62, 0.96) * fresnel * sunSideBias * 0.28;

    vec3 photorealColor = mix(nightColor, dayColor, dayFactor) + twilightTint + surfaceAtmo;

    // Smooth cross-fade from existing procedural globe while NASA textures load
    vec3 fallbackSample = texture2D(uFallbackMap, vUv).rgb * (0.42 + 0.65 * max(0.0, ndotlGeom));
    vec3 finalColor = mix(fallbackSample, photorealColor, uBlend);

    gl_FragColor = vec4(finalColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const CLOUDS_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const CLOUDS_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDir;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec4 cloudTex = texture2D(uCloudMap, vUv);
    // Works for both alpha-channel PNGs (white RGB + alpha density) and opaque greyscale maps
    float density = cloudTex.a * cloudTex.r;
    float ndotl = dot(normalize(vWorldNormal), normalize(uSunDir));

    // Bright on the day side, soft warm twilight tint, nearly invisible on the night side
    float sunLit = smoothstep(-0.15, 0.28, ndotl);
    float twilight = exp(-pow((ndotl + 0.02) / 0.14, 2.0));

    vec3 cloudColor = mix(vec3(0.06, 0.11, 0.22), vec3(0.96, 0.98, 1.0), sunLit);
    cloudColor += vec3(0.45, 0.24, 0.12) * twilight * 0.28;

    float alpha = density * uOpacity * mix(0.03, 0.78, sunLit);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(cloudColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSunDir;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    // BackSide sphere at r = 1.12 around Earth (r = 1.0):
    // Visible halo spans viewCos = 0.0 (outer edge) to ~0.46 (Earth horizon limb).
    vec3 N = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 sunDir = normalize(uSunDir);

    float viewCos = max(0.0, dot(-N, viewDir));
    float t = clamp(viewCos / 0.46, 0.0, 1.0);

    // Smooth radial fade to zero at outer boundary (zero hard edge) + thin bright horizon limb
    float outerHalo = pow(t, 2.4) * 0.62;
    float thinLimb = pow(t, 6.5) * 0.78;

    // Brighter toward the sun-lit hemisphere, subtle deep-blue glow on the night limb
    float ndotl = dot(N, sunDir);
    float sunFactor = mix(0.18, 1.12, smoothstep(-0.32, 0.48, ndotl));

    vec3 haloColor = mix(vec3(0.06, 0.48, 0.94), vec3(0.18, 0.80, 0.98), t);
    vec3 limbColor = vec3(0.52, 0.93, 1.0);

    vec3 color = (haloColor * outerHalo + limbColor * thinLimb) * sunFactor;
    float alpha = clamp((outerHalo + thinLimb) * sunFactor, 0.0, 0.95);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const ORBIT_LINE_VERTEX_SHADER = /* glsl */ `
  varying float vNearFactor;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 toCam = normalize(cameraPosition);
    vec3 radial = normalize(worldPos.xyz);
    // +1 on camera-facing side, -1 on far side of Earth
    vNearFactor = dot(radial, toCam);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const ORBIT_LINE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBaseOpacity;

  varying float vNearFactor;

  void main() {
    // Dim back-side orbit segments smoothly for crisp 3D depth perception
    float depthFade = mix(0.24, 1.0, smoothstep(-0.65, 0.45, vNearFactor));
    float alpha = uBaseOpacity * depthFade;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * Create a tiny procedural radial-glow sprite texture (shared across markers, zero extra assets).
 */
export function createMarkerGlowTexture(innerHex: string, outerRgba: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, 1, cx, cx, cx);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.24, innerHex);
    grad.addColorStop(0.55, outerRgba);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Create a crisp ring sprite texture for selected satellite / pulsing close-approach halos.
 */
export function createRingTexture(strokeColor: string, glowColor: string): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cx, cx - 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
