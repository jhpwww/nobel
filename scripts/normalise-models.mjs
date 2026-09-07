/**
 * normalise-models.mjs — make six models sit alike.
 *
 * Each model is rewritten once, here: pruned, re-centred, set on the drum, and
 * scaled so every assembly takes the same camera and the same framing. All six
 * awards are the owner's own and arrive upright in the drum's own units; the
 * pruning, orientation, smoothing and perch paths below are what a borrowed
 * stand-in would need, and are kept for that.
 *
 * ORIENT holds the only per-model judgement — a rotation where the source's
 * idea of "up" or "front" is not ours. Values were set by looking at the
 * rendered result, not guessed.
 */
import { NodeIO, getBounds } from '@gltf-transform/core';
import { prune, dedup, weld, quantize, textureCompress, mergeDocuments } from '@gltf-transform/functions';
import { KHRMeshQuantization, EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src/models';
const OUT = 'public/assets/models';

/**
 * Every piece stands on the same base.
 *
 * A white marble drum with a gold inlay ring round its top, from the project
 * owner, and the thing that turns six objects into one set of awards.
 * It is merged into each model rather than drawn as a second <model-viewer>:
 * one element, one draw, and the piece's own shadow falls on its own plinth.
 *
 * Its gold ring is exempt from the recolouring below and stays gold in both
 * museums, which is what makes the gold of the piece read as gold. The marble
 * is re-cast the way everything else here is, because a drum this white is the
 * brightest thing on the page in a dark vault and pulls the eye off the piece
 * it is holding up: white in the daylit museum as authored, dark stone in the
 * other. Its veining survives either way — the texture is untouched and only
 * the factor it multiplies changes. The base's materials are renamed on the
 * way in so the pass can tell them from the piece's own.
 */
/* The drum with its three gold bands cut into it — see
   scripts/build-base-rings.mjs. The plain _base.glb it is built from is left
   exactly as its author drew it. */
const BASE = `${SRC}/_base-ringed.glb`;
const BASE_PREFIX = 'base__';
const BASE_TOP = 0.178;      // where the drum's top face sits, in its own units
const BASE_MARBLE = `${BASE_PREFIX}white_marble`;
const BASE_STONE_DARK = '#4a4137';   // the drum, for the dark vault

/**
 * The marble's veins are there in the texture and invisible on screen: the
 * whole image lives between 197 and 253, and lit at this exposure the drum
 * renders across 232–249. A seven per cent spread reads as blank white.
 *
 * So the histogram is stretched before the texture is encoded — the darkest
 * vein down to VEIN_FLOOR, the lit marble left where it is. It is the same
 * stone, just legible; push it much further and it stops being marble and
 * starts being granite.
 */
const VEIN_IN = [197, 253];          // where the source's ink actually sits
const VEIN_FLOOR = 118;

/**
 * Six drums, six faces of the same stone.
 *
 * The texture wraps the cylinder once, so rolling it sideways turns the drum
 * without turning anything else: each hall gets a different sixth of the
 * marble facing the room and the row stops looking like one plinth copied six
 * times. Nothing about the geometry moves — the drums stay identical, which is
 * the point of them.
 */
const VEIN_TURN = { physics: 0, chemistry: 1, medicine: 2, peace: 3, economics: 4, literature: 5 };

/**
 * And a key light from the right, baked in.
 *
 * A cylinder under an even environment has no side to it — the marble reads as
 * a flat white band. model-viewer takes no lights of its own, only an
 * environment, so the fall-off is painted into the drum's own colour: brightest
 * a little right of front, deepest on the left. LIGHT_PHASE is where in the
 * texture the front of the drum lands, which is a property of how the cylinder
 * was unwrapped and was found by looking.
 */
const LIGHT_PHASE = 0.30;      // fraction of the texture's width facing the camera
const LIGHT_LIFT = 1.06;       // brightest side
const LIGHT_DROP = 0.62;       // and the shaded one

/**
 * A hair of daylight, so nothing fights for the same pixel.
 *
 * The award sculptures are drawn to stand exactly on the drum, so a piece's
 * underside and the drum's top face are the same plane — and the drum's gold
 * inlay ring is set into its wall within a thousandth of the marble's own
 * radius. Two surfaces at one depth is a coin toss per pixel, and the marble
 * kept winning patches of the gold: what looked like a bite taken out of the
 * cap of the chemistry piece, and out of the physics one beside it, and a
 * dashed inlay ring on all six.
 *
 * Both are separated by an amount that cannot be seen. The lift is four ten
 * thousandths of the drum's own height; on a drum drawn 156px wide it is a
 * twentieth of a pixel.
 */
const CLEAR_LIFT = 0.0005;     // the piece, off the drum's top face
const CLEAR_RING = 1.006;     // the inlay ring, proud of the wall

/**
 * The drum, cut down.
 *
 * A fifth off its height, taken from the foot so its top face — and therefore
 * every piece standing on it — does not move; and the gold ring brought up to
 * half its distance from that top. Both are done to the base as it is merged
 * rather than to the file, so the owner's model is left as drawn.
 */
const DRUM_TRIM = 0.2;        // of the drum's height, off the bottom
const RING_RAISE = 0.5;       // of the ring's distance to the top face
const DRUM_FOOT = BASE_TOP * DRUM_TRIM;   // where it stands after the cut

/**
 * The piece turns; the drum it stands on does not.
 *
 * model-viewer's auto-rotate turns the camera, so the whole assembly swings
 * together and the plinth looks as though it is on a lazy Susan. What is wanted
 * is a turntable under the piece alone, and that has to be a rotation baked
 * into the model — one node above the piece and below the drum, with an
 * animation on it that the halls autoplay.
 *
 * Six keyframes rather than two: slerp takes the shorter arc between
 * quaternions, so a half turn is ambiguous and a full one is a no-op. Sixty
 * degrees a hop leaves no doubt about the direction. The last keyframe is the
 * first rotation again, so the loop closes without a jump.
 */
const TURN_SECONDS = 26;
const TURN_STEPS = 6;

function turntable(doc, node, name) {
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const times = new Float32Array(TURN_STEPS + 1);
  const quats = new Float32Array((TURN_STEPS + 1) * 4);
  for (let i = 0; i <= TURN_STEPS; i++) {
    const t = i / TURN_STEPS;
    times[i] = t * TURN_SECONDS;
    const a = t * Math.PI * 2;
    quats.set([0, Math.sin(a / 2), 0, Math.cos(a / 2)], i * 4);
  }
  const sampler = doc.createAnimationSampler()
    .setInput(doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType('VEC4').setArray(quats).setBuffer(buffer))
    .setInterpolation('LINEAR');
  const channel = doc.createAnimationChannel()
    .setTargetNode(node).setTargetPath('rotation').setSampler(sampler);
  doc.createAnimation(name).addSampler(sampler).addChannel(channel);
}

/**
 * All six award sculptures are the owner's own now, each drawn to stand on
 * that drum, and every one of them goes on unchanged. ON_BASE is what says so.
 *
 * The perch below is what sat a borrowed piece on the drum instead — scaled to
 * the height the first award came in at, and no wider than half again the
 * drum. Nothing takes that path any more. It is kept because a seventh prize
 * is not impossible and because a model can always be pulled for revision, and
 * an empty ON_BASE would otherwise leave the hall with nothing to draw.
 */
const ON_BASE = new Set(['physics', 'chemistry', 'medicine', 'peace', 'economics', 'literature']);

/**
 * Which parts of an award sculpture are meant to be re-shaded, and which are
 * meant to keep their facets.
 *
 * The award models arrive shaded as their author intended, so by default none
 * of them is touched. The dove is the exception the owner asked for: its body
 * is to read as one polished cast surface, the way the borrowed dove it
 * replaces did, while the ring it stands in keeps every facet it was built
 * with. Selecting by node name rather than by mesh, because these files name
 * their parts and do not name their meshes.
 */
const SMOOTH_PARTS = {
  peace: ['dove'],          // dove_body and both wings hang under this
};
const PERCH_H = 0.525;
const PERCH_W = 0.302 * 1.25;

/**
 * Every material is re-cast in the hall's own accent, the same colour that
 * hall already uses for its heading and its plinth: the pieces become a set,
 * and the form does the identifying while the colour does the placing. Where a
 * hue is too saturated to hold a large fill, the site's own softened block
 * value is used — the same rule the CSS follows.
 */
const TINT = {
  physics: '#f0c063',
  chemistry: '#ecb98f',
  medicine: '#e5a49f',
  peace: '#ecd9b4',
  economics: '#b39a56',
  literature: '#cf9d7a',
};

/** glTF stores base colour linearly; the palette is written in sRGB */
const linear = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

const ORIENT = {
  /* The award sculptures arrive upright, in the drum's own units and already
     facing forward, so nothing is turned here. */
  physics: [0, 0, 0],
  chemistry: [0, 0, 0],
  medicine: [0, 0, 0],
  peace: [0, 0, 0],
  economics: [0, 0, 0],
  literature: [0, 0, 0],
};

const euler = ([x, y, z]) => {
  const [cx, cy, cz] = [Math.cos(x / 2), Math.cos(y / 2), Math.cos(z / 2)];
  const [sx, sy, sz] = [Math.sin(x / 2), Math.sin(y / 2), Math.sin(z / 2)];
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
};

/**
 * The bright museum casts every piece in one gold instead of six hall hues —
 * the look of an award statuette rather than a set of coloured markers.
 * Metalness near 1 with a low roughness is what makes it read as polished
 * metal; the base colour alone, on a rough dielectric, reads as yellow paint.
 */
const GOLD = { hex: '#d4a02a', metallic: 1.0, roughness: 0.22 };
const OUT_GOLD = 'public/assets/models/gold';

/**
 * Give every surface smooth shading.
 *
 * These arrive flat-shaded: one normal per face, so every facet catches the
 * light as its own plane. That is the low-poly look, and against the gold
 * material it reads as a faceted crystal rather than a cast piece.
 *
 * Smoothing is per corner rather than per vertex, and crease-aware: a corner
 * takes the average of the faces meeting at its position, but only those whose
 * own normal lies within CREASE of it. Average everything and the sharp edges
 * soften too — the flask's rim rounds off, the balance's beam melts into its
 * pans. Above the threshold the edge stays hard, which is what a smoothing
 * group is for.
 *
 * Positions are untouched; this changes only how the light is read.
 */
const CREASE = Math.cos((60 * Math.PI) / 180);

/**
 * Every node name on the path down to each mesh, so a mesh can be picked out
 * by the name of the part it belongs to — the meshes themselves are unnamed.
 */
function meshOwners(doc) {
  const owners = new Map();
  const walk = (node, trail) => {
    const here = node.getName() ? [...trail, node.getName()] : trail;
    const mesh = node.getMesh();
    if (mesh) {
      const set = owners.get(mesh) ?? new Set();
      for (const name of here) set.add(name);
      owners.set(mesh, set);
    }
    for (const child of node.listChildren()) walk(child, here);
  };
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) walk(node, []);
  }
  return owners;
}

