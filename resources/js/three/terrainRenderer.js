import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { terrainState } from './terrainState.js';
import { TERRAIN_SIZE, TERRAIN_SEGMENTS, HEIGHT_SCALE } from './terrainConfig.js';

/* レンダリング処理 */

// ----------------------------------------
// 基本描写
// ----------------------------------------
// 標高マップ初期化
export function initTerrain() {

    // 二重初期化防止
    if (terrainState.initialized) {
        return;
    }

    terrainState.initialized = true;

    terrainState.container = document.getElementById('terrain3d');
    terrainState.status = document.getElementById('terrainStatus');

    // Scene（3D空間）の作成
    terrainState.scene = new THREE.Scene();
    terrainState.scene.background = new THREE.Color(0x1e293b);

    // Camera（視点）の作成
    terrainState.camera = new THREE.PerspectiveCamera(
        45,
        terrainState.container.clientWidth / terrainState.container.clientHeight,
        1,     // Near：描画する最短距離
        50000  // Far：描画する最長距離
    );
    // 地形はXY平面、高さはZ軸で表現
    terrainState.camera.up.set(0, 0, 1);
    terrainState.camera.position.set(1000, -1200, 1000);

    // Renderer（描画処理）の作成
    terrainState.renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    terrainState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    terrainState.renderer.setSize(terrainState.container.clientWidth, terrainState.container.clientHeight);
    terrainState.container.appendChild(terrainState.renderer.domElement);
    // 描画ごとの自動クリアを無効化
    terrainState.renderer.autoClear = false;

    // Light（照明）の設定
    terrainState.scene.add(new THREE.AmbientLight(0xffffff, 1.2));       // AmbientLight（環境光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);  // DirectionalLight（平行光源）
    directionalLight.position.set(500, -500, 1000);
    terrainState.scene.add(directionalLight);

    // OrbitControls（マウス操作）の設定
    terrainState.controls = new OrbitControls(terrainState.camera, terrainState.renderer.domElement);
    terrainState.controls.enableDamping = true;
    terrainState.controls.target.set(0, 0, 0);
    terrainState.controls.maxDistance = 20000;  // 最大縮小設定
    // カメラの上下回転を制限（方位磁針描写を安定させるため）
    terrainState.controls.minPolarAngle = 0;
    terrainState.controls.maxPolarAngle = Math.PI * 0.45;

    // 方位磁針用Scene,Camera
    terrainState.compassScene = new THREE.Scene();
    terrainState.compassCamera = new THREE.OrthographicCamera(
        -1, 1, 1, -1, 0.1, 10
    );
    // 方位磁針初期化
    initCompass();

    // レンダリングループ
    terrainState.renderer.setAnimationLoop(() => {
        terrainState.controls.update();
        // コンパスの回転を更新
        updateCompassRotation();

        // 画面を一度だけクリア
        terrainState.renderer.clear();

        // 地形を描画
        terrainState.renderer.render(terrainState.scene, terrainState.camera);

        // 深度情報をクリア
        terrainState.renderer.clearDepth();
        // 方位磁針を描画
        terrainState.renderer.render(
            terrainState.compassScene,
            terrainState.compassCamera
        );
    });

    // 画面サイズ変更時の対応
    const resizeObserver = new ResizeObserver(() => {
        const width = terrainState.container.clientWidth;
        const height = terrainState.container.clientHeight;

        terrainState.camera.aspect = width / height;
        terrainState.camera.updateProjectionMatrix();

        terrainState.renderer.setSize(width, height);

        // 方位磁針Cameraの表示範囲を更新
        const aspect = width / height;

        terrainState.compassCamera.left = -1.5 * aspect;
        terrainState.compassCamera.right = 1.5 * aspect;
        terrainState.compassCamera.top = 1.5;
        terrainState.compassCamera.bottom = -1.5;

        terrainState.compassCamera.updateProjectionMatrix();
    });
    resizeObserver.observe(terrainState.container);
}

