import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PANEL_W = 290; // keep in sync with #panel width in css/app.css

/**
 * Rig — the neutral test stage: dark void, ground, emitter, target.
 * Deliberately plain so variations stay honestly comparable.
 */
export class Rig {
  constructor(canvas){
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.008);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(0.4, 2.2, 8.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.9, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 30;

    // --- ground ----------------------------------------------------------
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ color: 0x0a0c12 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.001;
    this.scene.add(this.ground);

    this.grid = new THREE.GridHelper(80, 80, 0x1b2030, 0x11141d);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.5;
    this.scene.add(this.grid);

    // --- emitter & target -------------------------------------------------
    this.start = new THREE.Vector3(-3.0, 0.9, 0);
    this.end   = new THREE.Vector3( 3.2, 0.9, 0);

    const metal = new THREE.MeshBasicMaterial({ color: 0x2a3040 });

    this.emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 20), metal);
    this.emitter.position.copy(this.start).addScaledVector(
      new THREE.Vector3().subVectors(this.start, this.end).normalize(), 0.35
    );
    this.emitter.rotation.z = -Math.PI / 2;
    this.scene.add(this.emitter);

    this.emitterPost = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), metal);
    this.emitterPost.position.set(this.emitter.position.x, 0.45, 0);
    this.scene.add(this.emitterPost);

    this.target = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.9), metal);
    this.target.position.set(this.end.x + 0.45, 0.7, 0);
    this.scene.add(this.target);

    this._onResize = this.resize.bind(this);
    addEventListener('resize', this._onResize);
    this.resize();
  }

  setBackground(brightness){
    // setHSL defaults to the linear working space; feed it sRGB or a
    // requested 0.03 renders as a washed-out ~0.19 on screen.
    const c = new THREE.Color().setHSL(0.62, 0.30, brightness, THREE.SRGBColorSpace);
    this.scene.background.copy(c);
    this.scene.fog.color.copy(c);
    this.ground.material.color.copy(c).multiplyScalar(0.85);
  }

  setExposure(v){ this.renderer.toneMappingExposure = v; }

  resize(){
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    // The control panel overlays the right edge. Offset the frustum so the
    // stage is centred in the *visible* region, not the canvas.
    const panel = Math.min(PANEL_W, w * 0.4);
    this.camera.setViewOffset(w, h, panel / 2, 0, w, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(){
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