function smoothNormals(doc, pick = () => true) {
  for (const mesh of doc.getRoot().listMeshes()) {
    if (!pick(mesh)) continue;
    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      const nrmAcc = prim.getAttribute('NORMAL');
      if (!posAcc || !nrmAcc) continue;

      const idxAcc = prim.getIndices();
      const pos = posAcc.getArray();
      const index = idxAcc ? Array.from(idxAcc.getArray()) : null;
      const corners = index ?? Array.from({ length: posAcc.getCount() }, (_, i) => i);
      const faceCount = corners.length / 3;

      const at = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      // a millimetre at this scale: everything is normalised to a 1-unit box
      const key = (i) => at(i).map((v) => Math.round(v * 4096)).join(',');

      const fn = new Float32Array(faceCount * 3);   // face normal, area-weighted
      for (let f = 0; f < faceCount; f++) {
        const [a, b, c] = [corners[f * 3], corners[f * 3 + 1], corners[f * 3 + 2]];
        const [ax, ay, az] = at(a), [bx, by, bz] = at(b), [cx, cy, cz] = at(c);
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        // the cross product's length is twice the area, which is the weight we
        // want: a sliver should not pull a corner as hard as a broad face
        fn[f * 3] = uy * vz - uz * vy;
        fn[f * 3 + 1] = uz * vx - ux * vz;
        fn[f * 3 + 2] = ux * vy - uy * vx;
      }

      const byPos = new Map();
      for (let f = 0; f < faceCount; f++) {
        for (let k = 0; k < 3; k++) {
          const K = key(corners[f * 3 + k]);
          (byPos.get(K) ?? byPos.set(K, []).get(K)).push(f);
        }
      }

      const out = new Float32Array(nrmAcc.getCount() * 3);
      const unit = (f) => {
        const l = Math.hypot(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]) || 1;
        return [fn[f * 3] / l, fn[f * 3 + 1] / l, fn[f * 3 + 2] / l];
      };
      for (let f = 0; f < faceCount; f++) {
        const [nx, ny, nz] = unit(f);
        for (let k = 0; k < 3; k++) {
          const corner = corners[f * 3 + k];
          let sx = 0, sy = 0, sz = 0;
          for (const g of byPos.get(key(corner))) {
            const [gx, gy, gz] = unit(g);
            if (nx * gx + ny * gy + nz * gz < CREASE) continue;   // across a crease
            sx += fn[g * 3]; sy += fn[g * 3 + 1]; sz += fn[g * 3 + 2];
          }
          /* At a seam the faces meeting a corner can cancel exactly, and a
             corner with a normal of no direction draws as a bright slit — one
             ran down the front of the chemistry award's cap. Fall back to this
             face's own normal, which is always a direction. */
          const l = Math.hypot(sx, sy, sz);
          if (l < 1e-9) { sx = nx; sy = ny; sz = nz; }
          const d = l < 1e-9 ? 1 : l;
          out[corner * 3] = sx / d;
          out[corner * 3 + 1] = sy / d;
          out[corner * 3 + 2] = sz / d;
        }
      }
      nrmAcc.setArray(out);
    }
  }
}

