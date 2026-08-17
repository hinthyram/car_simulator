import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadCarModel(filePath, scene, onLoadComplete) {
    const loader = new GLTFLoader();

    loader.load(filePath, (gltf) => {
        const carModel = gltf.scene;

        // 그림자 설정
        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                for (const material of materials) {
                    if (!material) continue;

                    // Several source textures are named DiffuseAOSO:
                    // their PNG alpha channel is packed AO/other data, not
                    // intended glass transparency. The GLB nevertheless
                    // marks these materials as BLEND, which makes body/grille
                    // surfaces appear partially invisible in WebGL.
                    // Use alpha as a cutout only when the source material
                    // actually contains transparent pixels.
                    if (material.transparent) {
                        material.transparent = false;
                        material.depthWrite = true;

                        const name = (material.name || '').toLowerCase();
                        const isCutout =
                            name.includes('badge') ||
                            name.includes('calliper');

                        material.alphaTest = isCutout ? 0.5 : 0.0;
                        material.needsUpdate = true;
                    }
                }
            }
        });

        // GLB 내 노드 매핑
        const carParts = {
            steerFL: carModel.getObjectByName('Steer_FL'),
            steerFR: carModel.getObjectByName('Steer_FR'),
            wheelFL: carModel.getObjectByName('Wheel_FL'),
            wheelFR: carModel.getObjectByName('Wheel_FR'),
            wheelRL: carModel.getObjectByName('Wheel_RL'),
            wheelRR: carModel.getObjectByName('Wheel_RR'),
            wheelPointFL: carModel.getObjectByName('WheelPoint_FL'),
            wheelPointFR: carModel.getObjectByName('WheelPoint_FR'),
            wheelPointRL: carModel.getObjectByName('WheelPoint_RL'),
            wheelPointRR: carModel.getObjectByName('WheelPoint_RR')
        };

        scene.add(carModel);
        console.log("차량 모델 및 파츠 로드 완료");

        if (onLoadComplete) {
            onLoadComplete(carModel, carParts);
        }
    }, undefined, (error) => {
        console.error("GLB 파일 로드 오류:", error);
    });
}