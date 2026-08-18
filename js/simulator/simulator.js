import * as THREE from 'three';
        import { loadCarModel } from './carLoader.js';
        import { CarPhysics } from '../physics/carPhysics.js';
        import { TestTerrain, CustomTerrain } from '../terrain/terrain.js';
        import { MapStorage } from '../../shared/mapStorage.js';

        // 1. Scene & Camera & Renderer
        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xa0a0a0);
        scene.fog = new THREE.Fog(0xa0a0a0, 20, 150);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        // 2. 조명 & 바닥
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 80, 30);
        dirLight.castShadow = true;
        scene.add(ambientLight, dirLight);

        const grid = new THREE.GridHelper(500, 100, 0x444444, 0x222222);
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        scene.add(grid, plane);

        // 3. Terrain mode. Flat is the legacy/default behavior.
        const params = new URLSearchParams(location.search);
        const terrainMode = params.get('terrain') === 'slope' ? 'slope' : 'flat';
        const requestedMapId = params.get('map');
        const returnEditor = params.get('returnEditor') === '1';

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !returnEditor) return;
            e.preventDefault();
            const id = params.get('map');
            if (id) {
                window.location.href = '../map-editor/map-editor.html?id=' + encodeURIComponent(id);
            } else {
                window.history.back();
            }
        });

        async function readMapById(id){
            return await MapStorage.get(id);
        }
        async function findLatestSavedMap(){
            const maps=await MapStorage.list();
            return maps.length ? maps[0] : null;
        }

        const mapId = requestedMapId || null;

// Keep the simulator independent from the network.
// The original terrain/vehicle/physics startup happens immediately.
let terrain = new TestTerrain(terrainMode);
let activeMap = null;
let terrainVisual = terrain.addVisual(scene);
let mapLoadState = 'local-fallback';
let physics = null;

if (terrainMode === 'slope' || activeMap) {
    plane.visible = false;
    grid.visible = false;
}

const terrainModeEl = document.getElementById('terrainMode');
terrainModeEl.textContent = terrainMode === 'slope'
    ? 'FIELD: 오르막 / 내리막 테스트'
    : 'FIELD: 평지 (기존 기본 필드)';

// Replace only the visual/terrain reference after a remote map arrives.
// Never recreate the vehicle physics engine.
function applyLoadedMap(map) {
    if (!map || !Array.isArray(map.tiles) || !map.tiles.length) return false;

    const oldVisual = terrainVisual;
    activeMap = map;
    terrain = new CustomTerrain(activeMap);
    terrainVisual = terrain.addVisual(scene);

    if (oldVisual?.group) {
        scene.remove(oldVisual.group);
        oldVisual.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose?.();
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(mat => mat.dispose?.());
            }
        });
    }

    plane.visible = false;
    grid.visible = false;

    if (physics) {
        physics.terrain = terrain;
        if (activeMap.spawn) {
            physics.carModel.position.set(
                Number(activeMap.spawn.x) || 0,
                Number(activeMap.spawn.y) || terrain.heightAt(0, 0),
                Number(activeMap.spawn.z) || 0
            );
            physics.carModel.rotation.y = Number(activeMap.spawn.yaw) || 0;
        }
    }

    terrainModeEl.textContent =
        'FIELD: ' + (activeMap.name || '사용자 맵') + ' · ' +
        (activeMap.grid?.cols || 0) + '×' + (activeMap.grid?.rows || 0);
    return true;
}

