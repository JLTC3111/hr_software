/**
 * Wall-mounted mechanical punch clock — the kind that stamps time cards.
 *
 * Pure model: builds and returns one `THREE.Group` named `PunchClock`. It does
 * not create a renderer, camera, lights or controls — the viewer owns those.
 *
 * Units are centimetres (1 unit = 1 cm), Y up, +Z toward the viewer. The origin
 * sits at the bottom-centre of the back plate, so the clock rests on the ground
 * plane at y=0 and mounts flush against a wall at z=0.
 *
 * Overall envelope ≈ 26 w × 43 h × 15 d.
 */
import * as THREE from 'three';

const { degToRad } = THREE.MathUtils;

/** Dial centre, shared by the face, the bezel, the ticks and the hands. */
const DIAL = { x: 0, y: 20, z: 12.9 };
const DIAL_RADIUS = 7.8;

/* ────────────────────────────────────────────────────────────────────────────
 * Materials — four standard materials plus one for the glass. Every mesh in the
 * model reuses these instances; nothing allocates a material of its own.
 * ──────────────────────────────────────────────────────────────────────────── */
export function createPunchClockMaterials() {
  const matCase = new THREE.MeshStandardMaterial({
    color: 0x2f4238, // deep enamel green
    roughness: 0.45,
    metalness: 0.15,
  });
  matCase.name = 'matCase';

  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xc9ccd1,
    roughness: 0.22,
    metalness: 0.95,
  });
  matChrome.name = 'matChrome';

  const matDial = new THREE.MeshStandardMaterial({
    color: 0xf4f0e6, // off-white enamel
    roughness: 0.85,
    metalness: 0,
  });
  matDial.name = 'matDial';

  const matDark = new THREE.MeshStandardMaterial({
    color: 0x14171a,
    roughness: 0.6,
    metalness: 0.1,
  });
  matDark.name = 'matDark';

  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    metalness: 0,
    depthWrite: false, // keep it from hazing the dial behind it
  });
  matGlass.name = 'matGlass';

  return { matCase, matChrome, matDial, matDark, matGlass };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Numerals are baked into a canvas texture rather than extruded as geometry —
 * TextGeometry needs a font fetch, which is one more thing that can fail.
 *
 * The catch is how three.js maps a cylinder cap. With the dial laid on its back
 * (rotation.x = PI/2) the cap resolves to
 *
 *     u = 0.5 - dy / (2R)        v = 0.5 + dx / (2R)
 *
 * for an offset (dx, dy) from the dial centre — a quarter turn *and* a mirror
 * away from the obvious "canvas top is dial top". Drawing naively puts 12 on
 * the left edge and reverses every glyph. Rather than fight it with texture
 * rotation (which cannot express the mirror), the same transform is baked into
 * the canvas: positions come straight from the mapping above, and each numeral
 * is stamped through setTransform(0, 1, 1, 0, …), whose own mirror cancels the
 * one in the UVs.
 * ──────────────────────────────────────────────────────────────────────────── */
