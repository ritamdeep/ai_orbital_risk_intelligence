import * as THREE from 'three';

/**
 * Creates a high-fidelity Night Earth texture with dark oceans, detailed continent landmasses,
 * and illuminated golden city lights clusters matching NASA Black Marble night imagery.
 */
export function createNightEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // 1. Deep Ocean Fill (dark space indigo-black)
  ctx.fillStyle = '#040914';
  ctx.fillRect(0, 0, width, height);

  // Subtle ocean depth gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#030712');
  oceanGrad.addColorStop(0.5, '#050c1e');
  oceanGrad.addColorStop(1, '#030712');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Helper: Convert Lat/Lon to Canvas X/Y (Equirectangular)
  const toXY = (lat: number, lon: number): [number, number] => {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // 2. Draw Continent Landmass Polygons
  const drawPoly = (coords: [number, number][], fillColor = '#0c1626', strokeColor = '#1e293b') => {
    if (coords.length === 0) return;
    ctx.beginPath();
    const [startX, startY] = toXY(coords[0][0], coords[0][1]);
    ctx.moveTo(startX, startY);
    for (let i = 1; i < coords.length; i++) {
      const [px, py] = toXY(coords[i][0], coords[i][1]);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  // Africa
  drawPoly([
    [37, -10], [36, 10], [31, 32], [28, 34], [12, 44], [11, 51],
    [-2, 41], [-12, 41], [-26, 33], [-34, 26], [-35, 20], [-34, 18],
    [-17, 12], [-5, 12], [5, 1], [4, -7], [14, -17], [21, -17],
    [28, -13], [35, -6]
  ]);

  // Europe & Western Eurasia
  drawPoly([
    [36, -6], [43, -9], [44, -1], [48, -5], [54, 8], [58, 5],
    [62, 5], [71, 28], [68, 44], [60, 50], [55, 60], [45, 47],
    [41, 29], [37, 22], [36, 27], [32, 35], [37, 36], [41, 28],
    [38, 15], [38, 9], [36, -6]
  ]);

  // Scandinavia & British Isles
  drawPoly([[58, 5], [62, 5], [71, 28], [65, 24], [58, 13]]);
  drawPoly([[50, -5], [58, -5], [58, -1], [50, 1]]); // UK & Ireland

  // Asia (Eurasian landmass, Siberia, India, SE Asia)
  drawPoly([
    [71, 28], [77, 105], [72, 140], [65, 175], [60, 165], [53, 142],
    [42, 130], [38, 118], [30, 122], [22, 114], [10, 108], [1, 104],
    [8, 98], [16, 96], [22, 89], [21, 87], [13, 80], [8, 77],
    [15, 74], [24, 69], [25, 62], [30, 48], [37, 36], [45, 47],
    [55, 60], [60, 50], [68, 44]
  ]);

  // Indian Subcontinent (detailed peninsula)
  drawPoly([
    [24, 69], [22, 69], [19, 73], [15, 74], [10, 76], [8, 77],
    [10, 79], [13, 80], [16, 82], [20, 85], [22, 89], [26, 89],
    [28, 84], [31, 79], [34, 75], [31, 70], [24, 69]
  ], '#0d192c', '#0ea5e9');

  // Japan & Korean Peninsula
  drawPoly([[35, 128], [40, 128], [38, 126], [35, 128]]); // Korea
  drawPoly([[31, 131], [35, 133], [37, 137], [43, 141], [45, 142], [34, 135]]); // Japan

  // North America
  drawPoly([
    [72, -156], [70, -130], [58, -94], [62, -64], [47, -53], [44, -66],
    [32, -80], [25, -80], [29, -89], [26, -97], [18, -95], [15, -88],
    [14, -92], [22, -106], [32, -117], [38, -123], [48, -125], [59, -140],
    [65, -168], [71, -157]
  ]);

  // South America
  drawPoly([
    [12, -73], [10, -62], [4, -51], [-5, -35], [-13, -39], [-23, -43],
    [-34, -53], [-46, -66], [-54, -68], [-53, -73], [-42, -74], [-33, -72],
    [-18, -71], [-5, -81], [5, -77], [12, -73]
  ]);

  // Australia & New Zealand
  drawPoly([
    [-11, 142], [-15, 136], [-12, 131], [-21, 114], [-32, 115],
    [-35, 118], [-35, 138], [-39, 146], [-33, 151], [-24, 153],
    [-18, 146], [-11, 142]
  ]);
  drawPoly([[-35, 173], [-46, 168], [-46, 170], [-37, 175]]); // NZ

  // 3. Draw City Lights Glowing Corridors & Clusters
  const drawCityGlow = (lat: number, lon: number, radius = 5, intensity = 1.0) => {
    const [x, y] = toXY(lat, lon);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(254, 240, 138, ${0.95 * intensity})`); // Bright warm gold core
    grad.addColorStop(0.3, `rgba(245, 158, 11, ${0.75 * intensity})`); // Amber
    grad.addColorStop(0.7, `rgba(217, 119, 6, ${0.35 * intensity})`); // Deep orange glow
    grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // INDIA (Dense Golden Web across Indian Subcontinent)
  drawCityGlow(28.61, 77.20, 9, 1.2); // Delhi NCR
  drawCityGlow(19.07, 72.87, 8, 1.2); // Mumbai
  drawCityGlow(12.97, 77.59, 8, 1.2); // Bengaluru
  drawCityGlow(13.08, 80.27, 7, 1.1); // Chennai
  drawCityGlow(17.38, 78.48, 7, 1.1); // Hyderabad
  drawCityGlow(22.57, 88.36, 7, 1.1); // Kolkata
  drawCityGlow(23.02, 72.57, 6, 1.0); // Ahmedabad
  drawCityGlow(26.84, 80.94, 6, 0.9); // Lucknow
  drawCityGlow(26.91, 75.78, 5, 0.9); // Jaipur
  drawCityGlow(18.52, 73.85, 6, 1.0); // Pune
  // Highway arcs / Indo-Gangetic Plains glow
  for (let lon = 75; lon <= 88; lon += 1.2) {
    const lat = 25 + Math.sin(lon * 0.1) * 3;
    drawCityGlow(lat, lon, 3.5, 0.7);
  }
  // Coastal corridors India
  for (let lat = 10; lat <= 20; lat += 1.5) {
    drawCityGlow(lat, 73 + (20 - lat) * 0.3, 3, 0.65); // West coast
    drawCityGlow(lat, 80 - (20 - lat) * 0.1, 3, 0.65); // East coast
  }

  // EUROPE
  drawCityGlow(51.50, -0.12, 9, 1.2); // London
  drawCityGlow(48.85, 2.35, 8, 1.2);  // Paris
  drawCityGlow(52.52, 13.40, 7, 1.1); // Berlin
  drawCityGlow(55.75, 37.61, 8, 1.1); // Moscow
  drawCityGlow(40.41, -3.70, 7, 1.0); // Madrid
  drawCityGlow(41.90, 12.49, 7, 1.0); // Rome
  drawCityGlow(52.36, 4.90, 7, 1.1);  // Amsterdam
  // Benelux / Rhine corridor
  for (let lat = 48; lat <= 53; lat += 0.8) {
    drawCityGlow(lat, 6 + Math.random() * 4, 4, 0.85);
  }

  // MIDDLE EAST & NILE
  drawCityGlow(30.04, 31.23, 8, 1.2); // Cairo
  drawCityGlow(25.20, 55.27, 8, 1.2); // Dubai
  drawCityGlow(24.45, 54.37, 6, 1.0); // Abu Dhabi
  drawCityGlow(24.71, 46.67, 7, 1.0); // Riyadh
  // Nile Ribbon (continuous glowing line)
  for (let lat = 24; lat <= 31; lat += 0.5) {
    drawCityGlow(lat, 32 + (31 - lat) * 0.1, 3.5, 0.9);
  }

  // EAST ASIA
  drawCityGlow(35.67, 139.65, 11, 1.3); // Tokyo
  drawCityGlow(34.69, 135.50, 8, 1.1);  // Osaka
  drawCityGlow(31.23, 121.47, 10, 1.3); // Shanghai
  drawCityGlow(39.90, 116.40, 9, 1.2);  // Beijing
  drawCityGlow(23.12, 113.26, 9, 1.2);  // Guangzhou / Shenzhen
  drawCityGlow(37.56, 126.97, 9, 1.2);  // Seoul
  drawCityGlow(25.03, 121.56, 6, 1.0);  // Taipei

  // NORTH AMERICA
  drawCityGlow(40.71, -74.00, 10, 1.3); // NYC
  drawCityGlow(34.05, -118.24, 9, 1.2); // LA
  drawCityGlow(41.87, -87.62, 8, 1.1);  // Chicago
  drawCityGlow(29.76, -95.36, 7, 1.1);  // Houston
  drawCityGlow(37.77, -122.41, 7, 1.1); // SF Bay
  drawCityGlow(38.90, -77.03, 7, 1.1);  // Washington DC
  drawCityGlow(25.76, -80.19, 7, 1.1);  // Miami
  // US East Coast urban ribbon
  for (let lat = 36; lat <= 43; lat += 0.8) {
    drawCityGlow(lat, -76 + (lat - 36) * 0.6, 4, 0.85);
  }

  // SOUTH AMERICA & AUSTRALIA
  drawCityGlow(-23.55, -46.63, 8, 1.1); // São Paulo
  drawCityGlow(-22.90, -43.17, 7, 1.0); // Rio
  drawCityGlow(-34.60, -58.38, 7, 1.0); // Buenos Aires
  drawCityGlow(-33.86, 151.20, 7, 1.1); // Sydney
  drawCityGlow(-37.81, 144.96, 7, 1.1); // Melbourne

  // 4. Hundreds of random small city speckles on land
  const seedRandom = (s: number) => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 400; i++) {
    const lat = seedRandom(i * 3) * 120 - 50; // -50 to 70
    const lon = seedRandom(i * 7) * 360 - 180;
    // Check approximate land area
    const inLand =
      (lat > 10 && lat < 60 && lon > -125 && lon < -70) || // N America
      (lat > -40 && lat < 10 && lon > -75 && lon < -40) || // S America
      (lat > 35 && lat < 65 && lon > -10 && lon < 50) ||  // Europe
      (lat > 5 && lat < 65 && lon > 40 && lon < 145) ||   // Asia
      (lat > -35 && lat < 35 && lon > -15 && lon < 45) || // Africa
      (lat > -38 && lat < -15 && lon > 115 && lon < 152); // Australia

    if (inLand && seedRandom(i * 11) > 0.3) {
      drawCityGlow(lat, lon, 1.2 + seedRandom(i * 13) * 2.2, 0.5 + seedRandom(i * 17) * 0.4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
