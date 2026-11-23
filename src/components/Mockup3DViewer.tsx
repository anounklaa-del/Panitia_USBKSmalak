import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, FlipHorizontal2, RotateCcw } from 'lucide-react';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import type { PrepressConfig } from '../types/prepress';
import { renderBackCardCanvas, renderFrontCardCanvas } from '../utils/cardRenderer';

interface Mockup3DViewerProps {
  student: StudentRecord;
  config: PrepressConfig;
  deskLabel?: string;
  schedulesMap?: Record<string, ScheduleRow[]>;
}

type MockupMode = 'card' | 'bifold' | 'bleedSheet';

/**
 * Generates a subtle procedural paper fiber normal/roughness grain texture
 * for realistic laminated cardstock tactile shading.
 */
function createPaperRoughnessTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const grain = 188 + Math.floor((Math.sin(i * 12.9898) * 43758.5453 - Math.floor(Math.sin(i * 12.9898) * 43758.5453)) * 42);
    data[i * 4] = grain;
    data[i * 4 + 1] = grain;
    data[i * 4 + 2] = grain;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds an untrimmed proof texture showing the card + 3mm bleed area + crop/fold marks.
 */
function buildProofSheetOverlayCanvas(
  cardCanvas: HTMLCanvasElement,
  cardW: number,
  cardH: number,
  bleedMm: number,
): HTMLCanvasElement {
  const padExtraMm = 5;
  const pxPerMm = cardCanvas.width / (cardW + bleedMm * 2);
  const fullW = Math.round((cardW + (bleedMm + padExtraMm) * 2) * pxPerMm);
  const fullH = Math.round((cardH + (bleedMm + padExtraMm) * 2) * pxPerMm);
  const out = document.createElement('canvas');
  out.width = fullW;
  out.height = fullH;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, fullW, fullH);

  const offsetPx = padExtraMm * pxPerMm;
  ctx.drawImage(cardCanvas, offsetPx, offsetPx);

  const bleedPx = (padExtraMm + bleedMm) * pxPerMm;
  const trimW = cardW * pxPerMm;
  const trimH = cardH * pxPerMm;

  // Cyan 3mm Bleed boundary
  ctx.strokeStyle = '#00AEEF';
  ctx.lineWidth = Math.max(1.5, pxPerMm * 0.22);
  ctx.setLineDash([pxPerMm * 1.4, pxPerMm * 1.0]);
  ctx.strokeRect(offsetPx, offsetPx, cardCanvas.width, cardCanvas.height);

  // Magenta fold mark along middle
  ctx.strokeStyle = '#EC008C';
  ctx.setLineDash([pxPerMm * 1.5, pxPerMm * 0.9]);
  const midY = bleedPx + trimH / 2;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(offsetPx * 0.85, midY);
  ctx.moveTo(fullW - offsetPx * 0.85, midY);
  ctx.lineTo(fullW, midY);
  ctx.stroke();

  // Solid black Crop Marks at TrimBox corners
  ctx.setLineDash([]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2, pxPerMm * 0.28);
  const mLen = padExtraMm * 0.85 * pxPerMm;
  const corners: Array<[number, number, number, number]> = [
    [bleedPx, bleedPx, -1, -1],
    [bleedPx + trimW, bleedPx, 1, -1],
    [bleedPx, bleedPx + trimH, -1, 1],
    [bleedPx + trimW, bleedPx + trimH, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 4);
    ctx.lineTo(cx, cy + dy * mLen);
    ctx.moveTo(cx + dx * 4, cy);
    ctx.lineTo(cx + dx * mLen, cy);
    ctx.stroke();
  }

  return out;
}

