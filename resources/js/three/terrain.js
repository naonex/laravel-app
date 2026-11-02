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

// 移動速度（メートル／秒）
const TERRAIN_ANIMATION_MIN_SPEED = 1000;

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
// ルートアニメーションの管理
// ----------------------------------------

let routeAnimationMarker = null;
let routeAnimationPoints = [];
let routeAnimationProgress = 0;
let isRouteAnimating = false;

let animationFrameId = null;
let previousAnimationTime = 0;


// 地形移動アニメーション用
let terrainAnimationPath = [];
let terrainAnimationDistance = 0;
let terrainAnimationElapsed = 0;
let terrainAnimationDuration = 20;

// DEM更新間隔（メートル）
const TERRAIN_UPDATE_INTERVAL = 200;

// DEM取得中フラグ
let isTerrainUpdating = false;

// アニメーション中のOrbitControls状態
let previousControlsEnabled = true;

// 最後に地形を更新した距離
let terrainAnimationLastUpdateDistance = 0;

// アニメーションで使用するLeaflet地図
let animationLeafletMap = null;


// Leafletの現在地点マーカー
let currentLocationMarker = null;

// アニメーション中の現在地点マーカー
let terrainAnimationMapMarker = null;


// 方角ラベル
let terrainDirectionLabels = null;

// 地形取得リクエストの管理
let terrainRequestId = 0;


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