/**
 * One round of Loop subdivision, for the four pieces that came in low-poly.
 *
 * Smooth normals fix the shading but not the outline: a flask built from eight
 * facets still has an eight-sided silhouette however it is lit, and at the size
 * these render that edge is what the eye catches. Subdividing splits every
 * triangle in four and moves the vertices onto the limit surface, so the
 * outline rounds with it.
 *
 * Edges that only one face uses are treated as boundaries and keep the simple
 * midpoint rule — which is what preserves the flask's rim and the parchment's
 * corners instead of melting them.
 *
 * Not applied to the atom or the balance: those are generated at whatever
 * resolution is asked for, so they are simply built smooth.
 */
function subdivide(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAcc = prim.getAttribute('POSITION');
      const idxAcc = prim.getIndices();
      if (!posAcc || !idxAcc) continue;

      const P = Array.from(posAcc.getArray());
      const I = Array.from(idxAcc.getArray());
      const nV = posAcc.getCount();
      const get = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];

      /* topology: which faces meet on each edge, and who neighbours whom */
      const ekey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
      const edgeFaces = new Map();
      const neighbours = Array.from({ length: nV }, () => new Set());
      for (let f = 0; f < I.length / 3; f++) {
        const t = [I[f * 3], I[f * 3 + 1], I[f * 3 + 2]];
        for (let k = 0; k < 3; k++) {
          const a = t[k], b = t[(k + 1) % 3];
          neighbours[a].add(b); neighbours[b].add(a);
          const K = ekey(a, b);
          (edgeFaces.get(K) ?? edgeFaces.set(K, []).get(K)).push(f);
        }
      }
      const isBoundary = (a, b) => (edgeFaces.get(ekey(a, b)) ?? []).length < 2;

      /* new vertex on every edge */
      const edgePoint = new Map();
      const out = P.slice();
      for (const [K, faces] of edgeFaces) {
        const [a, b] = K.split('_').map(Number);
        const A = get(a), B = get(b);
        let p;
        if (faces.length < 2) {
          p = [0, 1, 2].map((i) => (A[i] + B[i]) / 2);
        } else {
          // the two vertices opposite this edge, one in each adjacent face
          const opp = faces.map((f) => {
            const t = [I[f * 3], I[f * 3 + 1], I[f * 3 + 2]];
            return t.find((v) => v !== a && v !== b);
          }).map(get);
          p = [0, 1, 2].map((i) =>
            (3 / 8) * (A[i] + B[i]) + (1 / 8) * (opp[0][i] + opp[1][i]));
        }
        edgePoint.set(K, out.length / 3);
        out.push(p[0], p[1], p[2]);
      }

      /* and every original vertex moves onto the limit surface */
      const moved = new Float32Array(nV * 3);
      for (let v = 0; v < nV; v++) {
        const nb = [...neighbours[v]];
        const bnd = nb.filter((w) => isBoundary(v, w));
        const V = get(v);
        if (bnd.length === 2) {
          const [A, B] = bnd.map(get);
          for (let i = 0; i < 3; i++) {
            moved[v * 3 + i] = (1 / 8) * A[i] + (3 / 4) * V[i] + (1 / 8) * B[i];
          }
        } else {
          const n = nb.length || 1;
          const c = Math.cos((2 * Math.PI) / n);
          const beta = (1 / n) * (5 / 8 - (3 / 8 + 0.25 * c) ** 2);
          const sum = [0, 0, 0];
          for (const w of nb) {
            const W = get(w);
            for (let i = 0; i < 3; i++) sum[i] += W[i];
          }
          for (let i = 0; i < 3; i++) {
            moved[v * 3 + i] = (1 - n * beta) * V[i] + beta * sum[i];
          }
        }
      }
      for (let v = 0; v < nV * 3; v++) out[v] = moved[v];

      /* four triangles where there was one */
      const NI = [];
      for (let f = 0; f < I.length / 3; f++) {
        const [a, b, c] = [I[f * 3], I[f * 3 + 1], I[f * 3 + 2]];
        const ab = edgePoint.get(ekey(a, b));
        const bc = edgePoint.get(ekey(b, c));
        const ca = edgePoint.get(ekey(c, a));
        NI.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      }

      posAcc.setArray(new Float32Array(out));
      idxAcc.setArray(new Uint32Array(NI));
      // normals are meaningless now; smoothNormals() runs again after this
      const nrm = prim.getAttribute('NORMAL');
      if (nrm) nrm.setArray(new Float32Array(out.length));
    }
  }
}