// Background-only request. Failure is intentionally ignored so the simulator
// remains usable when Render is sleeping/offline.
void (async () => {
    try {
        await MapStorage.init();
        const loaded = mapId ? await readMapById(mapId) : await findLatestSavedMap();
        if (applyLoadedMap(loaded)) mapLoadState = 'server-map';
    } catch (err) {
        console.warn('[CAR SIM] Map API unavailable; continuing with default terrain.', err);
    }
})();

        document.getElementById('flatFieldBtn').addEventListener('click', () => {
            location.href = location.pathname;
        });
        document.getElementById('slopeFieldBtn').addEventListener('click', () => {
            location.href = location.pathname + '?terrain=slope';
        });

        // 4. 모듈 초기화 (물리 엔진 및 모델 로드)
        const clock = new THREE.Clock();

        loadCarModel('/car_simulator/simulator/car.glb', scene, (carModel, carParts) => {
            if (activeMap?.spawn) {
                carModel.position.set(
                    Number(activeMap.spawn.x) || 0,
                    Number(activeMap.spawn.y) || terrain.heightAt(0, 0),
                    Number(activeMap.spawn.z) || 0
                );
                carModel.rotation.y = Number(activeMap.spawn.yaw) || 0;
            } else if (terrainMode === 'slope') {
                carModel.position.z = -25;
                carModel.position.y = terrain.heightAt(
                    carModel.position.x,
                    carModel.position.z
                );
            }
            physics = new CarPhysics(carModel, carParts, terrain);
        });

        // 4. 추적 카메라 업데이트
        // 4. 추적 카메라 — 드래그 방식
        let cameraYawOffset = 0;
        let cameraPitchOffset = 0;
        let cameraDragging = false;
        let cameraLastX = 0;
        let cameraLastY = 0;
        let cameraDistance = 5.4;

        renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            cameraDragging = true;
            cameraLastX = e.clientX;
            cameraLastY = e.clientY;
            renderer.domElement.style.cursor = 'grabbing';
        });
        window.addEventListener('mouseup', () => {
            cameraDragging = false;
            renderer.domElement.style.cursor = '';
        });
        renderer.domElement.addEventListener('mousemove', (e) => {
            if (!cameraDragging) return;
            const dx=e.clientX-cameraLastX, dy=e.clientY-cameraLastY;
            cameraLastX=e.clientX; cameraLastY=e.clientY;
            cameraYawOffset=THREE.MathUtils.clamp(cameraYawOffset-dx*0.004,-2.2,2.2);
            cameraPitchOffset=THREE.MathUtils.clamp(cameraPitchOffset+dy*0.003,-0.55,0.75);
        });
        renderer.domElement.addEventListener('wheel', (e)=>{
            e.preventDefault();
            cameraDistance=THREE.MathUtils.clamp(
                cameraDistance*Math.exp(e.deltaY*0.0008),3.5,9.0
            );
        },{passive:false});
        renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

        function updateCamera() {
            if (!physics || !physics.carModel) return;
            const car=physics.carModel;
            const yaw=car.rotation.y+cameraYawOffset;
            const pitch=THREE.MathUtils.clamp(
                THREE.MathUtils.degToRad(8)+cameraPitchOffset,-0.25,0.62
            );
            const cp=Math.cos(pitch), sp=Math.sin(pitch);
            const offset=new THREE.Vector3(
                -Math.sin(yaw)*cp*cameraDistance,
                0.95+sp*cameraDistance,
                -Math.cos(yaw)*cp*cameraDistance
            );
            const target=car.position.clone().add(new THREE.Vector3(0,0.95,0));
            camera.position.lerp(target.clone().add(offset),0.14);
            camera.lookAt(target);
        }


        function resolveMapObstacleCollisions() {
            if (!physics || !physics.carModel || !terrain || !terrain.colliders?.length) return;

            const p = physics.carModel.position;
            const halfX = 0.78, halfZ = 1.75;

            function removeIntoNormal(nx, nz) {
                const yaw = physics.carModel.rotation.y;
                const cos = Math.cos(yaw), sin = Math.sin(yaw);
                const vx = physics.velocityWorld.x, vz = physics.velocityWorld.z;
                const vn = vx * nx + vz * nz;
                if (vn >= 0) return;

                const cvx = vx - nx * vn;
                const cvz = vz - nz * vn;

                physics.velocityLocal.x = cvx * cos - cvz * sin;
                physics.velocityLocal.y = cvx * sin + cvz * cos;
                physics.velocityWorld.set(cvx, 0, cvz);
            }

            for (const c of terrain.colliders) {
                const dx = p.x - c.x, dz = p.z - c.z;

                if (c.type === 'cylinder') {
                    const minDist = c.radius + Math.min(halfX, halfZ) * 0.82;
                    const d2 = dx*dx + dz*dz;
                    if (d2 >= minDist*minDist) continue;
                    const d = Math.sqrt(Math.max(d2, 1e-8));
                    const nx = dx/d, nz = dz/d, push = minDist-d;
                    p.x += nx*push; p.z += nz*push;
                    removeIntoNormal(nx, nz);
                    continue;
                }

                const cy=Math.cos(c.yaw), sy=Math.sin(c.yaw);
                const lx=dx*cy+dz*sy, lz=-dx*sy+dz*cy;
                const hx=c.halfX+halfX, hz=c.halfZ+halfZ;
                if(Math.abs(lx)>=hx || Math.abs(lz)>=hz) continue;

                const px=hx-Math.abs(lx), pz=hz-Math.abs(lz);
                if(px<pz){
                    const sign=lx>=0?1:-1, nx=sign*cy, nz=sign*sy;
                    p.x+=nx*px; p.z+=nz*px; removeIntoNormal(nx,nz);
                }else{
                    const sign=lz>=0?1:-1, nx=sign*(-sy), nz=sign*cy;
                    p.x+=nx*pz; p.z+=nz*pz; removeIntoNormal(nx,nz);
                }
            }
        }

        // 5. 애니메이션 루프
        function animate() {
            requestAnimationFrame(animate);
            const delta = Math.min(clock.getDelta(), 0.035);

            if (physics) {
                physics.update(delta);
                resolveMapObstacleCollisions();
                document.getElementById('speedometer').innerText = `${physics.getSpeedKmh()} KM/H`;
                const gradeDeg = THREE.MathUtils.radToDeg(physics.state.terrainGrade || 0);
                terrainModeEl.textContent =
                    terrainMode === 'slope'
                        ? `FIELD: 오르막/내리막  |  경사 ${gradeDeg.toFixed(1)}°`
                        : 'FIELD: 평지 (기존 기본 필드)';
            }

            updateCamera();
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
