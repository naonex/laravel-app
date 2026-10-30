import * as THREE from 'three';

// 負荷計測ツール
import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// ----------------------------------------
// 設定
// ----------------------------------------

// 標高タイルのズームレベル
const DEM_ZOOM = 14;

// 地形の表示範囲（メートル）
const TERRAIN_SIZE = 1000;

// 地形の分割数
const TERRAIN_SEGMENTS = 128;

// 標高の強調倍率
const HEIGHT_SCALE = 2;

// 標高タイルの取得先（優先順位順）
const DEM_SOURCES = [
    'dem5a_png',
    'dem5b_png',
    'dem5c_png',
    'dem_png'
];

// ----------------------------------------
// Three.js 初期化用変数
// ----------------------------------------

let container = null;
let status = null;

let scene = null;
let camera = null;
let renderer = null;
let controls = null;

// 地形メッシュ
let terrainMesh = null;

// 初期化済みフラグ
let initialized = false;

// クリック地点を示すマーカー
let terrainMarker = null;

/* 地図用 */
// 地形表示範囲の矩形
let terrainArea = null;

// ----------------------------------------
// 3Dルート管理
// ----------------------------------------

let terrainRouteLine = null;

// 現在表示している地形の中心座標
let terrainCenter = null;

// 現在表示している地形の1ピクセルあたりの実距離
let terrainMetersPerPixel = null;


// ----------------------------------------
// Three.js 初期化
// ----------------------------------------

export function initTerrain() {

    // 二重初期化防止
    if (initialized) {
        return;
    }

    initialized = true;

    container = document.getElementById('terrain3d');
    status = document.getElementById('terrainStatus');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);

    // カメラ
    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        1,
        10000
    );

    // 地形はXY平面、高さはZ軸で表現
    camera.up.set(0, 0, 1);
    camera.position.set(1000, -1200, 1000);

    // レンダラー
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    console.log('terrain3d width:', container.clientWidth);
    console.log('terrain3d height:', container.clientHeight);

    // マウス操作
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // ライト
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(500, -500, 1000);
    scene.add(directionalLight);


    // ----------------------------------------
    // レンダリング
    // ----------------------------------------

    renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
    });

    // 画面サイズ変更対応
    const resizeObserver = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    });

    resizeObserver.observe(container);
}


// ----------------------------------------
// 標高タイル取得
// ----------------------------------------

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        // Canvasから画素情報を取得するためCORSを設定
        image.crossOrigin = 'anonymous';

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Tile load failed'));

        image.src = url;
    });
}

// 指定されたタイルを取得
async function loadDemTile(x, y, z) {

    const maxTile = Math.pow(2, z);

    // X座標は地球を一周するため折り返す
    x = ((x % maxTile) + maxTile) % maxTile;

    // Y座標が範囲外の場合
    if (y < 0 || y >= maxTile) {
        return null;
    }

    // DEMデータを優先順位順に取得
    for (const source of DEM_SOURCES) {

        const url =
            `https://cyberjapandata.gsi.go.jp/xyz/${source}/${z}/${x}/${y}.png`;

        try {
            return await loadImage(url);
        } catch (error) {
            // 次のデータソースを試す
            continue;
        }
    }

    return null;
}

// ----------------------------------------
// RGBから標高を取得
// ----------------------------------------

function decodeElevation(r, g, b, a) {

    // 透明ピクセルはデータなし
    if (a === 0) {
        return null;
    }

    const x = (r << 16) + (g << 8) + b;

    // 標高データなし
    if (x === 8388608) {
        return null;
    }

    // RGB値から標高を復元
    if (x < 8388608) {
        return x * 0.01;
    }

    return (x - 16777216) * 0.01;
}

// ----------------------------------------
// 3D地形生成
// ----------------------------------------

