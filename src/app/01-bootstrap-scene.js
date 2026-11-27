import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ---------- Пересчёт: пиксели скана (200 dpi) -> метры. М 1:500 => 15.75 px = 1 м ---------- */
const S = 15.75, CX = 3400, CY = 3000;
const P = (px, py) => [(px - CX) / S, (py - CY) / S];

/* ---------- Сцена ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe0ea);
scene.fog = new THREE.Fog(0xcfe0ea, 420, 950);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2; controls.maxDistance = 400;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-70, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -125, right: 125, top: 125, bottom: -125, near: 10, far: 400 });
sun.shadow.bias = -0.0005;
scene.add(sun);
