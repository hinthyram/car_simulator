import * as THREE from 'three';

/*
 * Built-in slope test field.
 * Default physics remains flat when no terrain is supplied to CarPhysics.
 *
 * The test road is intentionally simple:
 *   flat -> uphill -> crest -> downhill -> flat
 *
 * Height is continuous and differentiable at segment boundaries.
 */
export class TestTerrain {
    constructor(mode = 'flat') {
        this.mode = mode;
        this.roadWidth = 9;
        this.roadStart = -35;
        this.roadEnd = 235;
        this.maxHeight = 12;
    }

    _smoothstep(t) {
        t = THREE.MathUtils.clamp(t, 0, 1);
        return t * t * (3 - 2 * t);
    }

    _smoothstepDerivative(t) {
        t = THREE.MathUtils.clamp(t, 0, 1);
        return 6 * t * (1 - t);
    }

    heightAt(x, z) {
        if (this.mode !== 'slope') return 0;

        if (z < 0) return 0;

        // 0 -> 80 m: climb 12 m.
        if (z < 80) {
            const t = z / 80;
            return this.maxHeight * this._smoothstep(t);
        }

        // 80 -> 110 m: crest.
        if (z < 110) return this.maxHeight;

        // 110 -> 190 m: descend back to 0.
        if (z < 190) {
            const t = (z - 110) / 80;
            return this.maxHeight * (1 - this._smoothstep(t));
        }

        return 0;
    }

    slopeDzAt(x, z) {
        if (this.mode !== 'slope') return 0;

        if (z < 0 || z >= 190) return 0;

        if (z < 80) {
            const t = z / 80;
            return this.maxHeight *
                this._smoothstepDerivative(t) / 80;
        }

        if (z < 110) return 0;

        const t = (z - 110) / 80;
        return -this.maxHeight *
            this._smoothstepDerivative(t) / 80;
    }

    sample(x, z, yaw = 0) {
        const dz = this.slopeDzAt(x, z);

        // Terrain only varies along world Z. Project its gradient into the
        // vehicle's forward/right axes so gravity works naturally while the
        // vehicle steers on the test field.
        const forwardWorldZ = Math.cos(yaw);
        const rightWorldZ = -Math.sin(yaw);

        const forwardSlope = dz * forwardWorldZ;
        const rightSlope = dz * rightWorldZ;

        return {
            height: this.heightAt(x, z),
            slopeDz: dz,
            pitch: Math.atan(forwardSlope),
            gradeAlong: Math.atan(forwardSlope),
            gradeCross: Math.atan(rightSlope)
        };
    }