function createNumeralTexture() {
  if (typeof document === 'undefined') return null;

  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const centre = SIZE / 2;
  const scale = centre / DIAL_RADIUS; // cm -> canvas pixels
  // Numerals sit at 5.9 cm on a 7.8 cm face, just inside the minute track.
  const radius = 5.9 * scale;

  ctx.fillStyle = '#14171a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 54px "Times New Roman", Georgia, serif';

  for (let i = 1; i <= 12; i += 1) {
    const angle = degToRad(i * 30); // clockwise from 12
    ctx.setTransform(
      0,
      1,
      1,
      0,
      centre - radius * Math.cos(angle),
      centre + radius * Math.sin(angle)
    );
    ctx.fillText(String(i), 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'dialNumerals';
  texture.colorSpace = THREE.SRGBColorSpace; // otherwise the face washes out
  texture.flipY = false; // the mapping above assumes canvas row 0 is v = 0
  texture.anisotropy = 4;
  return texture;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Hands. The pivot has to be at the tail of the hand, not its centre, so the
 * geometry is translated up by half its length before the mesh is built. Each
 * hand then lives in its own group parked at the dial centre and is turned by
 * rotating that group about Z.
 * ──────────────────────────────────────────────────────────────────────────── */
function createHand({ name, width, length, material, z }) {
  const geometry = new THREE.BoxGeometry(width, length, 0.15);
  geometry.translate(0, length / 2, 0); // tail at the origin

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;

  const pivot = new THREE.Group();
  pivot.name = `${name}Pivot`;
  pivot.position.set(DIAL.x, DIAL.y, z);
  pivot.add(mesh);
  return pivot;
}

/**
 * Minute track: 48 slim ticks plus 12 heavier ones on the five-minute marks.
 * Both are instanced — 60 separate meshes would be 60 draw calls for 60 boxes.
 */
function createTicks(material) {
  const rotation = new THREE.Matrix4();
  const translation = new THREE.Matrix4().makeTranslation(0, 7.1, 0);
  const matrix = new THREE.Matrix4();

  const build = (name, geometry, minutes) => {
    const mesh = new THREE.InstancedMesh(geometry, material, minutes.length);
    mesh.name = name;
    mesh.position.set(DIAL.x, DIAL.y, 13.15);

    minutes.forEach((minute, slot) => {
      rotation.makeRotationZ(-degToRad(minute * 6));
      mesh.setMatrixAt(slot, matrix.multiplyMatrices(rotation, translation));
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };

  const all = Array.from({ length: 60 }, (_, i) => i);

  return [
    build(
      'minuteTicks',
      new THREE.BoxGeometry(0.12, 0.5, 0.1),
      all.filter((i) => i % 5 !== 0)
    ),
    build(
      'hourTicks',
      new THREE.BoxGeometry(0.28, 1.1, 0.1),
      all.filter((i) => i % 5 === 0)
    ),
  ];
}

/** Four bars forming a 13 × 2.2 rectangular frame around the card slot. */
function createSlotBezel(material) {
  const group = new THREE.Group();
  group.name = 'slotBezel';
  group.position.set(0, 6.4, 12.6);

  const OUTER_W = 13;
  const OUTER_H = 2.2;
  const BAR = 0.35;
  const DEPTH = 1.2;

  const bars = [
    ['slotBezelTop', OUTER_W, BAR, 0, (OUTER_H - BAR) / 2],
    ['slotBezelBottom', OUTER_W, BAR, 0, -(OUTER_H - BAR) / 2],
    ['slotBezelLeft', BAR, OUTER_H, -(OUTER_W - BAR) / 2, 0],
    ['slotBezelRight', BAR, OUTER_H, (OUTER_W - BAR) / 2, 0],
  ];

  for (const [name, w, h, x, y] of bars) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), material);
    mesh.name = name;
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The model
 * ──────────────────────────────────────────────────────────────────────────── */
export function createPunchClock(options = {}) {
  const { numerals = true, materials = createPunchClockMaterials() } = options;
  const { matCase, matChrome, matDial, matDark, matGlass } = materials;

  const clock = new THREE.Group();
  clock.name = 'PunchClock';

  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    clock.add(mesh);
    return mesh;
  };

  // ── Case ──────────────────────────────────────────────────────────────────
  const caseBody = new THREE.Mesh(new THREE.BoxGeometry(24, 22, 13), matCase);
  caseBody.name = 'caseBody';
  caseBody.position.set(0, 17, 6.5);
  add(caseBody);

  // Shallow arched crown. A half cylinder swept from PI/2 through PI puts the
  // dome above the flat edge once the axis is laid along Z; sweeping from 0
  // instead stands the half-disc on its side.
  const caseCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 13, 48, 1, false, Math.PI / 2, Math.PI),
    matCase
  );
  caseCrown.name = 'caseCrown';
  caseCrown.rotation.x = Math.PI / 2;
  caseCrown.position.set(0, 28, 6.5);
  add(caseCrown);

  const backPlate = new THREE.Mesh(new THREE.BoxGeometry(22, 26, 1), matCase);
  backPlate.name = 'backPlate';
  backPlate.position.set(0, 16, 0.5);
  add(backPlate);

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 14), matCase);
  basePlinth.name = 'basePlinth';
  basePlinth.position.set(0, 3, 7);
  add(basePlinth);

  // ── Dial ──────────────────────────────────────────────────────────────────
  // A torus already lies in the XY plane, which is exactly how a front-facing
  // bezel should sit — it needs no rotation. Cylinders do; their axis is Y.
  const bezelRing = new THREE.Mesh(
    new THREE.TorusGeometry(8.2, 0.9, 20, 64),
    matChrome
  );
  bezelRing.name = 'bezelRing';
  bezelRing.position.set(DIAL.x, DIAL.y, 13.2);
  add(bezelRing);

  const dialMaterial = matDial;
  if (numerals && !dialMaterial.map) {
    const texture = createNumeralTexture();
    if (texture) {
      dialMaterial.map = texture;
      dialMaterial.needsUpdate = true;
    }
  }

  const dialFace = new THREE.Mesh(
    new THREE.CylinderGeometry(DIAL_RADIUS, DIAL_RADIUS, 0.4, 64),
    dialMaterial
  );
  dialFace.name = 'dialFace';
  dialFace.rotation.x = Math.PI / 2;
  dialFace.position.set(DIAL.x, DIAL.y, DIAL.z);
  add(dialFace);

  for (const ticks of createTicks(matDark)) {
    ticks.castShadow = false;
    clock.add(ticks);
  }

  // ── Hands ─────────────────────────────────────────────────────────────────
  // Each hand sits 0.05 further forward than the last so they never z-fight.
  const handHour = createHand({
    name: 'handHour',
    width: 0.5,
    length: 4.6,
    material: matDark,
    z: 13.2,
  });
  const handMinute = createHand({
    name: 'handMinute',
    width: 0.35,
    length: 6.6,
    material: matDark,
    z: 13.25,
  });
  const handSecond = createHand({
    name: 'handSecond',
    width: 0.15,
    length: 7.0,
    material: matDark,
    z: 13.3,
  });
  clock.add(handHour, handMinute, handSecond);

  const handCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.4, 24),
    matChrome
  );
  handCap.name = 'handCap';
  handCap.rotation.x = Math.PI / 2;
  handCap.position.set(DIAL.x, DIAL.y, 13.5);
  add(handCap);

  // Glass last, and thin. It is only 12% opaque and writes no depth.
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(8.0, 8.0, 0.15, 64),
    matGlass
  );
  glass.name = 'glass';
  glass.rotation.x = Math.PI / 2;
  glass.position.set(DIAL.x, DIAL.y, 13.35);
  glass.renderOrder = 10;
  glass.castShadow = false;
  clock.add(glass);

  // ── Card slot ─────────────────────────────────────────────────────────────
  // A dark inset box, not a boolean hole. CSG is where these builds break.
  const cardSlot = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 3), matDark);
  cardSlot.name = 'cardSlot';
  cardSlot.position.set(0, 6.4, 12.2);
  add(cardSlot);

  clock.add(createSlotBezel(matChrome));

  // ── Punch lever ───────────────────────────────────────────────────────────
  // The arm swings about the pivot, so its geometry runs from the pivot up
  // rather than either side of it — same trick as the hands.
  const leverArmGeometry = new THREE.BoxGeometry(2, 9, 2);
  leverArmGeometry.translate(0, 4.5, 0);
  const punchLever = new THREE.Mesh(leverArmGeometry, matChrome);
  punchLever.name = 'punchLever';
  punchLever.castShadow = true;

  const leverGroup = new THREE.Group();
  leverGroup.name = 'punchLeverPivot';
  leverGroup.position.set(12.5, 24, 6.5);
  leverGroup.add(punchLever);

  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 24), matChrome);
  leverKnob.name = 'leverKnob';
  leverKnob.position.set(0, 8, 0); // world y = 32
  leverKnob.castShadow = true;
  leverGroup.add(leverKnob);
  clock.add(leverGroup);

  const leverPivot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2.4, 24),
    matChrome
  );
  leverPivot.name = 'leverPivot';
  leverPivot.rotation.x = Math.PI / 2;
  leverPivot.position.set(12.5, 24, 6.5);
  add(leverPivot);

  // ── Bell and mounting lugs ────────────────────────────────────────────────
  // The crown arches to y=40, so the bell rides on the apex rather than the
  // y=34 given in the spec, where it would sit entirely inside the crown.
  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    matChrome
  );
  bellDome.name = 'bellDome';
  bellDome.position.set(0, 40, 6.5);
  add(bellDome);

  for (const [name, x] of [['mountLugL', -8], ['mountLugR', 8]]) {
    const lug = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 20),
      matChrome
    );
    lug.name = name;
    lug.rotation.x = Math.PI / 2;
    lug.position.set(x, 27, 0.3);
    add(lug);
  }

  clock.userData.materials = materials;
  clock.userData.hands = {
    hour: handHour,
    minute: handMinute,
    second: handSecond,
  };

  // Spec default: 10:09:35.
  setPunchClockTime(clock, { hours: 10, minutes: 9, seconds: 35 });

  return clock;
}

/**
 * Points the hands at a time. Clock angles run clockwise from 12 while a Z
 * rotation in three.js runs counter-clockwise, so every angle is negated.
 *
 * Accepts a `Date` or a plain `{ hours, minutes, seconds }`.
 */
export function setPunchClockTime(clock, time = new Date()) {
  const hands = clock?.userData?.hands;
  if (!hands) return;

  const hours = time instanceof Date ? time.getHours() : time.hours ?? 0;
  const minutes = time instanceof Date ? time.getMinutes() : time.minutes ?? 0;
  const seconds = time instanceof Date ? time.getSeconds() : time.seconds ?? 0;

  hands.hour.rotation.z = -degToRad(((hours % 12) + minutes / 60) * 30);
  hands.minute.rotation.z = -degToRad(minutes * 6);
  hands.second.rotation.z = -degToRad(seconds * 6);
}

/** Releases every geometry, material and texture the model owns. */
export function disposePunchClock(clock) {
  if (!clock) return;
  clock.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
  });
  const materials = clock.userData?.materials;
  if (materials) {
    for (const material of Object.values(materials)) {
      if (material.map) material.map.dispose();
      material.dispose();
    }
  }
}
