/**
 * build-models.mjs — a balance scale, built rather than borrowed.
 *
 * Flat-shaded low-poly. Output goes to assets-src/models/ and is then treated
 * exactly like a downloaded one: normalise-models.mjs centres, scales and
 * re-casts it.
 *
 * All six awards are sculptures the owner drew, and THOSE FILES ARE THE
 * SOURCE — assets-src/models/<cat>.glb — so this script may not write to any
 * of those names. SUPPLIED below is the guard, and it is a guard rather than a
 * deletion: a model can be pulled for revision, and this balance is the only
 * stand-in the project has.
 *
 *   node scripts/build-models.mjs
 */
import { Document, NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';

/* ── geometry ──────────────────────────────────────────────────────────────
   Everything emits a flat triangle soup: three positions and one face normal
   per triangle. Non-indexed costs vertices, which at this size is nothing, and
   buys the faceted shading the borrowed models already have. */

const tris = [];
const add = (a, b, c) => tris.push([a, b, c]);

const mul = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = ([x, y, z]) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); const m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };

function matmul(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
    for (let k = 0; k < 4; k++) o[i * 4 + j] += a[k * 4 + j] * b[i * 4 + k];
  return o;
}
/** column-major composition: the RIGHTMOST matrix is applied to the point first */
const chain = (...ms) => ms.reduce((a, b) => matmul(a, b));

/** collect triangles from a builder, then push them through one transform */
function place(m, build) {
  const start = tris.length;
  build();
  for (let i = start; i < tris.length; i++) tris[i] = tris[i].map((p) => mul(m, p));
}

/** frustum about the Y axis, centred on the origin; r0 bottom, r1 top */
function cylinder(r0, r1, h, seg, caps = true) {
  const y0 = -h / 2, y1 = h / 2;
  const ring = (r, y) => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const lo = ring(r0, y0), hi = ring(r1, y1);
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    add(lo[i], lo[j], hi[j]);
    add(lo[i], hi[j], hi[i]);
  }
  if (caps) {
    for (let i = 1; i < seg - 1; i++) {
      add(lo[0], lo[i + 1], lo[i]);
      add(hi[0], hi[i], hi[i + 1]);
    }
  }
}

function sphere(r, segU = 20, segV = 14) {
  const p = (u, v) => {
    const th = (u / segU) * Math.PI * 2, ph = (v / segV) * Math.PI;
    return [Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r];
  };
  for (let v = 0; v < segV; v++) {
    for (let u = 0; u < segU; u++) {
      const a = p(u, v), b = p(u + 1, v), c = p(u + 1, v + 1), d = p(u, v + 1);
      if (v !== 0) add(a, b, c);
      if (v !== segV - 1) add(a, c, d);
    }
  }
}

function torus(R, r, segU = 56, segV = 14) {
  const p = (u, v) => {
    const th = (u / segU) * Math.PI * 2, ph = (v / segV) * Math.PI * 2;
    const rr = R + Math.cos(ph) * r;
    return [Math.cos(th) * rr, Math.sin(ph) * r, Math.sin(th) * rr];
  };
  for (let u = 0; u < segU; u++) {
    for (let v = 0; v < segV; v++) {
      const a = p(u, v), b = p(u + 1, v), c = p(u + 1, v + 1), d = p(u, v + 1);
      add(a, b, c); add(a, c, d);
    }
  }
}

/* ── the pieces ────────────────────────────────────────────────────────── */

/**
 * A beam balance, level. The prize is for the study of how things are
 * weighed against one another, and the site's flat and room halls have used
 * a balance for economics since the first version — this keeps the four
 * halls telling the same story.
 */
function balance() {
  const ARM = 0.52;      // half the beam
  const BEAM_Y = 0.40;
  const PAN_Y = 0.02;

  place(translate([0, -0.52, 0]), () => cylinder(0.34, 0.28, 0.07, 40));   // foot
  place(translate([0, -0.45, 0]), () => cylinder(0.12, 0.07, 0.10, 32));   // swell
  place(translate([0, -0.03, 0]), () => cylinder(0.045, 0.04, 0.86, 28));  // column
  place(translate([0, BEAM_Y, 0]), () => sphere(0.075, 22, 16));            // pivot

  // beam: laid along X, then lifted. Rotation has to come first — translate
  // first and the rotation swings the whole beam off the column.
  place(chain(translate([0, BEAM_Y, 0]), rotZ(Math.PI / 2)),
    () => cylinder(0.028, 0.028, ARM * 2, 24));

  for (const side of [-1, 1]) {
    const x = side * ARM;
    place(translate([x, BEAM_Y, 0]), () => sphere(0.045, 20, 14));          // end knob
    place(translate([x, (BEAM_Y + PAN_Y) / 2 + 0.03, 0]),
      () => cylinder(0.012, 0.012, BEAM_Y - PAN_Y - 0.06, 16, false));      // hanger
    place(translate([x, PAN_Y, 0]), () => cylinder(0.09, 0.24, 0.075, 40)); // pan
  }
}

/* ── write ─────────────────────────────────────────────────────────────── */

async function write(name, build) {
  tris.length = 0;
  build();

  const pos = new Float32Array(tris.length * 9);
  const nrm = new Float32Array(tris.length * 9);
  tris.forEach(([a, b, c], i) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    n = n.map((x) => x / len);
    [a, b, c].forEach((p, k) => {
      pos.set(p, i * 9 + k * 3);
      nrm.set(n, i * 9 + k * 3);
    });
  });

  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
    // colour is set later by normalise-models.mjs, from the hall's own accent
    .setMaterial(doc.createMaterial(name).setRoughnessFactor(0.5).setMetallicFactor(0.25));
  doc.createScene().addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));

  const out = `assets-src/models/${name}.glb`;
  await new NodeIO().write(out, doc);
  console.log(`${name.padEnd(11)} ${tris.length.toString().padStart(5)} tris  ` +
              `${(fs.statSync(out).size / 1024).toFixed(0).padStart(3)}KB`);
}

/** what this script can build, and what the owner has since drawn instead */
const PIECES = { economics: { build: balance, title: 'Balance scale' } };
const SUPPLIED = new Set(['physics', 'chemistry', 'medicine', 'peace', 'economics', 'literature']);

fs.mkdirSync('assets-src/models', { recursive: true });

/* These are ours, so they carry their own credit line rather than a borrowed
   one. Merged into the same file fetch-models.py writes, and neither script may
   clobber the other's entries — running either alone must leave a complete set
   of six. A supplied piece is skipped in both places: its model is the owner's
   and so is its credit, which is hand-kept in data/model-credits.json. */
const CREDITS = {};
for (const [cat, piece] of Object.entries(PIECES)) {
  if (SUPPLIED.has(cat)) {
    console.log(`${cat.padEnd(11)} skipped — the owner's own sculpture stands here`);
    continue;
  }
  await write(cat, piece.build);
  CREDITS[cat] = { title: piece.title, author: 'Nobel Lecture Museum' };
}

const file = 'data/model-credits.json';
const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (const [cat, c] of Object.entries(CREDITS)) {
  existing[cat] = { id: `built:${cat}`, ...c, licence: 'CC0', page: '', source: 'original' };
}
if (Object.keys(CREDITS).length) {
  fs.writeFileSync(file, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`\n→ ${file}`);
}