// 方位磁針初期化
function initCompass() {
    terrainState.compassScene = new THREE.Scene();
    terrainState.compassCamera = new THREE.OrthographicCamera(
        -1.5, 1.5,
        1.5, -1.5,
        0.1, 10
    );
    terrainState.compassCamera.position.set(0, 0, 5);

    // 方位磁針を追加
    terrainState.compass = createCompass();
    // コンパス全体の大きさ
    terrainState.compass.scale.set(0.3, 0.3, 1);
    // コンパスの表示位置
    terrainState.compass.position.set(0.95, 0.95, 0);

    terrainState.compassScene.add(terrainState.compass);
}

// "カメラ位置"を更新
export function updateTerrainCamera(
    minElevation,
    maxElevation,
    cameraOffset,
    preserveCamera
) {
    // カメラと操作対象をリセット
    const centerHeight = (maxElevation - minElevation) * HEIGHT_SCALE / 2;

    terrainState.controls.target.set(0, 0, centerHeight);

    if (preserveCamera) {
        // カメラの角度と距離を維持
        terrainState.camera.position.copy(
            terrainState.controls.target.clone().add(cameraOffset)
        );

    } else {
        terrainState.camera.position.set(
            1000,
            -1200,
            centerHeight + 1000
        );
    }

    terrainState.controls.update();
}

// ----------------------------------------
// 3Dオブジェクト
// ----------------------------------------
/* "方位磁針" */
// 方位磁針生成
function createCompass() {
    const group = new THREE.Group();

    // 外枠
    const circleGeometry = new THREE.RingGeometry(0.85, 0.9, 64);
    const circleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
    });

    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    group.add(circle);

    // 北を示す矢印
    const arrowGeometry = new THREE.BufferGeometry();

    const arrowVertices = new Float32Array([
        0, 0.75, 0,
        -0.15, 0.1, 0,
        0, 0.2, 0,

        0, 0.75, 0,
        0, 0.2, 0,
        0.15, 0.1, 0
    ]);

    arrowGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(arrowVertices, 3)
    );

    const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide
    });

    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    group.add(arrow);

    // 方位文字
    const directions = [
        { text: 'N', x: 0, y: 1.15 },
        { text: 'S', x: 0, y: -1.15 },
        { text: 'E', x: 1.15, y: 0 },
        { text: 'W', x: -1.15, y: 0 }
    ];

    directions.forEach((direction) => {
        const sprite = createDirectionLabel(direction.text);

        sprite.position.set(
            direction.x,
            direction.y,
            0
        );

        sprite.scale.set(0.35, 0.35, 1);

        group.add(sprite);
    });

    // 中心の円
    const centerGeometry = new THREE.CircleGeometry(0.08, 32);
    const centerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.position.z = 0.01;

    group.add(center);

    return group;
}

// 方角ラベル生成
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

// コンパスの回転をカメラの向きに同期
function updateCompassRotation() {
    const camera = terrainState.camera;
    const compass = terrainState.compass;

    // カメラのワールド座標系を更新
    camera.updateMatrixWorld(true);

    // カメラの右方向と上方向を取得
    const cameraRight = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion);

    const cameraUp = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(camera.quaternion);

    // 地形の北方向（Y軸）を定義
    const north = new THREE.Vector3(0, 1, 0);

    // 北方向が画面上のどこに見えるかを計算
    const x = north.dot(cameraRight);
    const y = north.dot(cameraUp);

    // コンパスの回転角を計算
    compass.rotation.z = Math.atan2(y, x) - Math.PI / 2;
}