/*
 * The low-poly pieces worth subdividing. Not the dove: its mesh carries split
 * vertices along the wings and tail, and Loop subdivision pulls those apart
 * into visible cracks — the wing detaches from the body. Smooth normals alone
 * carry it well enough, which is what it gets.
 *
 * The balance is absent for the opposite reason: it is generated, so it is
 * simply built at a resolution that needs no help — and so are the award
 * sculptures, which arrive smooth, welded and dense. Nothing in ON_BASE
 * belongs here.
 */
/* Inert while every piece is an award: the call below is gated on
   !ON_BASE.has(cat) and ON_BASE now holds all six. Kept for the same reason
   the perch is — a borrowed stand-in would need it again. */
const SUBDIVIDE = new Set(['medicine', 'literature']);

/** merge the drum into `doc` at its origin, its materials marked as the base's */
async function addBase(doc, io, cat) {
  const base = await io.read(BASE);
  for (const mat of base.getRoot().listMaterials()) {
    mat.setName(BASE_PREFIX + (mat.getName() || 'material'));
  }
  /* Before the merge, not after: mergeDocuments copies, so anything done to
     the source document afterwards is done to the copy that gets thrown away. */
  for (const tex of base.getRoot().listTextures()) {
    tex.setImage(await dressMarble(tex.getImage(), cat)).setMimeType('image/png');
  }
  mergeDocuments(doc, base);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  // merge() brings the base's scenes in alongside ours; move their contents
  // into the piece's scene and drop the empty shells
  for (const s of doc.getRoot().listScenes()) {
    if (s === scene) continue;
    for (const child of s.listChildren()) { s.removeChild(child); scene.addChild(child); }
    s.dispose();
  }
  /* Now reshape the drum: a fifth off its foot, and the ring up under its top.
     Each adjustment goes on a wrapper node rather than onto the part's own
     transform. A node's scale is applied in its own frame, before its
     rotation — and the inlay ring is rotated, so scaling its local x and z
     would have squashed the wrong two axes. Wrapping puts the change outside
     the rotation, where the axes mean what they look like. */
  const parts = new Map();
  const find = (n, parent) => { const k = n.getName() || '';
    if (k === 'marble_column' || k === 'gold_inlay_ring' || k.startsWith('gold_band_')) parts.set(k, [n, parent]);
    n.listChildren().forEach((c) => find(c, n)); };
  scene.listChildren().forEach((n) => find(n, scene));

  const wrap = (entry, scale, lift) => {
    if (!entry) return;
    const [node, parent] = entry;
    const w = doc.createNode(`${node.getName()}__adjust`)
      .setScale(scale).setTranslation([0, lift, 0]);
    parent.removeChild(node);
    w.addChild(node);
    parent.addChild(w);
  };

  /* the column, scaled about its top face so the top — and every piece
     standing on it — does not move */
  wrap(parts.get('marble_column'),
       [1, 1 - DRUM_TRIM, 1], BASE_TOP * DRUM_TRIM);

  /* The drum's original ring is dropped — it sits a thousandth *inside* the
     marble and never showed. The three that replace it are cut into the drum
     by build-base-rings.mjs, and they ride the same wrapper the column does,
     so whatever is done to the marble is done to the bands on it. */
  const ringEntry = parts.get('gold_inlay_ring');
  if (ringEntry) ringEntry[1].removeChild(ringEntry[0]);
  for (const k of ['gold_band_1', 'gold_band_2', 'gold_band_3']) {
    const e = parts.get(k);
    if (e) wrap(e, [1, 1 - DRUM_TRIM, 1], BASE_TOP * DRUM_TRIM);
  }

  // the base brought its own buffer, and a GLB may only carry one
  const [keep, ...rest] = doc.getRoot().listBuffers();
  for (const acc of doc.getRoot().listAccessors()) acc.setBuffer(keep);
  for (const b of rest) b.dispose();
}

