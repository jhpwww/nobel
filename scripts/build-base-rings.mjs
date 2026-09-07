/**
 * build-base-rings.mjs — cut the three gold bands into the drum itself.
 *
 * They were drawn by the page: three SVG arcs laid over the model, their depth
 * worked out from two constants measured off the drum's own ellipses. That is
 * a good approximation and it was wrong three times, for three different
 * reasons — the arcs sagged less than the base they were on, then more, and
 * the numbers only ever held at the one frame aspect they were measured at.
 * A band that is part of the object cannot disagree with it: it turns with the
 * turntable, it is lit by the same light, and its perspective is whatever the
 * camera says it is.
 *
 * The source drum is not touched. This reads assets-src/models/_base.glb and
 * writes _base-ringed.glb beside it; the pipeline consumes the ringed one.
 *
 *     node scripts/build-base-rings.mjs
 *
 * ---------------------------------------------------------------------------
 * Geometry
 *
 * Each band is a strip of the cylinder's own surface, a whisker proud of it:
 * two rings of vertices at h ± HALF, at radius R + PROUD, joined into quads.
 * Radially outward normals, so it catches the light as the marble beside it
 * does rather than as a flat decal would.
 *
 * The heights are computed through the pipeline rather than measured off a
 * screenshot, because there are three transforms between here and the frame
 * and a figure read off the render has all three baked into it — which is how
 * the first attempt landed a whole step low, trimmed twice.
 *
 * The chain, in order: normalise-models wraps the drum in [1, 0.8, 1] with a
 * lift of 0.0356 to take a fifth off its foot, so y_post = 0.8·y + 0.0356;
 * the assembly is then scaled by 1/(0.178 + 0.525 − 0.0356) = 1.4984 and slid
 * to put the drum's foot on the cage's floor, so cage = 1.4984·y_post −
 * 0.55334; and the cage's ±0.5 fills the model's drawn height in the frame.
 * Put together, the middle band has to sit at 0.13806 for the device on the
 * plinth to be centred on it, and a step of 0.016631 is the quarter of the
 * device's height the drawn version used.
 *
 * The label is positioned to the bands now, not the other way round — the drum
 * is the object and the type is the annotation.
 *
 * And each band stops short of the front, so the device sits in a clearing
 * rather than on a line. 17.5° each side of centre is the 140% of the device's
 * width that the drawn version used, at the size the hall draws it.
 *
 * "The front" is the camera's, not the model's. Every hall, the gallery pages
 * and the poster renderer look at these from camera-orbit 35deg, so the point
 * of the drum facing the viewer — and therefore the point the device is drawn
 * over, since the device is centred in the frame — is the one at 35° round the
 * axis, not the one at zero. Centring the clearing on the model's +Z put it a
 * third of a turn to the left of the device, with the bands running straight
 * behind it. FRONT below must track CAMERA in HallBright.astro,
 * GalleryPage.astro, LecturePage.astro, HallModels.astro and
 * render-posters.mjs; they all carry the same '35deg 98deg 1.55m'.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';

const SRC = 'assets-src/models/_base.glb';
const OUT = 'assets-src/models/_base-ringed.glb';

/** the marble column: radius and top, read from the source and asserted below */
const R = 0.1512;
const PROUD = 0.0004;     // how far the band stands off the marble
const HALF = 0.0013;      // half its height

/** where the three sit, in model units up from the drum's foot */
const MIDDLE = 0.13806;
const STEP = 0.016631;
const HEIGHTS = [MIDDLE - STEP, MIDDLE, MIDDLE + STEP];

/** where the camera stands, in degrees round the axis — see the note above */
const FRONT = 35;
/** the clearing there, in degrees each side of it */
/* 26°: the clearing is where the label is cut into the marble, and a chord
   subtends sin(θ) of the drum's width, so 26° gives the device and the name
   43.8% of the face to sit in. Beyond about 30° the bands stop reading as
   rings round a drum and start reading as two brackets, so this is most of
   the room there is. */
const GAP = 26;
const SEGMENTS = 160;     // round enough that the silhouette has no facets

function band(h) {
  const f = (FRONT * Math.PI) / 180;
  const a0 = f + (GAP * Math.PI) / 180;
  const a1 = f + 2 * Math.PI - (GAP * Math.PI) / 180;
  const n = SEGMENTS;
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= n; i++) {
    /* from one side of the clearing round the back to the other */
    const a = a0 + ((a1 - a0) * i) / n;
    const cx = Math.sin(a), cz = Math.cos(a);      // FRONT rad faces the camera
    const x = (R + PROUD) * cx, z = (R + PROUD) * cz;
    pos.push(x, h + HALF, z, x, h - HALF, z);
    nrm.push(cx, 0, cz, cx, 0, cz);
    if (i < n) {
      const t = i * 2;
      idx.push(t, t + 1, t + 2, t + 1, t + 3, t + 2);
    }
  }
  return {
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    idx: new Uint16Array(idx),
  };
}

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

/* the source has to be the drum this was measured on, or the heights are
   fiction — check the column rather than trust the filename */
const column = root.listNodes().find((n) => n.getName() === 'marble_column');
if (!column) throw new Error('no marble_column in ' + SRC);
const cpos = column.getMesh().listPrimitives()[0].getAttribute('POSITION');
const cr = cpos.getMax([])[0];
if (Math.abs(cr - R) > 0.002) throw new Error(`column radius ${cr}, expected ${R}`);

const gold = root.listMaterials().find((m) => m.getName() === 'polished_gold');
if (!gold) throw new Error('no polished_gold material in ' + SRC);

const buffer = root.listBuffers()[0];
HEIGHTS.forEach((h, i) => {
  const g = band(h);
  const prim = doc.createPrimitive()
    .setMaterial(gold)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.nrm).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.idx).setBuffer(buffer));
  const name = `gold_band_${i + 1}`;
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const kb = fs.statSync(OUT).size / 1024;
console.log(`${OUT}  ${kb.toFixed(0)} KB  — three bands at ` +
  HEIGHTS.map((h) => h.toFixed(4)).join(', ') +
  `, ${GAP}° clear each side of ${FRONT}°, which is where the camera stands`);