export async function createTerrain(leafletMap, latitude, longitude) {
    console.log('createTerrain実行');
    status.textContent = '標高データを取得しています...';

    try {

        // Leafletの座標をピクセル座標に変換
        const center = leafletMap.project(
            L.latLng(latitude, longitude),
            DEM_ZOOM
        );

        const tileX = Math.floor(center.x / 256);
        const tileY = Math.floor(center.y / 256);

        // 中心タイルを基準に3x3枚のタイルを取得
        const mosaic = document.createElement('canvas');
        mosaic.width = 256 * 3;
        mosaic.height = 256 * 3;

        const ctx = mosaic.getContext('2d', {
            willReadFrequently: true
        });

        const tilePromises = [];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {

                tilePromises.push(
                    (async () => {

                        const image = await loadDemTile(
                            tileX + dx,
                            tileY + dy,
                            DEM_ZOOM
                        );

                        if (image) {
                            ctx.drawImage(
                                image,
                                (dx + 1) * 256,
                                (dy + 1) * 256
                            );
                        }

                    })()
                );
            }
        }

        await Promise.all(tilePromises);

        // 標高タイルを画素データとして取得
        const imageData = ctx.getImageData(
            0,
            0,
            mosaic.width,
            mosaic.height
        );

        const pixels = imageData.data;

        // 地図の1ピクセルあたりの実距離
        const metersPerPixel =
            40075016.686 *
            Math.cos(latitude * Math.PI / 180) /
            (256 * Math.pow(2, DEM_ZOOM));


        // 現在表示している地形の情報を保持
        terrainCenter = {
            latitude: latitude,
            longitude: longitude
        };

        terrainMetersPerPixel = metersPerPixel;


        // 3D地形の頂点データ
        const elevations = [];

        let minElevation = Infinity;
        let maxElevation = -Infinity;

        // ----------------------------------------
        // 標高データをサンプリング
        // ----------------------------------------

        for (let iy = 0; iy <= TERRAIN_SEGMENTS; iy++) {

            for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {

                // 地形上の座標（メートル）
                const localX =
                    -TERRAIN_SIZE / 2 +
                    TERRAIN_SIZE * ix / TERRAIN_SEGMENTS;

                const localY =
                    TERRAIN_SIZE / 2 -
                    TERRAIN_SIZE * iy / TERRAIN_SEGMENTS;

                // 標高タイル上のピクセル座標
                const pixelX = Math.round(
                    center.x + localX / metersPerPixel -
                    (tileX - 1) * 256
                );

                const pixelY = Math.round(
                    center.y - localY / metersPerPixel -
                    (tileY - 1) * 256
                );

                let elevation = null;

                if (
                    pixelX >= 0 &&
                    pixelX < mosaic.width &&
                    pixelY >= 0 &&
                    pixelY < mosaic.height
                ) {

                    const index =
                        (pixelY * mosaic.width + pixelX) * 4;

                    elevation = decodeElevation(
                        pixels[index],
                        pixels[index + 1],
                        pixels[index + 2],
                        pixels[index + 3]
                    );
                }

                elevations.push(elevation);

                if (elevation !== null) {
                    minElevation = Math.min(minElevation, elevation);
                    maxElevation = Math.max(maxElevation, elevation);
                }
            }
        }

        // 標高データが1件も取得できなかった場合
        if (!Number.isFinite(minElevation)) {
            status.textContent =
                '標高データが取得できませんでした。';
            // 仮の標高を設定
            minElevation = 0;
            maxElevation = 0;
        } else {
            status.textContent =
                `標高範囲：${minElevation.toFixed(1)}m ～ ${maxElevation.toFixed(1)}m`;
        }

        // ----------------------------------------
        // Three.jsのジオメトリ生成
        // ----------------------------------------

        const geometry = new THREE.PlaneGeometry(
            TERRAIN_SIZE,
            TERRAIN_SIZE,
            TERRAIN_SEGMENTS,
            TERRAIN_SEGMENTS
        );

        const positions = geometry.attributes.position;
        const colors = [];


        // 標高データ色設定
        for (let i = 0; i < elevations.length; i++) {

            let elevation = elevations[i];

            // 標高データの有無を判定
            const isMissing = elevation === null;

            // データなしの場合は最低標高で補完
            if (isMissing) {
                elevation = minElevation;
            }

            // 高さを設定（標高差を強調）
            positions.setZ(
                i,
                (elevation - minElevation) * HEIGHT_SCALE
            );

            // 標高に応じた色を設定
            const rate = Math.max(
                0,
                Math.min(
                    1,
                    (elevation - minElevation) /
                    Math.max(maxElevation - minElevation, 1)
                )
            );

            const color = new THREE.Color();

            if (isMissing) {

                // 標高データがない場合はグレー
                color.set('#808080');

            } else {

                // 標高に応じた色
                color.setHSL(
                    0.33 - rate * 0.25,
                    0.65,
                    0.3 + rate * 0.25
                );
            }

            colors.push(color.r, color.g, color.b);
        }


        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 3)
        );

        geometry.computeVertexNormals();

        // ----------------------------------------
        // メッシュ生成
        // ----------------------------------------

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            side: THREE.DoubleSide
        });

        const newMesh = new THREE.Mesh(geometry, material);

        // 以前の地形を削除
        if (terrainMesh) {
            scene.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            terrainMesh.material.dispose();
        }

        terrainMesh = newMesh;
        scene.add(terrainMesh);


        // ----------------------------------------
        // 方角ラベル配置
        // ----------------------------------------

        // 地形の半分のサイズ
        const halfSize = TERRAIN_SIZE / 2;

        // 方角ラベル
        const directions = [
            { text: 'N', x: 0, y: halfSize + 40 },
            { text: 'S', x: 0, y: -halfSize - 40 },
            { text: 'E', x: halfSize + 40, y: 0 },
            { text: 'W', x: -halfSize - 40, y: 0 }
        ];

        // ラベルを配置
        directions.forEach((direction) => {

            const label = createDirectionLabel(direction.text);

            label.position.set(
                direction.x,
                direction.y,
                0
            );

            scene.add(label);
        });


        // ----------------------------------------
        // クリック地点のマーカー生成
        // ----------------------------------------

        // 以前のマーカーを削除
        if (terrainMarker) {
            scene.remove(terrainMarker);

            terrainMarker.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }

        // ピンの設定
        const pinHeight = 60;
        const pinRadius = 10;

        // ピン全体をまとめるグループ
        terrainMarker = new THREE.Group();

        // ピンの先端（円錐）
        const pinTipGeometry = new THREE.ConeGeometry(
            pinRadius,
            pinHeight / 2,
            16
        );

        const pinMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000
        });

        const pinTip = new THREE.Mesh(
            pinTipGeometry,
            pinMaterial
        );

        // 円錐の先端をZ軸のマイナス方向（下向き）にする
        pinTip.rotation.x = -Math.PI / 2;

        // 円錐の位置
        pinTip.position.z = pinHeight / 4;

        // ピンの頭（球体）
        const pinHeadGeometry = new THREE.SphereGeometry(
            pinRadius,
            16,
            16
        );

        const pinHead = new THREE.Mesh(
            pinHeadGeometry,
            pinMaterial
        );

        // 球体を少し下げて円錐と重ねる
        pinHead.position.z = pinHeight / 2 - pinRadius * 0.01;

        // グループに追加
        terrainMarker.add(pinTip);
        terrainMarker.add(pinHead);

        // 地形の中心に配置
        const centerIndex =
            Math.floor(TERRAIN_SEGMENTS / 2) * (TERRAIN_SEGMENTS + 1) +
            Math.floor(TERRAIN_SEGMENTS / 2);

        const centerElevation = elevations[centerIndex] ?? minElevation;

        terrainMarker.position.set(
            0,
            0,
            (centerElevation - minElevation) * HEIGHT_SCALE
        );

        scene.add(terrainMarker);


        // カメラと操作対象をリセット
        const centerHeight =
            (maxElevation - minElevation) * HEIGHT_SCALE / 2;

        controls.target.set(0, 0, centerHeight);

        camera.position.set(
            1000,
            -1200,
            centerHeight + 1000
        );

        controls.update();
        
        // ----------------------------------------
        // 地形表示範囲を地図上に表示
        // ----------------------------------------

        // 地形の半分のサイズ（メートル）
        // const halfSize = TERRAIN_SIZE / 2;

        // 中心地点から南北・東西に広げた範囲
        const southWest = leafletMap.unproject(
            L.point(
                center.x - halfSize / metersPerPixel,
                center.y + halfSize / metersPerPixel
            ),
            DEM_ZOOM
        );

        const northEast = leafletMap.unproject(
            L.point(
                center.x + halfSize / metersPerPixel,
                center.y - halfSize / metersPerPixel
            ),
            DEM_ZOOM
        );

        // 表示範囲
        const bounds = L.latLngBounds(southWest, northEast);

        // 以前の矩形を削除
        if (terrainArea) {
            leafletMap.removeLayer(terrainArea);
        }

        // 矩形を追加
        terrainArea = L.rectangle(bounds, {
            color: '#ff7800',
            weight: 2,
            fill: false
        }).addTo(leafletMap);

    } catch (error) {

        console.error('地形生成エラー:', error);

        status.textContent =
            '地形を取得できませんでした。別の地点を試してください。';
    }
}