export async function createTerrain(
    leafletMap,
    latitude,
    longitude,
    options = {}
) {
    console.log('createTerrain実行');

    // オプション
    const {
        preserveCamera = false,
        showMarker = true,
        updateArea = true,
        showStatus = true
    } = options;

    // 地形取得リクエストを識別
    const requestId = ++terrainRequestId;

    // カメラの現在位置と注視点の相対位置を保持
    const cameraOffset = camera.position.clone().sub(controls.target);

    if (showStatus) {
        status.textContent = '標高データを取得しています...';
    }

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

        // 古いリクエストの場合は処理を終了
        if (requestId !== terrainRequestId) {
            return false;
        }


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
            if (showStatus) {
                status.textContent =
                    '標高データが取得できませんでした。';
            }
            // 仮の標高を設定
            minElevation = 0;
            maxElevation = 0;
        } else if (showStatus) {
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

        // 以前の方角ラベルを削除
        if (terrainDirectionLabels) {
            scene.remove(terrainDirectionLabels);

            terrainDirectionLabels.traverse((child) => {
                if (child.isSprite) {
                    child.material.map.dispose();
                    child.material.dispose();
                }
            });

            terrainDirectionLabels = null;
        }

        // 地形の半分のサイズ
        const halfSize = TERRAIN_SIZE / 2;

        // 方角ラベル
        const directions = [
            { text: 'N', x: 0, y: halfSize + 40 },
            { text: 'S', x: 0, y: -halfSize - 40 },
            { text: 'E', x: halfSize + 40, y: 0 },
            { text: 'W', x: -halfSize - 40, y: 0 }
        ];

        // ラベルをまとめるグループ
        terrainDirectionLabels = new THREE.Group();

        // ラベルを配置
        directions.forEach((direction) => {

            const label = createDirectionLabel(direction.text);

            label.position.set(
                direction.x,
                direction.y,
                0
            );

            terrainDirectionLabels.add(label);
        });

        scene.add(terrainDirectionLabels);


        // ----------------------------------------
        // クリック地点のマーカー生成
        // ----------------------------------------

        if (showMarker) {

            // 以前のマーカーを削除
            if (terrainMarker) {
                scene.remove(terrainMarker);

                terrainMarker.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                });

                terrainMarker = null;
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

        } else if (terrainMarker) {

            // アニメーション中はマーカーを非表示
            terrainMarker.visible = false;
        }


        // カメラと操作対象をリセット
        const centerHeight =
            (maxElevation - minElevation) * HEIGHT_SCALE / 2;

        controls.target.set(0, 0, centerHeight);

        if (preserveCamera) {

            // カメラの角度と距離を維持
            camera.position.copy(
                controls.target.clone().add(cameraOffset)
            );

        } else {

            camera.position.set(
                1000,
                -1200,
                centerHeight + 1000
            );
        }

        controls.update();

        
        // ----------------------------------------
        // 地形表示範囲を地図上に表示
        // ----------------------------------------

        if (updateArea) {

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
        }


        return true;


    } catch (error) {

        console.error('地形生成エラー:', error);

        if (showStatus) {
            status.textContent =
                '地形を取得できませんでした。別の地点を試してください。';
        }

        return false;
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


    // アニメーション用にルート座標を保持
    routeAnimationPoints = routePoints;


    /* 自動アニメは廃止 */
    // // アニメーションを初期化
    // routeAnimationProgress = 0;
    // isRouteAnimating = true;

    // // 移動マーカーを生成
    // if (!routeAnimationMarker) {

    //     const geometry = new THREE.SphereGeometry(5, 16, 16);

    //     const material = new THREE.MeshBasicMaterial({
    //         color: 0x00ffff
    //     });

    //     routeAnimationMarker = new THREE.Mesh(
    //         geometry,
    //         material
    //     );

    //     scene.add(routeAnimationMarker);
    // }

    // // マーカーを出発地点に配置
    // routeAnimationMarker.position.copy(routeAnimationPoints[0]);
    

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


// ----------------------------------------
// ルートアニメーション
// ----------------------------------------

export function animateTerrainRoute(deltaTime) {

    if (
        !isRouteAnimating ||
        routeAnimationPoints.length < 2 ||
        !routeAnimationMarker
    ) {
        return;
    }

    // 移動時間（秒）
    const duration = 5;

    // 経過時間に応じて進行度を更新
    routeAnimationProgress += deltaTime / duration;

    // 目的地に到着
    if (routeAnimationProgress >= 1) {
        routeAnimationProgress = 1;
        isRouteAnimating = false;
    }

    // ルート上の現在位置を計算
    const position =
        routeAnimationProgress * (routeAnimationPoints.length - 1);

    const index = Math.floor(position);

    const rate = position - index;

    const start = routeAnimationPoints[index];

    const end = routeAnimationPoints[
        Math.min(index + 1, routeAnimationPoints.length - 1)
    ];

    // 2地点間を補間してマーカーを移動
    routeAnimationMarker.position.lerpVectors(
        start,
        end,
        rate
    );
}


// ----------------------------------------
// Three.jsアニメーションループ
// ----------------------------------------

function animateTerrain() {

    // アニメーションが終了していればループを終了
    if (!isRouteAnimating) {
        animationFrameId = null;
        return;
    }

    // 次のフレームを予約
    animationFrameId = requestAnimationFrame(animateTerrain);

    // 現在時刻を取得
    const currentTime = performance.now();

    // 前回からの経過時間（秒）
    const deltaTime = previousAnimationTime === 0
        ? 0
        : (currentTime - previousAnimationTime) / 1000;

    previousAnimationTime = currentTime;

    // 経過時間に応じて進行度を更新
    terrainAnimationElapsed += deltaTime;

    const progress = Math.min(
        terrainAnimationElapsed / terrainAnimationDuration,
        1
    );

    // ルート上の現在位置を計算
    const currentPosition = getRoutePosition(
        terrainAnimationPath[0],
        terrainAnimationPath[1],
        progress
    );

    // 現在の移動距離
    const currentDistance =
        terrainAnimationDistance * progress;

    // 一定距離ごとに地形を更新
    if (
        !isTerrainUpdating &&
        (
            currentDistance - terrainAnimationLastUpdateDistance >= TERRAIN_UPDATE_INTERVAL ||
            progress >= 1
        )
    ) {

        // DEM取得中フラグ
        isTerrainUpdating = true;

        // 地形を更新
        createTerrain(
            animationLeafletMap,
            currentPosition.latitude,
            currentPosition.longitude,
            {
                preserveCamera: true,
                showMarker: true,
                updateArea: false,
                showStatus: false
            }
        ).then((success) => {

            if (success) {

                // 地形上のルートを再描画
                updateTerrainRoute(
                    animationLeafletMap,
                    terrainAnimationPath[0],
                    terrainAnimationPath[1]
                );

                // 地図上の現在地点マーカーを更新
                updateTerrainAnimationMapMarker(
                    animationLeafletMap,
                    currentPosition
                );

                // 最後に更新した距離を保持
                terrainAnimationLastUpdateDistance = currentDistance;

            } else {
                console.warn('移動中の地形更新に失敗しました。');
            }

            // DEM取得終了
            isTerrainUpdating = false;

            // 目的地まで到着し、最後の地形更新も完了した
            if (
                terrainAnimationElapsed >= terrainAnimationDuration &&
                terrainAnimationLastUpdateDistance >= terrainAnimationDistance
            ) {

                // アニメーション終了
                isRouteAnimating = false;

                // // OrbitControlsを元に戻す
                // controls.enabled = previousControlsEnabled;

                // アニメーション終了
                console.log("アニメループ");
                stopTerrainRouteAnimation();

                console.log('地形移動アニメーション終了');
            }
        });
    }
}


// ----------------------------------------
// ルートアニメーション開始
// ----------------------------------------

export function startTerrainRouteAnimation(
    leafletMap,
    startPoint,
    goalPoint,
    locationMarker
) {

    // 現在地点マーカーを保持
    currentLocationMarker = locationMarker;

    // 現在地点マーカーを非表示
    if (currentLocationMarker) {
        currentLocationMarker.setOpacity(0);
    }

    // 以下は既存の開始処理...

    // 必要なデータが揃っていなければ何もしない
    if (!leafletMap || !startPoint || !goalPoint) {
        console.warn('出発地点または目的地が設定されていません。');
        return;
    }

    // アニメーション中なら何もしない
    if (isRouteAnimating) {
        return;
    }

    // 出発地点と目的地を保持
    terrainAnimationPath = [
        {
            latitude: startPoint.latitude,
            longitude: startPoint.longitude
        },
        {
            latitude: goalPoint.latitude,
            longitude: goalPoint.longitude
        }
    ];


    // 2地点間の距離を計算
    terrainAnimationDistance = getRouteDistance(startPoint, goalPoint);

    // 移動設定を取得
    const animationMode = document.getElementById('terrainAnimationMode').value;

    // 移動時間を計算
    if (animationMode === 'speed') {

        // 指定速度から移動時間を計算
        const speed = Number(
            document.getElementById('terrainAnimationSpeed').value
        );

        terrainAnimationDuration = terrainAnimationDistance / speed;

    } else {

        // 指定時間をそのまま使用
        terrainAnimationDuration = Number(
            document.getElementById('terrainAnimationDurationInput').value
        );
    }


    // Leaflet地図を保持
    animationLeafletMap = leafletMap;

    // アニメーションを初期化
    terrainAnimationElapsed = 0;

    // 最初のフレームで出発地点の地形を取得する
    terrainAnimationLastUpdateDistance = -TERRAIN_UPDATE_INTERVAL;

    // DEM取得状態を初期化
    isTerrainUpdating = false;

    // // OrbitControlsの状態を保持
    // previousControlsEnabled = controls.enabled;

    // // アニメーション中はマウス操作を無効化
    // controls.enabled = false;

    // アニメーション開始
    isRouteAnimating = true;

    // 地図クリックを無効化
    setMapClickEnabled(leafletMap, false);

    // 出発地点にマーカーを表示
    updateTerrainAnimationMapMarker(
        leafletMap,
        startPoint
    );

    // ボタン状態を変更
    document.getElementById('terrainAnimationPlay').disabled = true;
    document.getElementById('terrainAnimationStop').disabled = false;

    // アニメーションループを開始
    if (animationFrameId === null) {
        previousAnimationTime = 0;
        animateTerrain();
    }
}


// ----------------------------------------
// ルート上の距離計算
// ----------------------------------------

function getRouteDistance(startPoint, goalPoint) {

    // 地球の半径（メートル）
    const earthRadius = 6371000;

    // 緯度・経度をラジアンに変換
    const startLatitude =
        startPoint.latitude * Math.PI / 180;

    const goalLatitude =
        goalPoint.latitude * Math.PI / 180;

    const latitudeDifference =
        (goalPoint.latitude - startPoint.latitude) * Math.PI / 180;

    const longitudeDifference =
        (goalPoint.longitude - startPoint.longitude) * Math.PI / 180;

    // Haversine公式で距離を計算
    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(startLatitude) *
        Math.cos(goalLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return earthRadius * c;
}


// ----------------------------------------
// ルート上の座標を取得
// ----------------------------------------

function getRoutePosition(startPoint, goalPoint, rate) {

    // 出発地点から目的地までの緯度・経度を補間
    return {
        latitude:
            startPoint.latitude +
            (goalPoint.latitude - startPoint.latitude) * rate,

        longitude:
            startPoint.longitude +
            (goalPoint.longitude - startPoint.longitude) * rate
    };
}


// 地形移動アニメーションを停止
export function stopTerrainRouteAnimation() {

    // アニメーションを停止
    isRouteAnimating = false;

    // DEM取得リクエストを無効化
    terrainRequestId++;

    // DEM取得中フラグを解除
    isTerrainUpdating = false;

    // アニメーションループを停止
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // // OrbitControlsを元に戻す
    // controls.enabled = previousControlsEnabled;

    // // アニメーション用マーカーを削除
    // if (terrainAnimationMapMarker) {
    //     animationLeafletMap.removeLayer(terrainAnimationMapMarker);
    //     terrainAnimationMapMarker = null;
    // }

    // // 現在地点マーカーを再表示
    // if (currentLocationMarker) {
    //     currentLocationMarker.setOpacity(1);
    // }

    // 地図操作を有効化
    console.log('animationLeafletMap:', animationLeafletMap);
    setMapClickEnabled(animationLeafletMap, true);

    // ボタン状態を変更
    document.getElementById('terrainAnimationPlay').disabled = false;
    document.getElementById('terrainAnimationStop').disabled = true;
}


// マーカーリセット
export function resetMarker() {
    // アニメーション用マーカーを削除
    if (terrainAnimationMapMarker) {
        animationLeafletMap.removeLayer(terrainAnimationMapMarker);
        terrainAnimationMapMarker = null;
    }

    // 現在地点マーカーを再表示
    if (currentLocationMarker) {
        currentLocationMarker.setOpacity(1);
    }
}


// 停止ボタン
console.count('停止ボタンイベント登録');
document.getElementById('terrainAnimationStop')
    .addEventListener('click', () => {
        console.log("停止ボタン");
        stopTerrainRouteAnimation();
    });


// 地図クリックの有効・無効を切り替え
function setMapClickEnabled(leafletMap, enabled) {

    console.log('setMapClickEnabled:', {
        leafletMap,
        enabled,
        time: performance.now()
    });

    if (!leafletMap) {
        console.warn('leafletMap is null');
        return;
    }


    if (enabled) {
        leafletMap.getContainer().style.pointerEvents = '';
    } else {
        leafletMap.getContainer().style.pointerEvents = 'none';
    }
}


// 地図上の現在地点マーカーを更新
function updateTerrainAnimationMapMarker(leafletMap, position) {

    const latLng = L.latLng(
        position.latitude,
        position.longitude
    );

    if (!terrainAnimationMapMarker) {

        // マーカーを生成
        terrainAnimationMapMarker = L.marker(latLng, {
            title: '現在地点'
        });

        terrainAnimationMapMarker.addTo(leafletMap);

    } else {

        // 既存マーカーの位置を更新
        terrainAnimationMapMarker.setLatLng(latLng);
    }
}