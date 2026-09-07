/**
 * rotunda.ts — the great hall as a real WebGL room.
 *
 * Built to match the reference render: a coffered dome over an oculus, fluted
 * columns in warm light, glossy cast-bronze sculptures on stepped plinths, and
 * a polished floor that reflects all of it.
 *
 * Everything is generated in code — there are no model or texture files, so the
 * only payload is three.js itself.
 *
 * Realism comes from four things, in order of how much they matter:
 *   1. a procedural environment map, so metal has something to reflect
 *   2. floor reflections (mirrored duplicates, cheaper than a render target)
 *   3. bloom on the hot highlights
 *   4. contact shadows, so nothing floats
 *
 * Budget discipline: DPR capped, no shadow maps, bloom at half resolution, and
 * the loop stops the moment the canvas leaves the viewport or the tab hides.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BackSide, BoxGeometry, BufferGeometry,
  CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, Group,
  IcosahedronGeometry, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PointLight, Points, PointsMaterial, Scene,
  SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer, Fog,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeStudioEnv, makeShadowTexture } from './env';
import { motionOn } from './motion';

export interface RotundaOptions {
  canvas: HTMLCanvasElement;
  cats: { key: string; color: string; href: string; label: string }[];
  stills: string[];
}

const TAU = Math.PI * 2;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createRotunda(opts: RotundaOptions) {
  const { canvas, cats, stills } = opts;

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new Scene();
  scene.background = new Color('#0b0703');
  scene.fog = new Fog('#0a0602', 18, 54);

  const env = makeStudioEnv(renderer);
  scene.environment = env;

  const camera = new PerspectiveCamera(48, 1, 0.1, 200);

  /* ================= materials ================= */
  const bronze = (hex: string, rough: number, metal: number, emissive = 0) =>
    new MeshStandardMaterial({
      color: new Color(hex), roughness: rough, metalness: metal,
      envMapIntensity: 1.5,
      ...(emissive ? { emissive: new Color(hex), emissiveIntensity: emissive } : {}),
    });

  const matStone = bronze('#5a3a18', 0.92, 0.08);
  const matStoneDark = bronze('#2e1d0c', 0.95, 0.06);
  const matTrim = bronze('#8a5a22', 0.42, 0.85);

  /* ================= floor ================= */
  const FLOOR_Y = 0;
  const floor = new Mesh(
    new CylinderGeometry(40, 40, 0.4, 72),
    new MeshStandardMaterial({
      color: new Color('#160d05'), roughness: 0.2, metalness: 0.88, envMapIntensity: 1.15,
    }),
  );
  floor.position.y = FLOOR_Y - 0.2;
  scene.add(floor);

  // everything mirrored lives here; the floor material is glossy enough to sell it
  const mirror = new Group();
  mirror.scale.y = -1;
  mirror.position.y = FLOOR_Y * 2;
  scene.add(mirror);

  /* ================= drum, dome, oculus ================= */
  const R_WALL = 18;
  const drum = new Mesh(new CylinderGeometry(R_WALL, R_WALL, 13, 72, 1, true), matStone);
  drum.material.side = BackSide;
  drum.position.y = 6.5;
  scene.add(drum);

  // cornice
  const cornice = new Mesh(new TorusGeometry(R_WALL - 0.3, 0.55, 8, 80), matTrim);
  cornice.rotation.x = Math.PI / 2; cornice.position.y = 13;
  scene.add(cornice);

  // coffered dome — rings and radial ribs converging on a bright oculus
  const dome = new Mesh(
    new SphereGeometry(R_WALL, 64, 32, 0, TAU, 0, Math.PI / 2.35),
    bronze('#4a2f12', 0.9, 0.12),
  );
  dome.material.side = BackSide;
  dome.position.y = 13;
  scene.add(dome);

  for (let r = 1; r <= 5; r++) {
    const phi = (r / 6) * (Math.PI / 2.35);
    const rad = Math.sin(phi) * R_WALL;
    const y = 13 + Math.cos(phi) * R_WALL * 0.98;
    const ring = new Mesh(new TorusGeometry(rad, 0.22, 6, 64), matTrim);
    ring.rotation.x = Math.PI / 2; ring.position.y = y;
    scene.add(ring);
  }
  const ribGeo = new BoxGeometry(0.3, 0.3, R_WALL * 1.15);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const rib = new Mesh(ribGeo, matTrim);
    rib.position.set(Math.cos(a) * R_WALL * 0.5, 13 + R_WALL * 0.44, Math.sin(a) * R_WALL * 0.5);
    rib.lookAt(0, 13 + R_WALL, 0);
    scene.add(rib);
  }
  const oculus = new Mesh(
    new CylinderGeometry(3.2, 3.2, 0.3, 40),
    new MeshBasicMaterial({ color: new Color('#fff3dc') }),
  );
  oculus.position.y = 13 + R_WALL * 0.95;
  scene.add(oculus);

  /* ================= colonnade ================= */
  // fluted shafts: a lathe profile with a swell (entasis), plus capital and base
  const prof: Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new Vector2(0.7 - Math.sin(t * Math.PI) * 0.06 - t * 0.09, t * 10.4));
  }
  const shaftGeo = new LatheGeometry(prof, 20);
  const capGeo = new CylinderGeometry(1.24, 0.86, 0.9, 20);
  const abaGeo = new BoxGeometry(2.5, 0.4, 2.5);
  const baseGeo = new CylinderGeometry(1.05, 1.22, 0.8, 20);

  const colonnade = new Group();
  // the arc facing the camera is deliberately empty — a colonnade all the way
  // round puts a column right in front of the lens
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const towardCamera = Math.sin(a) > 0.42;
    if (towardCamera) continue;
    const x = Math.cos(a) * (R_WALL - 2.6), z = Math.sin(a) * (R_WALL - 2.6);
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = -a;
    const shaft = new Mesh(shaftGeo, matStone); shaft.position.y = 0.8; g.add(shaft);
    const cap = new Mesh(capGeo, matTrim); cap.position.y = 11.5; g.add(cap);
    const aba = new Mesh(abaGeo, matStoneDark); aba.position.y = 12.1; g.add(aba);
    const base = new Mesh(baseGeo, matTrim); base.position.y = 0.4; g.add(base);
    colonnade.add(g);
  }
  scene.add(colonnade);
  mirror.add(colonnade.clone());

  /* ================= wall of lecture stills ================= */
  const wallGroup = new Group();
  const panelGeo = new PlaneGeometry(3.5, 1.97);
  const frameGeo = new PlaneGeometry(3.86, 2.33);
  const panels: MeshBasicMaterial[] = [];
  const N = Math.min(9, Math.max(5, stills.length));
  for (let i = 0; i < N; i++) {
    const a = -1.02 + (i / (N - 1)) * 2.04;
    const pos = new Vector3(Math.sin(a) * 13.4, 6.4, -Math.cos(a) * 13.4);
    const mat = new MeshBasicMaterial({ color: new Color('#241708'), toneMapped: false });
    const m = new Mesh(panelGeo, mat);
    m.position.copy(pos); m.rotation.y = a;
    wallGroup.add(m); panels.push(mat);
    const fr = new Mesh(frameGeo, matTrim);
    fr.position.copy(pos).multiplyScalar(1.006); fr.rotation.y = a;
    wallGroup.add(fr);
  }
  scene.add(wallGroup);

  /*
   * The wall has to move — a still gallery does not read as a video museum.
   * A cross-origin YouTube iframe cannot be sampled into a WebGL texture, so
   * each panel cycles the three real frames YouTube publishes per video
   * (1/2/3.jpg, ~3.5 KB each). Real lecture imagery, in motion, for almost
   * nothing.
   */
  type Panel = { mat: MeshBasicMaterial; canvas: HTMLCanvasElement; tex: CanvasTexture | null; frames: HTMLImageElement[]; at: number; blend: number };
  const wallPanels: Panel[] = [];

  stills.slice(0, N).forEach((url, i) => {
    const vid = url.match(/\/vi\/([\w-]{11})\//)?.[1];
    if (!vid) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 144;
    const panel: Panel = { mat: panels[i], canvas, tex: null, frames: [], at: 0, blend: 1 };
    wallPanels.push(panel);

    for (const n of [1, 2, 3]) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        panel.frames.push(img);
        if (panel.frames.length === 1) drawPanel(panel, 0);
      };
      img.src = `https://i.ytimg.com/vi/${vid}/${n}.jpg`;
    }
  });

  /**
   * `blend` is how far the incoming frame has come up over the outgoing one.
   * With only three frames per video, a hard cut every second reads as a
   * strobe rather than as footage; fading between them at least reads as a
   * dissolve.
   */
  function drawPanel(p: Panel, idx: number, blend = 1) {
    const g = p.canvas.getContext('2d');
    const n = Math.max(1, p.frames.length);
    const img = p.frames[idx % n];
    const prev = p.frames[(idx - 1 + n) % n];
    if (!g || !img) return;
    g.globalAlpha = 1;
    if (prev && blend < 1) g.drawImage(prev, 0, 0, p.canvas.width, p.canvas.height);
    g.globalAlpha = prev ? blend : 1;
    g.drawImage(img, 0, 0, p.canvas.width, p.canvas.height);
    g.globalAlpha = 1;
    if (!p.tex) {
      p.tex = new CanvasTexture(p.canvas);
      p.tex.colorSpace = SRGBColorSpace;
      p.mat.map = p.tex;
      p.mat.color.setHex(0xa89070);
      p.mat.needsUpdate = true;
    } else {
      p.tex.needsUpdate = true;
    }
  }

  /* Three frames is not footage, so do not pretend otherwise by cutting fast.
     Hold each frame for three and a half seconds and dissolve over one, which
     reads as a slow archive rather than a slideshow stuck on shuffle. */
  const WALL_HOLD = 3500;
  const WALL_FADE = 1000;
  let wallTick = 0;
  function advanceWall(now: number) {
    const since = now - wallTick;
    if (since < WALL_HOLD) {
      // finish the dissolve started at the last tick
      for (const p of wallPanels) {
        if (p.frames.length < 2 || p.blend >= 1) continue;
        p.blend = Math.min(1, since / WALL_FADE);
        drawPanel(p, p.at, p.blend);
      }
      return;
    }
    wallTick = now;
    for (const p of wallPanels) {
      if (p.frames.length < 2) continue;
      p.at++;
      p.blend = 0;
      drawPanel(p, p.at, 0);
    }
  }

  /* ================= lighting ================= */
  const oculusLight = new PointLight('#ffe3b6', 430, 58, 2);
  oculusLight.position.set(0, 24, 0);
  scene.add(oculusLight);
  const stage = new PointLight('#ffcd8c', 190, 32, 2);
  stage.position.set(0, 8.5, 7);
  scene.add(stage);
  const rimL = new PointLight('#ff8f36', 90, 34, 2);
  rimL.position.set(-10, 4, -7); scene.add(rimL);
  const rimR = new PointLight('#ffd9a8', 78, 32, 2);
  rimR.position.set(10, 3.5, 8); scene.add(rimR);

  /* ================= sculptures ================= */
  const sphereGeo = new IcosahedronGeometry(1, 3);
  const rodGeo = new CylinderGeometry(1, 1, 1, 14);

  const rod = (mat: MeshStandardMaterial, from: Vector3, to: Vector3, r: number) => {
    const m = new Mesh(rodGeo, mat);
    const d = new Vector3().subVectors(to, from);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.scale.set(r, d.length(), r);
    m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
    return m;
  };
  const ball = (mat: MeshStandardMaterial, x: number, y: number, z: number, r: number) => {
    const m = new Mesh(sphereGeo, mat); m.position.set(x, y, z); m.scale.setScalar(r); return m;
  };

  function buildSculpture(key: string, mat: MeshStandardMaterial): Group {
    const g = new Group();
    switch (key) {
      case 'physics': {
        g.add(ball(mat, 0, 1.75, 0, 0.36));
        for (let i = 0; i < 3; i++) {
          const t = new Mesh(new TorusGeometry(1.32, 0.075, 12, 96), mat);
          t.position.y = 1.75;
          t.rotation.set(Math.PI / 2.5, (i * TAU) / 3, 0.2);
          g.add(t);
        }
        g.add(rod(mat, new Vector3(0, 0, 0), new Vector3(0, 1.42, 0), 0.075));
        break;
      }
      case 'chemistry': {
        const pts: Vector3[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + Math.PI / 6;
          pts.push(new Vector3(Math.cos(a) * 0.95, 1.9 + Math.sin(a) * 0.95, 0));
        }
        pts.forEach((p, i) => { g.add(ball(mat, p.x, p.y, p.z, 0.2)); g.add(rod(mat, p, pts[(i + 1) % 6], 0.07)); });
        g.add(ball(mat, 0, 3.2, 0, 0.15));
        g.add(rod(mat, new Vector3(0, 2.9, 0), new Vector3(0, 3.16, 0), 0.05));
        g.add(rod(mat, new Vector3(0, 0, 0), new Vector3(0, 0.98, 0), 0.075));
        break;
      }
      case 'medicine': {
        for (let s = 0; s < 2; s++) {
          let prev: Vector3 | null = null;
          for (let i = 0; i <= 30; i++) {
            const t = i / 30, a = t * Math.PI * 3 + s * Math.PI;
            const p = new Vector3(Math.cos(a) * 0.58, 0.42 + t * 2.85, Math.sin(a) * 0.58);
            g.add(ball(mat, p.x, p.y, p.z, 0.12));
            if (prev) g.add(rod(mat, prev, p, 0.05));
            prev = p;
            if (s === 0 && i % 5 === 0) g.add(rod(mat, p, new Vector3(-p.x, p.y, -p.z), 0.035));
          }
        }
        break;
      }
      case 'peace': {
        const dove = new Group();
        const body = new Mesh(new SphereGeometry(1, 24, 16), mat);
        body.scale.set(0.9, 0.3, 0.3); body.rotation.z = 0.16; dove.add(body);
        const tail = new Mesh(new SphereGeometry(1, 14, 10), mat);
        tail.position.set(-1.0, -0.16, 0); tail.scale.set(0.46, 0.15, 0.05);
        tail.rotation.z = 0.42; dove.add(tail);
        for (const side of [-1, 1]) {
          const wing = new Mesh(new SphereGeometry(1, 20, 14), mat);
          wing.position.set(-0.05, 0.4, side * 0.22);
          wing.scale.set(0.24, 0.86, 0.05);
          wing.rotation.set(side * 0.52, 0, -0.24);
          dove.add(wing);
        }
        const head = new Mesh(sphereGeo, mat);
        head.position.set(0.9, 0.24, 0); head.scale.setScalar(0.22); dove.add(head);
        const beak = new Mesh(new CylinderGeometry(0.01, 0.07, 0.3, 8), mat);
        beak.position.set(1.16, 0.22, 0); beak.rotation.z = -Math.PI / 2; dove.add(beak);
        dove.position.set(0, 2.25, 0); dove.rotation.y = -0.32;
        g.add(dove);
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
          const leaf = new Mesh(new SphereGeometry(1, 10, 8), mat);
          leaf.position.set(side * (0.28 + i * 0.18), 0.4 + i * 0.13, 0);
          leaf.scale.set(0.17, 0.06, 0.045); leaf.rotation.z = side * -0.5;
          g.add(leaf);
        }
        g.add(rod(mat, new Vector3(0, 0, 0), new Vector3(0, 2.0, 0), 0.07));
        break;
      }
      case 'economics': {
        g.add(rod(mat, new Vector3(0, 0, 0), new Vector3(0, 2.75, 0), 0.085));
        g.add(rod(mat, new Vector3(-1.45, 2.68, 0), new Vector3(1.45, 2.68, 0), 0.06));
        g.add(ball(mat, 0, 2.84, 0, 0.16));
        for (const s of [-1, 1]) {
          g.add(rod(mat, new Vector3(s * 1.4, 2.66, 0), new Vector3(s * 1.4, 2.06, 0), 0.026));
          const dish = new Mesh(new CylinderGeometry(0.5, 0.34, 0.14, 26), mat);
          dish.position.set(s * 1.4, 1.99, 0); g.add(dish);
        }
        const base = new Mesh(new CylinderGeometry(0.7, 0.84, 0.18, 26), mat);
        base.position.y = 0.09; g.add(base);
        break;
      }
      case 'literature': {
        const book = new Group();
        for (const side of [-1, 1]) {
          const page = new Mesh(new BoxGeometry(1.5, 0.11, 1.8), mat);
          page.position.set(side * 0.74, 0, 0); page.rotation.z = side * 0.28;
          book.add(page);
        }
        book.add(new Mesh(new BoxGeometry(0.14, 0.13, 1.8), mat));
        book.position.y = 1.9; book.rotation.x = -0.2;
        g.add(book);
        const quill = new Mesh(new CylinderGeometry(0.014, 0.05, 1.25, 10), mat);
        quill.position.set(0.6, 2.6, 0.34); quill.rotation.set(0.2, 0, -0.3);
        g.add(quill);
        const feather = new Mesh(new SphereGeometry(1, 14, 10), mat);
        feather.position.set(0.8, 3.08, 0.28); feather.scale.set(0.12, 0.4, 0.045);
        feather.rotation.z = -0.3; g.add(feather);
        g.add(rod(mat, new Vector3(0, 0, 0), new Vector3(0, 1.8, 0), 0.075));
        break;
      }
    }
    return g;
  }

  // stepped plinth, turned on a lathe
  const plinthProf: Vector2[] = [
    new Vector2(0, 0), new Vector2(1.65, 0), new Vector2(1.65, 0.22), new Vector2(1.46, 0.34),
    new Vector2(1.42, 0.92), new Vector2(1.6, 1.04), new Vector2(1.6, 1.2), new Vector2(0, 1.2),
  ];
  const plinthGeo = new LatheGeometry(plinthProf, 40);
  const shadowTex = makeShadowTexture();
  const shadowGeo = new PlaneGeometry(6, 6);

  const spinners: { g: Group; base: number; phase: number }[] = [];
  const targets: { key: string; pos: Vector3 }[] = [];

  cats.forEach((c, i) => {
    const a = -1.16 + (i / (cats.length - 1)) * 2.32;
    const R = 8.4;
    const x = Math.sin(a) * R, z = -Math.cos(a) * R + 4.4;

    const holder = new Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = a * 0.5;

    const plinth = new Mesh(plinthGeo, bronze('#4a2f13', 0.55, 0.55));
    holder.add(plinth);

    const mat = bronze(c.color, 0.22, 1.0, 0.1);
    const s = buildSculpture(c.key, mat);
    s.position.y = 1.2;
    s.scale.setScalar(1.18);
    holder.add(s);

    const sh = new Mesh(shadowGeo, new MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85,
    }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02;
    holder.add(sh);

    const halo = new PointLight(c.color, 14, 7, 2);
    halo.position.set(0, 2.6, 1.1);
    holder.add(halo);

    scene.add(holder);

    // the reflection: the same object, flipped, dimmed by the glossy floor
    const refl = holder.clone(true);
    refl.traverse((o) => {
      if ((o as Mesh).isMesh) {
        const m = (o as Mesh).material as MeshStandardMaterial;
        const c2 = m.clone();
        c2.transparent = true; c2.opacity = 0.26; c2.depthWrite = false;
        (o as Mesh).material = c2;
      }
    });
    mirror.add(refl);

    spinners.push({ g: s, base: 1.2, phase: i * 1.1 });
    targets.push({ key: c.key, pos: new Vector3(x, 2.4, z) });
  });

  /* ================= dust ================= */
  const dn = 340, dp = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) {
    const a = Math.random() * TAU, r = 3 + Math.random() * 20;
    dp[i * 3] = Math.cos(a) * r;
    dp[i * 3 + 1] = Math.random() * 17;
    dp[i * 3 + 2] = Math.sin(a) * r;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(dp, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    color: new Color('#ffd79a'), size: 0.075, transparent: true, opacity: 0.55,
    blending: AdditiveBlending, depthWrite: false,
  }));
  scene.add(dust);

  /* ================= post ================= */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.42, 0.55, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ================= camera choreography ================= */
  const HOME = { pos: new Vector3(0, 5.4, 19.8), look: new Vector3(0, 4.2, -1.2) };
  const START = { pos: new Vector3(0, 2.1, 36), look: new Vector3(0, 9.6, -1.2) };
  let px = 0, py = 0, cx = 0, cy = 0;

  type Flight = { from: Vector3; fromLook: Vector3; to: Vector3; toLook: Vector3; t0: number; dur: number; done?: () => void };
  let flight: Flight | null = null;
  const lookNow = HOME.look.clone();

  camera.position.copy(START.pos);
  camera.lookAt(START.look);

  function fly(to: Vector3, toLook: Vector3, dur: number, done?: () => void) {
    flight = { from: camera.position.clone(), fromLook: lookNow.clone(), to, toLook, t0: performance.now(), dur, done };
  }

  /* ================= loop ================= */
  let raf = 0, running = false, t = 0, last = performance.now();


  /*
   * Adaptive quality. Software renderers (no GPU acceleration, some VMs and
   * locked-down machines) can take 300ms a frame, which starves the main
   * thread — timers stop firing and the page feels broken. So: cap the frame
   * rate to leave headroom, watch the real frame cost, and step down twice
   * before giving up and leaving a still image.
   */
  const MIN_FRAME_MS = 1000 / 36;
  let lastDraw = 0, sampled = 0, costSum = 0, tier = 0;
  let usePost = true;

  function degrade() {
    if (tier === 0) {
      tier = 1; usePost = false;                 // bloom is the expensive pass
      renderer.setPixelRatio(1);
      resize();
    } else if (tier === 1) {
      tier = 2;
      // Giving up mid-flight would freeze a half-finished camera move, and
      // resizing clears the buffer — so settle on the intended composition and
      // draw one good frame before we stop.
      flight = null;
      camera.position.copy(HOME.pos);
      lookNow.copy(HOME.look);
      resize();                       // aspect must be right for the frame we keep
      camera.lookAt(lookNow);
      renderer.render(scene, camera);
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.setAttribute('data-static', '');
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(now: number) {
    raf = running ? requestAnimationFrame(frame) : 0;
    if (now - lastDraw < MIN_FRAME_MS) return;      // leave the thread room to breathe
    const drawStart = performance.now();   // the rAF stamp lags actual execution
    lastDraw = now;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    if (flight) {
      const p = Math.min(1, (now - flight.t0) / (flight.dur * 1000));
      const k = easeInOut(p);
      camera.position.lerpVectors(flight.from, flight.to, k);
      lookNow.lerpVectors(flight.fromLook, flight.toLook, k);
      camera.lookAt(lookNow);
      if (p >= 1) { const d = flight.done; flight = null; d?.(); }
    } else {
      cx += (px - cx) * 0.045;
      cy += (py - cy) * 0.045;
      camera.position.x = HOME.pos.x + cx * 3.2;
      camera.position.y = HOME.pos.y + cy * 1.4;
      camera.position.z = HOME.pos.z;
      lookNow.copy(HOME.look);
      camera.lookAt(lookNow);
    }

    for (const s of spinners) {
      s.g.rotation.y = Math.sin(t * 0.42 + s.phase) * 0.5;
      s.g.position.y = s.base + Math.sin(t * 0.9 + s.phase) * 0.045;
    }
    dust.rotation.y = t * 0.014;
    advanceWall(now);
    oculusLight.intensity = 430 + Math.sin(t * 0.7) * 22;

    if (usePost) composer.render(); else renderer.render(scene, camera);

    // Measure honestly and react fast. A machine drawing at 300ms a frame
    // starves the main thread, so timers stop firing and the page feels
    // broken — better to show one good still frame than a stuttering room.
    if (tier < 2) {
      costSum += performance.now() - drawStart;
      sampled++;
      const avg = costSum / sampled;
      if (sampled >= 6 && avg > 90) { tier = 0; degrade(); degrade(); }
      else if (sampled >= 18) {
        if (avg > 42) degrade();
        sampled = 0; costSum = 0;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    if (!motionOn()) { camera.position.copy(HOME.pos); lookNow.copy(HOME.look); camera.lookAt(lookNow); composer.render(); running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  resize();
  start();
  // the entrance: a slow dolly in from the doorway
  if (motionOn()) fly(HOME.pos.clone(), HOME.look.clone(), 3.4);

  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.02 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('resize', () => { resize(); }, { passive: true });
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      px = e.clientX / innerWidth - 0.5;
      py = 0.5 - e.clientY / innerHeight;
    }, { passive: true });
  }

  /** fly the camera into a gallery, then hand back so the page can navigate */
  function walkInto(key: string, done: () => void) {
    const target = targets.find((x) => x.key === key);
    if (!target || !motionOn()) { done(); return; }
    start();
    const to = target.pos.clone().add(new Vector3(0, 0.2, 3.2));
    fly(to, target.pos.clone(), 1.15, done);
  }

  // the visitor may switch motion on after arrival
  addEventListener('motionpref', () => {
    if (motionOn()) { start(); } else { stop(); camera.position.copy(HOME.pos); lookNow.copy(HOME.look); camera.lookAt(lookNow); composer.render(); }
  });

  return { stop, start, walkInto, renderer };
}