    addVisual(scene) {
        if (this.mode !== 'slope') return null;

        const segmentsZ = 180;
        const segmentsX = 24;
        const width = 80;
        const length = this.roadEnd - this.roadStart;
        const centerZ = (this.roadStart + this.roadEnd) / 2;

        const buildSurface = (surfaceWidth, yOffset, material) => {
            const vertices = [];
            const indices = [];

            for (let iz = 0; iz <= segmentsZ; iz++) {
                const z = this.roadStart + (iz / segmentsZ) * length;
                for (let ix = 0; ix <= segmentsX; ix++) {
                    const x = -surfaceWidth / 2 +
                        (ix / segmentsX) * surfaceWidth;
                    vertices.push(
                        x,
                        this.heightAt(x, z) + yOffset,
                        z
                    );
                }
            }

            const row = segmentsX + 1;
            for (let iz = 0; iz < segmentsZ; iz++) {
                for (let ix = 0; ix < segmentsX; ix++) {
                    const a = iz * row + ix;
                    const b = a + 1;
                    const c = a + row;
                    const d = c + 1;

                    // Counter-clockwise when viewed from above (+Y).
                    indices.push(a, c, b);
                    indices.push(b, c, d);
                }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(vertices, 3)
            );
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };

        const ground = buildSurface(
            width,
            -0.03,
            new THREE.MeshStandardMaterial({
                color: 0x4d7a42,
                roughness: 1.0,
                metalness: 0,
                side: THREE.DoubleSide
            })
        );

        const road = buildSurface(
            this.roadWidth,
            0.015,
            new THREE.MeshStandardMaterial({
                color: 0x15171a,
                roughness: 0.96,
                metalness: 0,
                side: THREE.DoubleSide
            })
        );

        // Road edge lines: generated as narrow surfaces following the same
        // exact height function as the asphalt.
        const buildStrip = (xCenter, stripWidth, z0, z1, color) => {
            const steps = Math.max(8, Math.ceil((z1 - z0) / 2));
            const vertices = [];
            const indices = [];

            for (let i = 0; i <= steps; i++) {
                const z = z0 + (i / steps) * (z1 - z0);
                vertices.push(
                    xCenter - stripWidth / 2,
                    this.heightAt(xCenter, z) + 0.035,
                    z,
                    xCenter + stripWidth / 2,
                    this.heightAt(xCenter, z) + 0.035,
                    z
                );
            }

            for (let i = 0; i < steps; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = a + 2;
                const d = a + 3;
                indices.push(a, c, b);
                indices.push(b, c, d);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(vertices, 3)
            );
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.7,
                    metalness: 0,
                    side: THREE.DoubleSide
                })
            );
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };

        const edgeOffset = this.roadWidth / 2 - 0.38;
        buildStrip(-edgeOffset, 0.14, this.roadStart, this.roadEnd, 0xf2f2e8);
        buildStrip( edgeOffset, 0.14, this.roadStart, this.roadEnd, 0xf2f2e8);

        // Center line.
        const dashLength = 4.5;
        const gap = 4.0;
        for (
            let z = this.roadStart + 4;
            z < this.roadEnd - 2;
            z += dashLength + gap
        ) {
            buildStrip(
                0,
                0.12,
                z,
                Math.min(z + dashLength, this.roadEnd),
                0xf2c84b
            );
        }

        // Slope markers.
        for (const z of [5, 80, 110, 185]) {
            const h = this.heightAt(0, z);
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8),
                new THREE.MeshStandardMaterial({color: 0xe7e7e7})
            );
            pole.position.set(
                this.roadWidth / 2 + 1.5,
                h + 0.75,
                z
            );
            scene.add(pole);
        }

        return { terrainMesh: ground, roadMesh: road };
    }
}


/*
 * CustomTerrain
 * Map-data driven terrain for the map editor.
 * The original TestTerrain remains untouched for legacy 6.7 fields.
 */
export class CustomTerrain {
    constructor(mapData) {
        this.map = mapData || {};
        const size = this.map.size || {};
        this.tileSize = Number(this.map.tileSize) || 10;
        this.cols = Math.max(1, Number(this.map.grid?.cols) || Math.round((Number(size.width)||200)/this.tileSize));
        this.rows = Math.max(1, Number(this.map.grid?.rows) || Math.round((Number(size.length)||200)/this.tileSize));
        this.width = this.cols * this.tileSize;
        this.length = this.rows * this.tileSize;
        this.tiles = Array.isArray(this.map.tiles) ? this.map.tiles : [];
        this.tileTypes = this.map.tileTypes || {};
        this.obstacles = Array.isArray(this.map.obstacles) ? this.map.obstacles : [];
        this.colliders = [];
    }