/** roll the marble round, stretch its veins, and light it from the right */
async function dressMarble(png, cat) {
  const img = sharp(png).removeAlpha();
  const { width, height } = await img.metadata();
  const [lo, hi] = VEIN_IN;
  const a = (hi - VEIN_FLOOR) / (hi - lo);
  const stretched = await img.linear(a, hi - a * hi).raw().toBuffer();

  const roll = Math.round(((VEIN_TURN[cat] ?? 0) / 6) * width);
  const out = Buffer.alloc(stretched.length);
  for (let x = 0; x < width; x++) {
    /* where this column sits round the drum, 0 at the face nearest the camera */
    const around = ((x / width) - LIGHT_PHASE + 1) % 1;
    // cosine fall-off, peaking a little to the right of front
    const k = LIGHT_DROP + (LIGHT_LIFT - LIGHT_DROP)
            * (0.5 + 0.5 * Math.cos((around - 0.12) * 2 * Math.PI));
    const src = (x + roll) % width;
    for (let y = 0; y < height; y++) {
      const s = (y * width + src) * 3;
      const d = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) out[d + c] = Math.min(255, Math.round(stretched[s + c] * k));
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/**
 * A cage the size of the canonical box, so all six frame alike.
 *
 * model-viewer will not simply take the camera it is given: it clamps the
 * orbit radius and the field of view against the model's own bounds so the
 * thing always fits, and a short piece therefore comes out drawn larger. The
 * measured effect was a field of view of 30.0° to 32.0° across the six and
 * drums between 117 and 140 pixels wide, from geometry that is identical in
 * every file. Pinning min/max-camera-orbit fixes the radius; nothing pins the
 * field of view. So the bounds themselves are made equal, with one triangle
 * spanning the box — two distinct corners and a repeat — which every bounding
 * box must contain.
 *
 * It carries a fully transparent material, and that is not belt and braces.
 * The triangle is degenerate as authored and should rasterise to nothing, but
 * quantization snaps its corners to the nearest grid point and the repeated one
 * does not always land where its twin does. What comes out is a sliver with
 * real area, in the default white, drawn straight across the piece: a hairline
 * slit through the gold cap of the chemistry award and the physics one beside
 * it, which read as the models themselves being broken.
 */
const CAGE = [0.28, 0.5, 0.28];
const CAGE_MAT = '__frame';

function addCage(doc, scene) {
  const [cx, cy, cz] = CAGE;
  const pos = new Float32Array([-cx, -cy, -cz, cx, cy, cz, cx, cy, cz]);
  const invisible = doc.createMaterial(CAGE_MAT)
    .setBaseColorFactor([0, 0, 0, 0])
    .setAlphaMode('BLEND')
    .setMetallicFactor(0)
    .setRoughnessFactor(1);
  const prim = doc.createPrimitive()
    .setMaterial(invisible)
    .setAttribute('POSITION', doc.createAccessor()
      .setType('VEC3').setArray(pos).setBuffer(doc.getRoot().listBuffers()[0]))
    .setIndices(doc.createAccessor()
      .setType('SCALAR').setArray(new Uint16Array([0, 1, 2]))
      .setBuffer(doc.getRoot().listBuffers()[0]));
  scene.addChild(doc.createNode('__frame').setMesh(doc.createMesh('__frame').addPrimitive(prim)));
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT_GOLD, { recursive: true });
// Quantised accessors and a WebP texture are only legal glTF if their
// extensions are declared, and gltf-transform drops an unregistered extension
// on write with nothing but a line on stderr to say so — leaving a file that
// still loads, wrongly.
const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTTextureWebP]);