export const Mockup3DViewer: React.FC<Mockup3DViewerProps> = ({
  student,
  config,
  deskLabel,
  schedulesMap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<MockupMode>('card');
  const [foldAngleDeg, setFoldAngleDeg] = useState<number>(38);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [isLoadingTex, setIsLoadingTex] = useState(true);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const pivotTopRef = useRef<THREE.Group | null>(null);
  const cardMeshGroupRef = useRef<THREE.Group | null>(null);
  const bifoldGroupRef = useRef<THREE.Group | null>(null);
  const sheetMeshRef = useRef<THREE.Mesh | null>(null);
  const animTimerRef = useRef<number | null>(null);

  // Store texture handles for clean disposal & live updates when student/schedule changes
  const frontMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const backMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sheetMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const activeTexturesRef = useRef<THREE.Texture[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software|WARP|Mesa/i.test(rendererStr);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSoftwareGl ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe5f0');
    scene.fog = new THREE.Fog('#dfe5f0', 9, 22);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(1.9, 1.45, 2.75);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.1;
    controls.maxDistance = 7.5;
    controls.maxPolarAngle = Math.PI * 0.85;
    controlsRef.current = controls;

    // 3-Point Studio Lighting (Key Warm + Cool Fill + Back Rim)
    const keyLight = new THREE.DirectionalLight('#fff8ed', 1.65);
    keyLight.position.set(3.2, 4.5, 3.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 14;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.015;
    }
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight('#e0ecff', '#cbd5e1', 0.55);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#dbeafe', 0.9);
    rimLight.position.set(-3.0, 2.2, -3.5);
    scene.add(rimLight);

    // Subtle Drafting Cutting Mat Base
    const deskGeo = new THREE.PlaneGeometry(18, 18);
    const deskMat = new THREE.MeshStandardMaterial({
      color: '#cfd7e6',
      roughness: 0.88,
      metalness: 0.02,
    });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.78;
    desk.receiveShadow = !isSoftwareGl;
    scene.add(desk);

    // Dimensionally accurate unit scaling (1 unit = 50mm -> 101.6mm = 2.032 units, 68.4mm = 1.368 units)
    const wU = config.cardW / 50;
    const hU = config.cardH / 50;
    const thickU = 0.016; // ~0.8mm PVC/laminated card stock feel

    const roughnessTex = createPaperRoughnessTexture();
    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#eef2f8',
      roughness: 0.55,
      metalness: 0.05,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.52,
      roughnessMap: roughnessTex,
      metalness: 0.04,
    });
    const backMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.58,
      roughnessMap: roughnessTex,
      metalness: 0.03,
    });
    const sheetMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.65,
      roughnessMap: roughnessTex,
      metalness: 0.02,
    });
    frontMatRef.current = frontMat;
    backMatRef.current = backMat;
    sheetMatRef.current = sheetMat;

    // 1. Trimmed Finished Card Assembly
    const cardGroup = new THREE.Group();
    const cardGeo = new THREE.BoxGeometry(wU, hU, thickU);
    // BoxGeometry material order: +x, -x, +y, -y, +z (front), -z (back)
    const cardMesh = new THREE.Mesh(cardGeo, [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      frontMat,
      backMat,
    ]);
    cardMesh.castShadow = !isSoftwareGl;
    cardMesh.receiveShadow = !isSoftwareGl;

    // Gold foil edge accent line matching card header divider
    const foilGeo = new THREE.BoxGeometry(wU * 0.968, 0.016, thickU + 0.002);
    const foilMat = new THREE.MeshStandardMaterial({
      color: '#C9A227',
      metalness: 0.65,
      roughness: 0.28,
    });
    const foilMesh = new THREE.Mesh(foilGeo, foilMat);
    foilMesh.position.set(0, hU * 0.26, 0);
    cardGroup.add(cardMesh, foilMesh);
    cardGroup.rotation.y = -0.22;
    scene.add(cardGroup);
    cardMeshGroupRef.current = cardGroup;

    // 2. Bifold / Hinged Fold-and-Glue Assembly
    const bifoldGroup = new THREE.Group();
    const halfThick = 0.008;
    const bottomHalfGeo = new THREE.BoxGeometry(wU, hU, halfThick);
    const bottomHalf = new THREE.Mesh(bottomHalfGeo, [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      frontMat,
      edgeMat,
    ]);
    bottomHalf.position.set(0, -hU / 2, 0);
    bottomHalf.castShadow = !isSoftwareGl;

    const topPivot = new THREE.Group();
    topPivot.position.set(0, 0, 0);
    const topHalfGeo = new THREE.BoxGeometry(wU, hU, halfThick);
    const topHalf = new THREE.Mesh(topHalfGeo, [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      backMat,
      edgeMat,
    ]);
    topHalf.position.set(0, hU / 2, 0);
    topHalf.castShadow = !isSoftwareGl;

    // Magenta crease indicator cylinder along hinge line
    const hingeGeo = new THREE.CylinderGeometry(0.007, 0.007, wU + 0.06, 12);
    const hingeMat = new THREE.MeshStandardMaterial({
      color: '#EC008C',
      roughness: 0.4,
      metalness: 0.1,
    });
    const hingeRod = new THREE.Mesh(hingeGeo, hingeMat);
    hingeRod.rotation.z = Math.PI / 2;

    topPivot.add(topHalf);
    bifoldGroup.add(bottomHalf, topPivot, hingeRod);
    bifoldGroup.visible = false;
    scene.add(bifoldGroup);
    pivotTopRef.current = topPivot;
    bifoldGroupRef.current = bifoldGroup;

    // 3. Untrimmed Prepress Sheet (Bleed + Crop Marks)
    const sheetW = (config.cardW + (config.bleedMm + 5) * 2) / 50;
    const sheetH = (config.cardH + (config.bleedMm + 5) * 2) / 50;
    const sheetGeo = new THREE.BoxGeometry(sheetW, sheetH, 0.008);
    const sheetMesh = new THREE.Mesh(sheetGeo, [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      sheetMat,
      backMat,
    ]);
    sheetMesh.castShadow = !isSoftwareGl;
    sheetMesh.visible = false;
    scene.add(sheetMesh);
    sheetMeshRef.current = sheetMesh;

    // On-demand render loop with damping settle
    let rafId: number | null = null;
    let dirty = true;

    const renderFrame = () => {
      rafId = null;
      const moved = controls.update();
      renderer.render(scene, camera);
      if (moved || dirty) {
        dirty = false;
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const requestRender = () => {
      dirty = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };
    requestRenderRef.current = requestRender;

    controls.addEventListener('change', requestRender);
    requestRender();

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
      requestRender();
    });
    ro.observe(container);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (animTimerRef.current !== null) cancelAnimationFrame(animTimerRef.current);
      ro.disconnect();
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      activeTexturesRef.current.forEach((t) => t.dispose());
      activeTexturesRef.current = [];
      roughnessTex.dispose();
      envTex.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();

      cardGeo.dispose();
      foilGeo.dispose();
      foilMat.dispose();
      bottomHalfGeo.dispose();
      topHalfGeo.dispose();
      hingeGeo.dispose();
      hingeMat.dispose();
      sheetGeo.dispose();
      deskGeo.dispose();
      deskMat.dispose();
      edgeMat.dispose();
      frontMat.dispose();
      backMat.dispose();
      sheetMat.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [config.cardW, config.cardH, config.bleedMm]);

  // Update 300 DPI Canvas Textures whenever student, soft-proof, or ICC profile changes
  useEffect(() => {
    let cancelled = false;
    setIsLoadingTex(true);

    (async () => {
      const frontCanvas = await renderFrontCardCanvas(student, {
        cardW: config.cardW,
        cardH: config.cardH,
        bleedMm: 0,
        dpi: 300,
        softProof: config.cmykSoftProof,
        iccProfile: config.iccProfile,
        showQrCode: config.showQrCode,
        qrCorner: config.qrCorner,
        qrFormat: config.qrFormat,
        qrSizeMm: config.qrSizeMm,
        showDeskOnCard: config.showDeskOnCard,
        deskLabel,
      });
      const backCanvas = renderBackCardCanvas(
        student.kelas,
        {
          cardW: config.cardW,
          cardH: config.cardH,
          bleedMm: 0,
          dpi: 300,
          softProof: config.cmykSoftProof,
          iccProfile: config.iccProfile,
        },
        schedulesMap,
      );
      const frontWithBleed = await renderFrontCardCanvas(student, {
        cardW: config.cardW,
        cardH: config.cardH,
        bleedMm: config.bleedMm,
        dpi: 300,
        softProof: config.cmykSoftProof,
        iccProfile: config.iccProfile,
        showQrCode: config.showQrCode,
        qrCorner: config.qrCorner,
        qrFormat: config.qrFormat,
        qrSizeMm: config.qrSizeMm,
        showDeskOnCard: config.showDeskOnCard,
        deskLabel,
      });
      const proofCanvas = buildProofSheetOverlayCanvas(
        frontWithBleed,
        config.cardW,
        config.cardH,
        config.bleedMm,
      );

      if (cancelled) return;

      const makeTex = (canvas: HTMLCanvasElement) => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        return tex;
      };

      const oldTexs = activeTexturesRef.current;
      const fTex = makeTex(frontCanvas);
      const bTex = makeTex(backCanvas);
      const sTex = makeTex(proofCanvas);
      activeTexturesRef.current = [fTex, bTex, sTex];

      if (frontMatRef.current) {
        frontMatRef.current.map = fTex;
        frontMatRef.current.needsUpdate = true;
      }
      if (backMatRef.current) {
        backMatRef.current.map = bTex;
        backMatRef.current.needsUpdate = true;
      }
      if (sheetMatRef.current) {
        sheetMatRef.current.map = sTex;
        sheetMatRef.current.needsUpdate = true;
      }

      oldTexs.forEach((t) => t.dispose());
      setIsLoadingTex(false);
      requestRenderRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    student,
    config.cardW,
    config.cardH,
    config.bleedMm,
    config.cmykSoftProof,
    config.iccProfile,
    config.showQrCode,
    config.qrCorner,
    config.qrFormat,
    config.qrSizeMm,
    config.showDeskOnCard,
    deskLabel,
    schedulesMap,
  ]);

  // Switch active 3D assembly & fold hinge angle cleanly
  useEffect(() => {
    if (cardMeshGroupRef.current) cardMeshGroupRef.current.visible = viewMode === 'card';
    if (bifoldGroupRef.current) bifoldGroupRef.current.visible = viewMode === 'bifold';
    if (sheetMeshRef.current) sheetMeshRef.current.visible = viewMode === 'bleedSheet';

    if (pivotTopRef.current) {
      // 0 deg = flat open; 180 deg = folded back-to-back flush
      const rad = THREE.MathUtils.degToRad(foldAngleDeg);
      pivotTopRef.current.rotation.x = rad;
    }
    requestRenderRef.current();
  }, [viewMode, foldAngleDeg]);

  const flipCardCamera = () => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    const isFrontSide = cam.position.z >= 0;
    const targetPos = new THREE.Vector3(
      isFrontSide ? -1.4 : 1.7,
      0.85,
      isFrontSide ? -2.7 : 2.7,
    );
    const startPos = cam.position.clone();
    const t0 = performance.now();
    const step = (now: number) => {
      const alpha = Math.min(1, (now - t0) / 480);
      const ease = 1 - Math.pow(1 - alpha, 3);
      cam.position.lerpVectors(startPos, targetPos, ease);
      ctrls.target.set(0, 0, 0);
      requestRenderRef.current();
      if (alpha < 1) animTimerRef.current = requestAnimationFrame(step);
    };
    if (animTimerRef.current) cancelAnimationFrame(animTimerRef.current);
    animTimerRef.current = requestAnimationFrame(step);
  };

  const resetCamera = () => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    cam.position.set(1.8, 1.35, 2.75);
    ctrls.target.set(0, 0, 0);
    ctrls.update();
    requestRenderRef.current();
  };

  return (
    <div className="relative w-full h-full min-h-[540px] bg-[#DFE5F0] overflow-hidden select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Top Left Minimal Subject HUD */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-xl px-4 py-3 shadow-sm">
        <div className="font-mono text-[11px] font-semibold text-[#B48A14] uppercase tracking-wider">
          Pratinjau 3D · 300 DPI {config.cmykSoftProof ? 'CMYK Soft-Proof' : 'Studio'}
        </div>
        <div className="font-display font-bold text-sm text-[#1F3864] mt-0.5">
          #{student.no} — {student.nama}
        </div>
        <div className="font-mono text-xs text-[#44546A] tabular-nums">
          Kelas {student.kelas} · Ruang {student.ruang}
          {config.showDeskOnCard && deskLabel ? ` (${deskLabel})` : ''} · {config.cardW} ×{' '}
          {config.cardH} mm
        </div>
      </div>

      {/* WebGL Context Lost / Loading Overlay */}
      {(contextLost || isLoadingTex) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#DFE5F0]/80 pointer-events-none">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-md px-4 py-3 font-mono text-xs text-[#1F3864]">
            {contextLost ? 'Memulihkan konteks WebGL 3D...' : 'Merender tekstur 300 DPI kartu depan & belakang...'}
          </div>
        </div>
      )}

      {/* Bottom Floating Control Dock (Collapsible) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto max-w-[95%]">
        <div className="bg-[#0F172A]/95 backdrop-blur-md border border-white/15 rounded-xl text-white p-2.5 shadow-xl">
          <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-lg">
              {(
                [
                  ['card', 'Kartu Jadi 360°'],
                  ['bifold', 'Simulasi Lipat & Tempel'],
                  ['bleedSheet', 'Lembar Bleed 3mm + Crop'],
                ] as Array<[MockupMode, string]>
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all active:scale-[0.98] ${
                    viewMode === m
                      ? 'bg-[#C9A227] text-[#0F172A] font-semibold shadow-xs'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 border-l border-white/15 pl-2.5">
              <button
                type="button"
                onClick={flipCardCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                Balik Depan/Belakang
              </button>
              <button
                type="button"
                onClick={resetCamera}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/15 transition-all active:scale-[0.98]"
                title="Reset kamera"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDockCollapsed((c) => !c)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/15 transition-all active:scale-[0.98]"
                title={dockCollapsed ? 'Tampilkan detail' : 'Sembunyikan detail'}
              >
                {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!dockCollapsed && (
            <div className="mt-2 pt-2 px-1 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-300">
              {viewMode === 'bifold' ? (
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                  <span className="font-mono whitespace-nowrap text-[#EC4899]">
                    Sudut Lipat: {foldAngleDeg}°
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={178}
                    value={foldAngleDeg}
                    onChange={(e) => setFoldAngleDeg(Number(e.target.value))}
                    className="flex-1 accent-[#C9A227]"
                  />
                  <span className="font-mono text-slate-400 whitespace-nowrap">
                    0° Terbuka → 178° Terlipat Presisi
                  </span>
                </div>
              ) : (
                <span className="font-mono">
                  Seret untuk putar 360° · Scroll untuk zoom · Klik kanan untuk geser
                </span>
              )}
              <span className="font-mono text-[#C9A227] whitespace-nowrap">
                Sisi Belakang: Jadwal Paste November ({student.kelas})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