    _tileAt(c, r) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return {type:'grass',height:0};
        return this.tiles[r * this.cols + c] || {type:'grass',height:0};
    }

    _gridCoord(x, z) {
        return {
            c: (x + this.width / 2) / this.tileSize,
            r: (z + this.length / 2) / this.tileSize
        };
    }

    _vertexHeight(c, r) {
        // Same vertex convention as the map editor:
        // average the surrounding tile heights so adjacent tile tops connect.
        let sum = 0, count = 0;
        for (let rr = r - 1; rr <= r; rr++) {
            for (let cc = c - 1; cc <= c; cc++) {
                if (cc >= 0 && rr >= 0 && cc < this.cols && rr < this.rows) {
                    sum += Number(this._tileAt(cc, rr).height) || 0;
                    count++;
                }
            }
        }
        return count ? sum / count : 0;
    }

    heightAt(x, z) {
        const g = this._gridCoord(x, z);
        const c0 = Math.floor(g.c);
        const r0 = Math.floor(g.r);
        const tx = THREE.MathUtils.clamp(g.c - c0, 0, 1);
        const tz = THREE.MathUtils.clamp(g.r - r0, 0, 1);
        const h00 = this._vertexHeight(c0, r0);
        const h10 = this._vertexHeight(c0 + 1, r0);
        const h01 = this._vertexHeight(c0, r0 + 1);
        const h11 = this._vertexHeight(c0 + 1, r0 + 1);
        const hx0 = h00 + (h10 - h00) * tx;
        const hx1 = h01 + (h11 - h01) * tx;
        return hx0 + (hx1 - hx0) * tz;
    }

    slopeDxAt(x, z) {
        const step = Math.max(0.08, this.tileSize * 0.12);
        return (this.heightAt(x + step, z) - this.heightAt(x - step, z)) / (2 * step);
    }

    slopeDzAt(x, z) {
        const step = Math.max(0.08, this.tileSize * 0.12);
        return (this.heightAt(x, z + step) - this.heightAt(x, z - step)) / (2 * step);
    }

    sample(x, z, yaw = 0) {
        const dx = this.slopeDxAt(x, z);
        const dz = this.slopeDzAt(x, z);
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const forwardSlope = dx * forward.x + dz * forward.z;
        const rightSlope = dx * right.x + dz * right.z;
        return {
            height: this.heightAt(x, z),
            slopeDz: dz,
            pitch: Math.atan(forwardSlope),
            gradeAlong: Math.atan(forwardSlope),
            gradeCross: Math.atan(rightSlope)
        };
    }

    _colorFor(type) {
        const defaults = {
            asphalt: 0x25272a,
            concrete: 0x777b80,
            gravel: 0x766d60,
            dirt: 0x765238,
            grass: 0x416b3d,
            ice: 0xa6d4e5
        };
        const def = this.tileTypes[type];
        if (def && def.color) {
            const raw = String(def.color).replace('#','');
            const n = parseInt(raw,16);
            if (Number.isFinite(n)) return n;
        }
        return defaults[type] ?? defaults.grass;
    }

    _makeTile(c, r, sceneGroup) {
        const x0 = -this.width / 2 + c * this.tileSize;
        const x1 = x0 + this.tileSize;
        const z0 = -this.length / 2 + r * this.tileSize;
        const z1 = z0 + this.tileSize;

        // Exact tile boundary: no overlap, therefore no z-fighting/flicker.
        const positions = new Float32Array([
            x0, this._vertexHeight(c,r),   z0,
            x1, this._vertexHeight(c+1,r), z0,
            x1, this._vertexHeight(c+1,r+1), z1,
            x0, this._vertexHeight(c,r+1), z1
        ]);
        const indices = [0,2,1, 0,3,2];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const type = this._tileAt(c,r).type || 'grass';
        const mat = new THREE.MeshStandardMaterial({
            color: this._colorFor(type),
            roughness: 0.92,
            metalness: 0,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        sceneGroup.add(mesh);

        // Vertical skirt hides the underside without overlapping the top.
        const skirtY = -0.5;
        const sidePos = new Float32Array([
            x0, positions[1], z0, x1, positions[4], z0,
            x1, positions[7], z1, x0, positions[10], z1,
            x0, skirtY, z0, x1, skirtY, z0,
            x1, skirtY, z1, x0, skirtY, z1
        ]);
        const sideIdx = [
            0,1,5, 0,5,4,
            1,2,6, 1,6,5,
            2,3,7, 2,7,6,
            3,0,4, 3,4,7
        ];
        const sideGeo = new THREE.BufferGeometry();
        sideGeo.setAttribute('position', new THREE.BufferAttribute(sidePos,3));
        sideGeo.setIndex(sideIdx);
        sideGeo.computeVertexNormals();
        const side = new THREE.Mesh(sideGeo, mat);
        side.receiveShadow = true;
        sceneGroup.add(side);
    }

    _addFenceCorner(o, sceneGroup) {
        const y=this.heightAt(Number(o.x)||0,Number(o.z)||0);
        const len=this.tileSize*.9*(Number(o.scale)||1), h=this.tileSize*.62*(Number(o.scale)||1);
        const g=new THREE.Group();g.position.set(Number(o.x)||0,y,Number(o.z)||0);
        const mat=new THREE.MeshStandardMaterial({color:0xb5b9ba,roughness:.75});
        const pm=new THREE.MeshStandardMaterial({color:0x7f8588,roughness:.8});
        const r=Math.max(.06,this.tileSize*.035), pr=Math.max(.08,this.tileSize*.05);
        const half=len/2, arms={nw:[[half,0],[0,half]],ne:[[-half,0],[0,half]],sw:[[half,0],[0,-half]],se:[[-half,0],[0,-half]]};
        const ends=arms[o.corner]||arms.nw;
        const post=(x,z)=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(pr,pr,h,8,1),pm);p.position.set(x,h/2,z);p.castShadow=p.receiveShadow=true;g.add(p)};
        post(0,0);ends.forEach(e=>post(e[0],e[1]));
        ends.forEach(e=>{
            const horizontal=Math.abs(e[0])>0.001;
            const rail=new THREE.Mesh(new THREE.BoxGeometry(horizontal?half:r*2,r*2,horizontal?r*2:half),mat);
            rail.position.set(e[0]/2,h*.6,e[1]/2);rail.castShadow=rail.receiveShadow=true;g.add(rail);
            this.colliders.push({type:'box',x:(Number(o.x)||0)+e[0]/2,z:(Number(o.z)||0)+e[1]/2,yaw:horizontal?0:Math.PI/2,halfX:horizontal?half/2:r,halfZ:horizontal?r:half/2});
        });
        sceneGroup.add(g);
    }

    _addFence(o, sceneGroup) {
        const y = this.heightAt(Number(o.x)||0, Number(o.z)||0);
        const yaw = THREE.MathUtils.degToRad(Number(o.yaw)||0);
        const length = this.tileSize * 0.9;
        const postH = this.tileSize * 0.62;
        const postR = Math.max(0.07, this.tileSize * 0.045);
        const railR = Math.max(0.05, this.tileSize * 0.032);

        const g = new THREE.Group();
        g.position.set(Number(o.x)||0, y, Number(o.z)||0);
        g.rotation.y = yaw;

        const postMat = new THREE.MeshStandardMaterial({color:0x7f8588,roughness:.8});
        const railMat = new THREE.MeshStandardMaterial({color:0xb5b9ba,roughness:.75});

        for (const x of [-length/2, 0, length/2]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(postR,postR,postH,8),postMat);
            p.position.set(x,postH/2,0);
            p.castShadow = p.receiveShadow = true;
            g.add(p);
        }
        for (const yy of [postH*.42,postH*.78]) {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(length, railR*2.2, railR*2.2),
                railMat
            );
            rail.position.set(0,yy,0);
            rail.castShadow = rail.receiveShadow = true;
            g.add(rail);
        }
        sceneGroup.add(g);
        this.colliders.push({
            type: 'box',
            x: Number(o.x) || 0, z: Number(o.z) || 0,
            yaw,
            halfX: length * 0.5,
            halfZ: Math.max(postR * 2.8, 0.12),
            halfY: postH * 0.5
        });
    }

    _addTree(o, sceneGroup) {
        const y = this.heightAt(Number(o.x)||0, Number(o.z)||0);
        const s = Number(o.scale)||1;
        const g = new THREE.Group();
        g.position.set(Number(o.x)||0,y,Number(o.z)||0);
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(this.tileSize*.055*s,this.tileSize*.08*s,this.tileSize*.65*s,8),
            new THREE.MeshStandardMaterial({color:0x65452e,roughness:1})
        );
        trunk.position.y=this.tileSize*.325*s;
        trunk.castShadow=true; trunk.receiveShadow=true;
        g.add(trunk);
        const crown = new THREE.Mesh(
            new THREE.ConeGeometry(this.tileSize*.38*s,this.tileSize*.95*s,10),
            new THREE.MeshStandardMaterial({color:0x2f6035,roughness:1})
        );
        crown.position.y=this.tileSize*.95*s;
        crown.castShadow=true; crown.receiveShadow=true;
        g.add(crown);
        sceneGroup.add(g);
        this.colliders.push({
            type: 'cylinder',
            x: Number(o.x) || 0, z: Number(o.z) || 0,
            radius: Math.max(this.tileSize * 0.18 * s, 0.45),
            halfY: this.tileSize * 0.65 * s
        });
    }

    addVisual(scene) {
        const group = new THREE.Group();
        group.name = 'CustomMapTerrain';

        for (let r=0;r<this.rows;r++) {
            for (let c=0;c<this.cols;c++) {
                this._makeTile(c,r,group);
            }
        }

        // Draw structures saved by the map editor.
        for (const o of this.obstacles) {
            if (!o || !o.type) continue;
            if (o.type === 'fence') this._addFence(o,group);
            else if (o.type === 'fenceCorner') this._addFenceCorner(o,group);
            else if (o.type === 'tree') this._addTree(o,group);
        }

        scene.add(group);
        return {group};
    }
}