// ----------------------------------------
// 方角ラベル生成
// ----------------------------------------

function createDirectionLabel(text) {

    // 文字描画用キャンバス
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    // 文字の設定
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 文字を描画
    ctx.fillText(text, 64, 64);

    // テクスチャ生成
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false
    });

    const sprite = new THREE.Sprite(material);

    sprite.scale.set(40, 40, 1);

    return sprite;
}


// ----------------------------------------
// 3D地形上のルート描画
// ----------------------------------------

export function updateTerrainRoute(leafletMap, startPoint, goalPoint) {

    // 必要なデータが揃っていなければ何もしない
    if (
        !terrainMesh ||
        !terrainCenter ||
        !terrainMetersPerPixel ||
        !startPoint ||
        !goalPoint
    ) {
        return;
    }

    // 既存のルートを削除
    if (terrainRouteLine) {
        scene.remove(terrainRouteLine);
        terrainRouteLine.geometry.dispose();
        terrainRouteLine.material.dispose();
        terrainRouteLine = null;
    }

    // 地形中心のピクセル座標
    const centerPixel = leafletMap.project(
        L.latLng(
            terrainCenter.latitude,
            terrainCenter.longitude
        ),
        DEM_ZOOM
    );

    // 出発地点・目的地点のピクセル座標
    const startPixel = leafletMap.project(
        L.latLng(startPoint.latitude, startPoint.longitude),
        DEM_ZOOM
    );

    const goalPixel = leafletMap.project(
        L.latLng(goalPoint.latitude, goalPoint.longitude),
        DEM_ZOOM
    );

    // 地図のピクセル座標をThree.jsのローカル座標に変換
    const startX =
        (startPixel.x - centerPixel.x) * terrainMetersPerPixel;

    const startY =
        -(startPixel.y - centerPixel.y) * terrainMetersPerPixel;

    const goalX =
        (goalPixel.x - centerPixel.x) * terrainMetersPerPixel;

    const goalY =
        -(goalPixel.y - centerPixel.y) * terrainMetersPerPixel;

    // // 地形の範囲内にあるか確認
    // const halfSize = TERRAIN_SIZE / 2;

    // if (
    //     Math.abs(startX) > halfSize ||
    //     Math.abs(startY) > halfSize ||
    //     Math.abs(goalX) > halfSize ||
    //     Math.abs(goalY) > halfSize
    // ) {
    //     console.warn('ルートの一部が3D地形の範囲外です。');
    //     return;
    // }

    // 地形との交差判定に使用するRaycaster
    const raycaster = new THREE.Raycaster();

    // 地形の高さの最大値を取得
    terrainMesh.geometry.computeBoundingBox();

    const maxHeight = terrainMesh.geometry.boundingBox.max.z;

    // ルート上の座標を格納
    const routePoints = [];

    // ルートの距離に応じて分割数を決定
    const routeDistance = Math.sqrt(
        Math.pow(goalX - startX, 2) +
        Math.pow(goalY - startY, 2)
    );

    // 約10m間隔で分割（最低100区間）
    const segments = Math.max(
        100,
        Math.ceil(routeDistance / 10)
    );

    terrainMesh.updateMatrixWorld(true);

    for (let i = 0; i <= segments; i++) {

        const rate = i / segments;

        // ルート上のXY座標を計算
        const x = startX + (goalX - startX) * rate;
        const y = startY + (goalY - startY) * rate;

        // 地形の上方から真下に向けてRayを飛ばす
        raycaster.set(
            new THREE.Vector3(x, y, maxHeight + 1000),
            new THREE.Vector3(0, 0, -1)
        );

        const intersections = raycaster.intersectObject(
            terrainMesh,
            false
        );

        // 地形との交差位置を取得
        if (intersections.length > 0) {

            const point = intersections[0].point.clone();

            // 地形との重なりを防ぐため少し浮かせる
            point.z += 1;

            routePoints.push(point);
        }
    }

    // 地形と交差する地点がなければ終了
    if (routePoints.length < 2) {
        console.warn('3Dルートを描画できませんでした。');
        return;
    }

    // ルートのジオメトリを生成
    const geometry = new THREE.BufferGeometry().setFromPoints(
        routePoints
    );

    // ルートのマテリアルを生成
    const material = new THREE.LineBasicMaterial({
        color: 0xff0000
    });

    // ルートのメッシュを生成
    terrainRouteLine = new THREE.Line(geometry, material);

    scene.add(terrainRouteLine);
}