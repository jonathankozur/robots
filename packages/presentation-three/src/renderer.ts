import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { View } from '@robots/protocol/presentation/v1';
import type { Manifest } from '@robots/protocol/presentation/manifest-v1';
import { ResourcePool } from './resources.ts';
import { VisualMotion, hexPosition } from './motion.ts';
import { batchRigidAsset } from './batching.ts';
import { RenderCadence } from './cadence.ts';
function disposeObject(group: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    group.traverse(o => { if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
                if (v instanceof THREE.Texture)
                    textures.add(v);
        }
    } });
    for (const x of geometries)
        x.dispose();
    for (const x of materials)
        x.dispose();
    for (const x of textures)
        x.dispose();
}
export class PresentationRenderer {
    readonly motion = new VisualMotion();
    readonly diagnostics: string[] = [];
    #renderer: THREE.WebGLRenderer;
    #scene = new THREE.Scene();
    #camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 200);
    #controls: OrbitControls;
    #pool: ResourcePool<THREE.Group>;
    #leases: {
        release(): void;
    }[] = [];
    #templates = new Map<string, THREE.Group>();
    #robots = new Map<string, THREE.Group>();
    #logical = new Map<string, THREE.Object3D>();
    #debug = new THREE.Group();
    #routes = new THREE.Group();
    #closed = false;
    #lost = false;
    #observer: ResizeObserver;
    #bounds = new THREE.Box3();
    #view: View | undefined;
    #fps = 60;
    #lastRender = 0;
    #frames = 0;
    #sampleTime = 0;
    #measured = 0;
    #renderMs = 0;
    #markerGeometry = new THREE.BoxGeometry(.3, .3, .3);
    #markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    #ringGeometry = new THREE.TorusGeometry(.8, .01, 6, 24);
    #ringMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    #socketGeometry = new THREE.SphereGeometry(.035, 6, 4);
    #socketMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    #routeMaterial = new THREE.LineBasicMaterial({ color: 0xfacc15 });
    #edgeGeometry = new THREE.BufferGeometry();
    #edgeMaterial = new THREE.LineBasicMaterial({ color: 0x64748b });
    #labelGeometry = new THREE.PlaneGeometry(.72, .225);
    #labelMaterials: THREE.MeshBasicMaterial[] = [];
    #labels = new Map<string, THREE.Mesh>();
    #host: HTMLElement;
    #manifest: Manifest;
    #fault: string;
    #onLost: () => void;
    #released = false;
    #rendererDisposed = false;
    #cadence = new RenderCadence();
    constructor(host: HTMLElement, manifest: Manifest, options: {
        fault?: string;
        onLost?: () => void;
    } = {}) {
        this.#host = host;
        this.#manifest = manifest;
        this.#fault = options.fault ?? 'none';
        this.#onLost = options.onLost ?? (() => { });
        this.#sampleTime = performance.now();
        this.#renderer = new THREE.WebGLRenderer({ antialias: true });
        this.#renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.#renderer.setClearColor(0x111827);
        host.replaceChildren(this.#renderer.domElement);
        this.#scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2));
        const light = new THREE.DirectionalLight(0xffffff, 2.5);
        light.position.set(5, 12, 7);
        this.#scene.add(light, this.#debug, this.#routes);
        this.#debug.visible = false;
        this.#routes.visible = false;
        this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
        this.#controls.minPolarAngle = .15;
        this.#controls.maxPolarAngle = Math.PI / 2 - .05;
        this.#controls.minZoom = .5;
        this.#controls.maxZoom = 3;
        const loader = new GLTFLoader();
        this.#pool = new ResourcePool(async (id) => {
            const asset = this.#manifest.assets.find(a => a.resourceId === id);
            if (!asset)
                throw Error('Recurso no declarado: ' + id);
            if (this.#fault === 'late')
                await new Promise<void>(r => setTimeout(r, 1200));
            const url = this.#fault === 'asset' && id === 'resource.wheels' ? '/assets/presentation/missing.glb' : asset.url;
            const response = await fetch(url);
            if (!response.ok)
                throw Error('Carga fallida ' + id + ' · HTTP ' + response.status);
            const bytes = await response.arrayBuffer();
            if (bytes.byteLength > 1048576)
                throw Error('GLB excede 1 MiB');
            if (bytes.byteLength < 20 || new DataView(bytes).getUint32(0, true) !== 0x46546c67)
                throw Error('Archivo GLB ausente o inválido: ' + id);
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
            if (digest !== asset.sha256)
                throw Error('Digest distinto: ' + id);
            const gltf = await loader.parseAsync(bytes, '/assets/presentation/');
            for (const name of asset.sockets) {
                let count = 0;
                gltf.scene.traverse(o => { if (o.name === name)
                    count++; });
                if (count !== 1) {
                    disposeObject(gltf.scene);
                    throw Error('Socket ausente/duplicado: ' + name);
                }
            }
            return batchRigidAsset(gltf.scene, asset.sockets);
        }, disposeObject);
        this.#renderer.domElement.addEventListener('webglcontextlost', this.#contextLost);
        this.#renderer.domElement.addEventListener('webglcontextrestored', this.#contextRestored);
        this.#observer = new ResizeObserver(() => this.resize());
        this.#observer.observe(host);
        this.resize();
        this.#renderer.setAnimationLoop(this.#frame);
    }
    #contextLost = (e: Event) => { e.preventDefault(); if (this.#closed)
        return; this.#lost = true; this.motion.pause(true, performance.now()); this.diagnostics.push('Contexto WebGL perdido; reconstruye la vista.'); this.#renderer.setAnimationLoop(null); this.#controls.enabled = false; this.#releaseResources(); this.#renderer.dispose(); this.#rendererDisposed = true; this.#onLost(); };
    #contextRestored = () => { if (!this.#closed)
        this.diagnostics.push('Contexto restaurado; usa Reconstruir vista para validar la escena.'); };
    async prepare(view: View): Promise<void> {
        await Promise.all(this.#manifest.assets.map(async (a) => { try {
            const lease = await this.#pool.acquire(a.resourceId);
            if (this.#closed || this.#lost) {
                lease.release();
                return;
            }
            this.#leases.push(lease);
            this.#templates.set(a.resourceId, lease.value);
        }
        catch (e) {
            if (!this.#closed && !this.#lost)
                this.diagnostics.push(String(e));
        } }));
        if (this.#closed || this.#lost)
            throw Error('Vista cerrada o contexto perdido durante precarga');
        const clone = (id: string): THREE.Group => { const template = this.#templates.get(id); if (template)
            return template.clone(true); const g = new THREE.Group(); g.add(new THREE.Mesh(this.#markerGeometry, this.#markerMaterial)); this.diagnostics.push('Marcador de sustitución: ' + id); return g; };
        const floor = clone('resource.floor');
        floor.updateMatrixWorld(true);
        floor.traverse(o => { if (o instanceof THREE.Mesh) {
            const batch = new THREE.InstancedMesh(o.geometry, o.material, view.world.tiles.length);
            for (let i = 0; i < view.world.tiles.length; i++) {
                const t = view.world.tiles[i]!, p = hexPosition(t.q, t.r);
                batch.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, 0, p.z).multiply(o.matrixWorld));
            }
            batch.instanceMatrix.needsUpdate = true;
            batch.computeBoundingSphere();
            this.#scene.add(batch);
        } });
        const edges: THREE.Vector3[] = [];
        for (const t of view.world.tiles) {
            const p = hexPosition(t.q, t.r);
            for (let i = 0; i < 6; i++)
                for (const j of [i, i + 1]) {
                    const a = (60 * j - 30) * Math.PI / 180;
                    edges.push(new THREE.Vector3(p.x + Math.cos(a), .002, p.z + Math.sin(a)));
                }
            if (!t.passable) {
                const block = clone('resource.block');
                block.position.set(p.x, 0, p.z);
                this.#scene.add(block);
            }
        }
        this.#edgeGeometry.setFromPoints(edges);
        this.#scene.add(new THREE.LineSegments(this.#edgeGeometry, this.#edgeMaterial));
        for (const a of view.assemblies) {
            const root = new THREE.Group(), chassis = clone(a.chassisResourceId);
            root.add(chassis);
            if (this.#fault === 'socket') {
                const socket = chassis.getObjectByName('drive');
                socket?.removeFromParent();
            }
            for (const p of a.parts) {
                const socket = chassis.getObjectByName(p.socketId);
                if (socket)
                    socket.add(clone(p.resourceId));
                else {
                    const marker = new THREE.Mesh(this.#markerGeometry, this.#markerMaterial);
                    marker.position.set(0, 1.2, 0);
                    root.add(marker);
                    this.diagnostics.push('Montaje inválido ' + a.robotId + ' / ' + p.socketId);
                }
            }
            const robot = view.world.robots.find(r => r.robotId === a.robotId)!;
            const position = hexPosition(robot.q, robot.r);
            root.position.set(position.x, 0, position.z);
            this.#robots.set(a.robotId, root);
            this.#scene.add(root);
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 40;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 128, 40);
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 126, 38);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(a.robotId.slice(0, 9), 64, 27);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false });
            this.#labelMaterials.push(material);
            const label = new THREE.Mesh(this.#labelGeometry, material);
            label.position.set(position.x, 1.1, position.z);
            label.renderOrder = 10;
            this.#labels.set(a.robotId, label);
            this.#scene.add(label);
            const ring = new THREE.Mesh(this.#ringGeometry, this.#ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(position.x, .02, position.z);
            this.#logical.set(a.robotId, ring);
            this.#debug.add(ring);
            for (const p of a.parts) {
                const socket = chassis.getObjectByName(p.socketId);
                if (socket) {
                    const marker = new THREE.Mesh(this.#socketGeometry, this.#socketMaterial);
                    marker.visible = false;
                    marker.name = 'debug-socket';
                    socket.add(marker);
                }
            }
        }
        this.#scene.updateMatrixWorld(true);
        this.#bounds.setFromObject(this.#scene);
        this.accept(view, true);
        this.resetCamera();
    }
    accept(view: View, snap = false): void { if (this.#closed || this.#lost)
        return; this.motion.accept(view, performance.now(), snap); this.#view = view; for (const r of view.world.robots) {
        const p = hexPosition(r.q, r.r);
        this.#logical.get(r.robotId)?.position.set(p.x, .025, p.z);
    } }
    setRoutes(plans: readonly {
        robotId: string;
        path: readonly {
            q: number;
            r: number;
        }[];
    }[]): void {
        if (this.#closed || this.#lost)
            return;
        for (const child of [...this.#routes.children]) {
            if (child instanceof THREE.Line)
                child.geometry.dispose();
            child.removeFromParent();
        }
        if (!this.#view)
            return;
        for (const plan of plans) {
            const r = this.#view.world.robots.find(r => r.robotId === plan.robotId);
            if (!r || !plan.path.length)
                continue;
            const points = [r, ...plan.path].map(h => { const p = hexPosition(h.q, h.r); return new THREE.Vector3(p.x, .07, p.z); });
            this.#routes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.#routeMaterial));
        }
    }
    diagnosticsVisible(value: boolean): void { this.#debug.visible = value; this.#routes.visible = value; for (const r of this.#robots.values())
        r.traverse(o => { if (o.name === 'debug-socket')
            o.visible = value; }); }
    renderFps(value: number): void { if (![15, 30, 60].includes(value))
        throw Error('FPS inválido'); this.#fps = value; }
    quality(ratio: number): void { if (this.#closed || this.#lost) return; this.#renderer.setPixelRatio(Math.min(devicePixelRatio, ratio)); this.resize(); }
    resize(): void { if (this.#closed || this.#lost)
        return; this.#renderer.setSize(Math.max(1, this.#host.clientWidth), Math.max(1, this.#host.clientHeight)); if (!this.#bounds.isEmpty())
        this.resetCamera(); }
    resetCamera(): void {
        if (this.#closed || this.#lost || this.#bounds.isEmpty())
            return;
        const center = this.#bounds.getCenter(new THREE.Vector3());
        this.#camera.position.copy(center).add(new THREE.Vector3(7, 10, 8).normalize().multiplyScalar(60));
        this.#camera.lookAt(center);
        this.#camera.zoom = 1;
        this.#camera.updateMatrixWorld(true);
        const box = this.#bounds, min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
        for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
                for (const z of [box.min.z, box.max.z]) {
                    const p = new THREE.Vector3(x, y, z).applyMatrix4(this.#camera.matrixWorldInverse);
                    min.min(new THREE.Vector2(p.x, p.y));
                    max.max(new THREE.Vector2(p.x, p.y));
                }
        const aspect = Math.max(1, this.#host.clientWidth) / Math.max(1, this.#host.clientHeight), halfHeight = Math.max((max.y - min.y) / 2, (max.x - min.x) / 2 / aspect) * 1.12;
        this.#camera.left = -halfHeight * aspect;
        this.#camera.right = halfHeight * aspect;
        this.#camera.top = halfHeight;
        this.#camera.bottom = -halfHeight;
        this.#camera.updateProjectionMatrix();
        this.#controls.target.copy(center);
        this.#controls.update();
    }
    #frame = (time: number) => {
        if (this.#closed || this.#lost || this.#host.offsetParent === null || !this.#cadence.ready(time, this.#fps))
            return;
        const poses = this.motion.poses(performance.now());
        for (const [id, p] of poses) {
            const r = this.#robots.get(id);
            if (r) {
                r.position.set(p.x, 0, p.z);
                r.rotation.y = p.yaw;
            }
            const label = this.#labels.get(id);
            if (label) {
                label.position.set(p.x, 1.1, p.z);
                label.quaternion.copy(this.#camera.quaternion);
            }
        }
        const start = performance.now();
        this.#renderer.render(this.#scene, this.#camera);
        this.#renderMs = performance.now() - start;
        this.#frames++;
        if (time - this.#sampleTime >= 1000) {
            this.#measured = this.#frames * 1000 / (time - this.#sampleTime);
            this.#frames = 0;
            this.#sampleTime = time;
        }
    };
    snapshot(): unknown { return { resources: this.#pool.count(), robots: this.#robots.size, fps: this.#measured, targetFps: this.#fps, renderMs: this.#renderMs, lost: this.#lost, memory: { ...this.#renderer.info.memory }, calls: this.#renderer.info.render.calls, triangles: this.#renderer.info.render.triangles, poses: Object.fromEntries(this.motion.poses(performance.now())), diagnostics: [...this.diagnostics] }; }
    loseContext(): void { this.#renderer.forceContextLoss(); }
    restoreContext(): void { this.#renderer.forceContextRestore(); }
    #releaseResources(): void {
        if (this.#released)
            return;
        this.#released = true;
        for (const o of this.#routes.children)
            if (o instanceof THREE.Line)
                o.geometry.dispose();
        this.#scene.traverse(o => { if (o instanceof THREE.InstancedMesh)
            o.dispose(); });
        this.#scene.clear();
        this.#robots.clear();
        this.#logical.clear();
        this.#templates.clear();
        for (const l of this.#leases)
            l.release();
        this.#leases = [];
        this.#pool.close();
        for (const g of [this.#markerGeometry, this.#ringGeometry, this.#socketGeometry, this.#edgeGeometry, this.#labelGeometry])
            g.dispose();
        for (const m of [this.#markerMaterial, this.#ringMaterial, this.#socketMaterial, this.#routeMaterial, this.#edgeMaterial])
            m.dispose();
        for (const m of this.#labelMaterials) {
            m.map?.dispose();
            m.dispose();
        }
        this.#labelMaterials = [];
        this.#labels.clear();
    }
    close(): void {
        if (this.#closed)
            return;
        this.#closed = true;
        this.#renderer.setAnimationLoop(null);
        this.#observer.disconnect();
        this.#controls.dispose();
        this.#renderer.domElement.removeEventListener('webglcontextlost', this.#contextLost);
        this.#renderer.domElement.removeEventListener('webglcontextrestored', this.#contextRestored);
        this.#releaseResources();
        if (!this.#rendererDisposed) {
            this.#renderer.dispose();
            this.#rendererDisposed = true;
        }
        this.#renderer.forceContextLoss();
        this.#renderer.domElement.remove();
    }
}
