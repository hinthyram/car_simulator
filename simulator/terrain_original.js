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
        const size = this.map.size || { width: 200, length: 200 };
        this.width = Number(size.width) || 200;
        this.length = Number(size.length) || 200;

        this.tileSize = Number(this.map.tileSize) || 10;
        this.cols = Math.max(1, Number(this.map.grid?.cols) || Math.round(this.width / this.tileSize));
        this.rows = Math.max(1, Number(this.map.grid?.rows) || Math.round(this.length / this.tileSize));
        this.width = this.cols * this.tileSize;
        this.length = this.rows * this.tileSize;

        this.tileTypes = this.map.tileTypes || {
            asphalt: { name: '아스팔트', friction: 0.95, color: 0x202328 },
            concrete: { name: '콘크리트', friction: 0.90, color: 0x777b80 },
            gravel: { name: '자갈', friction: 0.65, color: 0x756b5d },
            dirt: { name: '흙', friction: 0.55, color: 0x6f5035 },
            grass: { name: '잔디', friction: 0.40, color: 0x41663b },
            ice: { name: '얼음', friction: 0.15, color: 0x9cc8dc }
        };

        const count = this.cols * this.rows;
        this.tiles = Array.isArray(this.map.tiles)
            ? this.map.tiles.map(v => ({ type: v?.type || 'grass', height: Number(v?.height) || 0 }))
            : [];

        while (this.tiles.length < count) {
            this.tiles.push({ type: 'grass', height: 0 });
        }
        if (this.tiles.length > count) this.tiles.length = count;

        // Legacy M1 maps can still be opened.
        if (Array.isArray(this.map.terrain?.heightGrid?.heights) && !this.map.tiles) {
            const g = this.map.terrain.heightGrid;
            for (let z = 0; z < this.rows; z++) {
                for (let x = 0; x < this.cols; x++) {
                    const gx = Math.round(x / Math.max(1, this.cols - 1) * (g.width - 1));
                    const gz = Math.round(z / Math.max(1, this.rows - 1) * (g.length - 1));
                    const h = Number(g.heights[gz * g.width + gx]) || 0;
                    this.tiles[z * this.cols + x].height = h;
                }
            }
        }
    }

    tileIndexAt(x, z) {
        const col = Math.max(0, Math.min(this.cols - 1,
            Math.floor((x + this.width / 2) / this.tileSize)));
        const row = Math.max(0, Math.min(this.rows - 1,
            Math.floor((z + this.length / 2) / this.tileSize)));
        return row * this.cols + col;
    }

    tileAt(x, z) {
        return this.tiles[this.tileIndexAt(x, z)];
    }

    frictionAt(x, z) {
        const tile = this.tileAt(x, z);
        const info = this.tileTypes[tile?.type] || this.tileTypes.grass;
        return Number(info.friction) || 0.4;
    }

    heightAt(x, z) {
        const fx = (x + this.width / 2) / this.tileSize - 0.5;
        const fz = (z + this.length / 2) / this.tileSize - 0.5;
        const x0 = Math.floor(fx), z0 = Math.floor(fz);
        const tx = fx - x0, tz = fz - z0;
        const h = (xx, zz) => {
            xx = Math.max(0, Math.min(this.cols - 1, xx));
            zz = Math.max(0, Math.min(this.rows - 1, zz));
            return Number(this.tiles[zz * this.cols + xx]?.height) || 0;
        };
        const h00 = h(x0, z0), h10 = h(x0 + 1, z0);
        const h01 = h(x0, z0 + 1), h11 = h(x0 + 1, z0 + 1);
        return h00 * (1 - tx) * (1 - tz) +
               h10 * tx * (1 - tz) +
               h01 * (1 - tx) * tz +
               h11 * tx * tz;
    }

    slopeDzAt(x, z) {
        const step = Math.max(0.1, this.tileSize * 0.5);
        return (this.heightAt(x, z + step) - this.heightAt(x, z - step)) / (2 * step);
    }

    slopeDxAt(x, z) {
        const step = Math.max(0.1, this.tileSize * 0.5);
        return (this.heightAt(x + step, z) - this.heightAt(x - step, z)) / (2 * step);
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
            gradeCross: Math.atan(rightSlope),
            friction: this.frictionAt(x, z)
        };
    }

    addVisual(scene) {
        const group = new THREE.Group();
        group.name = 'CustomMapTiles';

        const geo = new THREE.PlaneGeometry(
            this.width, this.length,
            this.cols, this.rows
        );
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = -pos.getY(i);
            pos.setZ(i, this.heightAt(x, z));
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const ground = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                color: 0x41663b, roughness: 1, metalness: 0,
                side: THREE.DoubleSide
            })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        // Tile overlays make the friction surface visible without changing
        // the physics surface.
        for (let r = 0; r < this.rows; r++) {
            for (let col = 0; col < this.cols; col++) {
                const tile = this.tiles[r * this.cols + col];
                const info = this.tileTypes[tile.type] || this.tileTypes.grass;
                const y = tile.height + 0.025;
                const mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(
                        this.tileSize * 0.985,
                        this.tileSize * 0.985
                    ),
                    new THREE.MeshStandardMaterial({
                        color: info.color, roughness: 0.96,
                        metalness: 0, side: THREE.DoubleSide
                    })
                );
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(
                    -this.width / 2 + (col + 0.5) * this.tileSize,
                    y,
                    -this.length / 2 + (r + 0.5) * this.tileSize
                );
                mesh.receiveShadow = true;
                group.add(mesh);
            }
        }

        scene.add(group);
        return { terrainMesh: ground, group };
    }
}