for (const file of fs.readdirSync(SRC).sort()) {
  if (file.startsWith('_')) continue;          // the base is merged, not published
  const cat = path.basename(file, '.glb');
  const doc = await io.read(path.join(SRC, file));
  await doc.transform(dedup(), prune());
  /* Only the pieces that arrived flat-shaded. The award sculptures come in
     smooth and welded already, and re-deriving their normals is not free: at a
     seam where the faces meeting a corner cancel, the sum is the zero vector
     and the corner keeps a normal of no direction, which draws as a bright
     slit. One ran down the front of the chemistry award's cap. */
  if (!ON_BASE.has(cat)) {
    smoothNormals(doc);
    // welding is worth doing only now: before smoothing every corner carried
    // its own face normal and nothing could merge. Afterwards a sphere
    // collapses from three vertices a triangle to one a lattice point.
    await doc.transform(weld());
  } else if (SMOOTH_PARTS[cat]) {
    /* Named parts of an award, and only those — see SMOOTH_PARTS. The names
       have to be read before anything else touches the hierarchy, because the
       orientation wrapper and the perch below rearrange it. */
    const owners = meshOwners(doc);
    const wanted = SMOOTH_PARTS[cat];
    smoothNormals(doc, (mesh) => {
      const names = owners.get(mesh);
      return !!names && wanted.some((n) => names.has(n));
    });
  }

  if (SUBDIVIDE.has(cat) && !ON_BASE.has(cat)) {
    subdivide(doc);
    smoothNormals(doc);
    await doc.transform(weld());
  }

  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // a wrapper node carries the correction, so the source hierarchy is left
  // exactly as its author built it
  const spin = doc.createNode(`${cat}__orient`).setRotation(euler(ORIENT[cat]));
  for (const child of scene.listChildren()) { scene.removeChild(child); spin.addChild(child); }
  scene.addChild(spin);

  // measure only after the rotation, or the box describes the wrong pose
  const b = getBounds(scene);
  const size = b.max.map((v, i) => v - b.min[i]);

  if (!ON_BASE.has(cat)) {
    // sit the piece on the drum: centred on its axis, standing on its top face
    const norm = 1 / (Math.max(...size) || 1);
    const p = Math.min(PERCH_H / (size[1] * norm),
                       PERCH_W / (Math.max(size[0], size[2]) * norm));
    const s = norm * p;
    const perch = doc.createNode(`${cat}__perch`)
      .setScale([s, s, s])
      .setTranslation([
        -((b.max[0] + b.min[0]) / 2) * s,
        BASE_TOP - b.min[1] * s,
        -((b.max[2] + b.min[2]) / 2) * s,
      ]);
    scene.removeChild(spin);
    perch.addChild(spin);
    scene.addChild(perch);
  }

  /* Everything in the scene at this point is the piece; wrap it in the
     turntable before the drum joins it as a sibling that does not turn. */
  const turn = doc.createNode(`${cat}__turn`).setTranslation([0, CLEAR_LIFT, 0]);
  for (const child of [...scene.listChildren()]) { scene.removeChild(child); turn.addChild(child); }
  scene.addChild(turn);
  turntable(doc, turn, `${cat}__spin`);

  await addBase(doc, io, cat);

  /* One scale for all six, and one ground line.
   *
   * Fitting each assembly to its own bounding box — which is how the bare
   * pieces were framed — makes the drum a different size in every frame, because
   * a short piece leaves a short assembly and the whole thing is then scaled up
   * further to fill the box. The drum has to be the same drum in all six. So the
   * factor is fixed: the tallest an assembly can be is the drum plus a piece at
   * PERCH_H, and that is what maps to one unit. Shorter pieces simply reach less
   * far up the frame, which is what the reference sheet shows.
   *
   * The drum's foot goes to the bottom of that unit box rather than its centre,
   * so all six stand on the same line. Their frames only agree if the camera
   * stops framing each box in turn, so the halls pin camera-target to the origin.
   */
  /* One scale for all six and one ground line, both fixed rather than taken
     from each model's own box — see the note above. The drum's foot is where
     the cut left it, and that is what lands on the bottom of the unit box. */
  const s = 1 / (BASE_TOP + PERCH_H - DRUM_FOOT);
  const fit = doc.createNode(`${cat}__fit`)
    .setScale([s, s, s])
    .setTranslation([0, -0.5 - DRUM_FOOT * s, 0]);
  for (const child of [...scene.listChildren()]) { scene.removeChild(child); fit.addChild(child); }
  scene.addChild(fit);
  addCage(doc, scene);

  // one hall, one colour. Textures go with it — they only carried the old
  // palette, and the coin's dollar sign with it, which had no business on a
  // Swedish prize.
  const [r, g, bl] = linear(TINT[cat]);
  const [dr, dg, db] = linear(BASE_STONE_DARK);
  /* The gold cast is written from the same materials, after the dark one has
     already been through them — so the marble's authored white has to be kept
     here or the daylit museum inherits the dark vault's stone. */
  const marble = root.listMaterials().find((m) => m.getName() === BASE_MARBLE);
  const marbleWhite = marble ? [...marble.getBaseColorFactor()] : null;
  for (const mat of root.listMaterials()) {
    const name = mat.getName() || '';
    /* The cage must stay invisible. Its transparency is not enough on its own:
       this pass would set its alpha back to 1 and paint it the hall's colour,
       and what was drawn was a gold sliver across the piece. */
    if (name === CAGE_MAT) continue;
    if (name === BASE_MARBLE) { mat.setBaseColorFactor([dr, dg, db, 1]); continue; }
    if (name.startsWith(BASE_PREFIX)) continue;                    // the gold ring
    mat.setBaseColorFactor([r, g, bl, 1])
      .setBaseColorTexture(null)
      .setMetallicFactor(0.25)
      .setRoughnessFactor(0.5)
      .setEmissiveFactor([0, 0, 0])
      .setEmissiveTexture(null);
  }
  await doc.transform(prune());

  /* Subdivision roughly doubled these. Quantising positions and normals to
     fewer bits gives most of it back — a 14-bit position is finer than
     anything visible on a piece an inch across — at the cost of requiring
     KHR_mesh_quantization, which model-viewer has supported for years. */
  /* The drum's marble arrives as a 768x144 PNG, 170KB, and it is now carried
     by all six models in both casts, so it is worth re-encoding — but at its
     own size. Its veins are one and two pixels wide, and halving the
     resolution washed them out completely: the drum came back a blank white
     cylinder. WebP at full size keeps them and still costs a tenth of the PNG. */
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92 }),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
  );

  await io.write(path.join(OUT, `${cat}.glb`), doc);

  // the same geometry again, cast in gold, for the bright museum
  const [gr, gg, gb] = linear(GOLD.hex);
  for (const mat of root.listMaterials()) {
    const name = mat.getName() || '';
    if (name === CAGE_MAT) continue;                               // stays invisible
    if (name === BASE_MARBLE) { if (marbleWhite) mat.setBaseColorFactor(marbleWhite); continue; }
    if (name.startsWith(BASE_PREFIX)) continue;                    // the gold ring
    mat.setBaseColorFactor([gr, gg, gb, 1])
      .setMetallicFactor(GOLD.metallic)
      .setRoughnessFactor(GOLD.roughness);
  }
  await io.write(path.join(OUT_GOLD, `${cat}.glb`), doc);

  const after = getBounds(scene);
  const outSize = after.max.map((v, i) => v - after.min[i]);
  const kb = fs.statSync(path.join(OUT, `${cat}.glb`)).size / 1024;
  console.log(
    `${cat.padEnd(11)} ${kb.toFixed(0).padStart(4)}KB  ` +
    `${size.map((v) => v.toFixed(2)).join('×').padEnd(22)} → ` +
    `${outSize.map((v) => v.toFixed(2)).join('×')}`,
  );
}