/* "3D地形メッシュ"を生成・配置 */
export function renderTerrainMesh(
    elevations,
    minElevation,
    maxElevation
) {
    // 標高マップのジオメトリ生成
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
                (elevation - minElevation) / Math.max(maxElevation - minElevation, 1)  // 表示範囲内で色設定する
            )
        );

        const color = new THREE.Color();
        if (isMissing) {
            // 標高データがない場合はグレー
            color.set('#808080');

        } else {
            // 標高に応じた色
            color.setHSL(
                0.33 - rate * 0.25,  // H（Hue）：色相。赤・黄・緑・青など、色の種類
                0.65,                // S（Saturation）：彩度。色の鮮やかさ
                0.3 + rate * 0.25    // L（Lightness）：明度。色の明るさ
            );
        }
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
    );
    geometry.computeVertexNormals();
    // メッシュ生成
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        side: THREE.DoubleSide
    });
    const newMesh = new THREE.Mesh(geometry, material);

    // 以前の地形を削除
    if (terrainState.terrainMesh) {
        terrainState.scene.remove(terrainState.terrainMesh);
        terrainState.terrainMesh.geometry.dispose();
        terrainState.terrainMesh.material.dispose();
    }

    terrainState.terrainMesh = newMesh;

    // シーンに追加
    terrainState.scene.add(terrainState.terrainMesh);
}

/* "3D地形上のマーカー"を生成 */
export function createTerrainMarker(elevations, minElevation) {
    // 以前のマーカーを削除
    if (terrainState.terrainMarker) {
        terrainState.scene.remove(terrainState.terrainMarker);

        terrainState.terrainMarker.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });

        terrainState.terrainMarker = null;
    }

    // ピンの設定
    const pinHeight = 60;
    const pinRadius = 10;

    // ピン全体をまとめるグループ
    terrainState.terrainMarker = new THREE.Group();

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
    terrainState.terrainMarker.add(pinTip);
    terrainState.terrainMarker.add(pinHead);

    // 地形の中心に配置
    const centerIndex =
        Math.floor(TERRAIN_SEGMENTS / 2) * (TERRAIN_SEGMENTS + 1) +
        Math.floor(TERRAIN_SEGMENTS / 2);

    const centerElevation = elevations[centerIndex] ?? minElevation;

    terrainState.terrainMarker.position.set(
        0,
        0,
        (centerElevation - minElevation) * HEIGHT_SCALE
    );

    terrainState.scene.add(terrainState.terrainMarker);
}

/* "3D地形上のルート"描画 */
export function updateTerrainRoute(centerPixel, startPixel, goalPixel, metersPerPixel) {
    // 必要なデータが揃っていなければ何もしない
    if (
        !terrainState.terrainMesh ||
        !centerPixel ||
        !startPixel ||
        !goalPixel ||
        !metersPerPixel
    ) {
        return;
    }

    // 既存のルートを削除
    if (terrainState.terrainRouteLine) {
        terrainState.scene.remove(terrainState.terrainRouteLine);
        terrainState.terrainRouteLine.geometry.dispose();
        terrainState.terrainRouteLine.material.dispose();
        terrainState.terrainRouteLine = null;
    }

    // 地図のピクセル座標をThree.jsのローカル座標に変換
    const startX = (startPixel.x - centerPixel.x) * metersPerPixel;
    const startY = -(startPixel.y - centerPixel.y) * metersPerPixel;
    const goalX = (goalPixel.x - centerPixel.x) * metersPerPixel;
    const goalY = -(goalPixel.y - centerPixel.y) * metersPerPixel;

    // 地形との交差判定に使用するRaycaster
    const raycaster = new THREE.Raycaster();

    // 地形の高さの最大値を取得
    terrainState.terrainMesh.geometry.computeBoundingBox();

    const maxHeight = terrainState.terrainMesh.geometry.boundingBox.max.z;

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

    terrainState.terrainMesh.updateMatrixWorld(true);

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
            terrainState.terrainMesh,
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
    terrainState.terrainRouteLine = new THREE.Line(geometry, material);

    terrainState.scene.add(terrainState.terrainRouteLine);
}
