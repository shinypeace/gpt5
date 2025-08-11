export function createWorld(THREE) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060912, 0.015);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 10, 20);

  const hemi = new THREE.HemisphereLight(0x6dd6ff, 0x111322, 0.8);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(30, 50, 30);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 10;
  dir.shadow.camera.far = 200;
  dir.shadow.camera.left = -60;
  dir.shadow.camera.right = 60;
  dir.shadow.camera.top = 60;
  dir.shadow.camera.bottom = -60;
  scene.add(dir);

  // Planet (low-poly colorful)
  const planet = createPlanet(THREE);
  scene.add(planet);

  // Starfield
  const starfield = createStarfield(THREE);
  scene.add(starfield);

  const world = {
    THREE,
    scene,
    camera,
    planet,
    planetRadius: planet.userData.radius,
    starfield,
    onResize: (w, h) => {
      camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    update: (dt) => {
      starfield.rotation.y += dt * 0.01;
      starfield.rotation.x += dt * 0.005;
    },
  };

  return world;
}

function createPlanet(THREE) {
  const radius = 40;
  const segments = 64;
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  // Perturb vertices for low-poly noise look
  const pos = geo.attributes.position;
  const vec = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    vec.fromBufferAttribute(pos, i);
    const n = perlin3(vec.x * 0.04, vec.y * 0.04, vec.z * 0.04);
    vec.normalize().multiplyScalar(radius + n * 2.0);
    pos.setXYZ(i, vec.x, vec.y, vec.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1c2a5a,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
    emissive: 0x0a0f1f,
    emissiveIntensity: 0.25,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.radius = radius;
  return mesh;
}

function createStarfield(THREE) {
  const count = 4000;
  const radius = 900;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Random point on sphere
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const hue = 0.55 + (Math.random() * 0.1 - 0.05); // blueish
    color.setHSL(hue, 0.7, 0.6 + Math.random() * 0.2);
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.95 });
  const points = new THREE.Points(geo, mat);
  return points;
}

// Simple Perlin noise implementation (lite) for planet surface
// Adapted minimal version
const p = new Uint8Array(512);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 0; i < 256; i++) { const r = (Math.random() * 256) | 0; const t = p[i]; p[i] = p[r]; p[r] = t; }
for (let i = 0; i < 256; i++) p[i + 256] = p[i];
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }
function grad(h, x, y, z) {
  const u = (h & 1) ? x : y;
  const v = (h & 2) ? y : z;
  return ((h & 4) ? -u : u) + ((h & 8) ? -v : v);
}
function perlin3(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
  const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
         lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
         lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}