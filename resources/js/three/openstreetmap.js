import {
    createTerrain, initTerrain, startTerrainRouteAnimation, stopTerrainRouteAnimation,
    TERRAIN_SIZE, DEM_ZOOM
} from './terrain.js';

// ----------------------------------------
// 定数
// ----------------------------------------
// 福岡市を初期表示位置に設定
const defaultPosition = [33.5902, 130.4017];
// クリック地点用のマーカーアイコン
const selectedLocationIcon = L.divIcon({
    className: '',
    html: `
        <div style="
            background-color: #ef4444;
            width: 20px;
            height: 20px;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        "></div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26]
});

// ----------------------------------------
// 変数
// ----------------------------------------
// ルート管理用
let startPoint = null;
let goalPoint = null;
let currentLocationMarker = null;
let selectedLocationMarker = null;  // クリック地点のマーカー
let routeLine = null;
let terrainAnimationMapMarker = null;  // アニメーション用マーカー
// 地形表示範囲の矩形
let terrainArea = null;

// ----------------------------------------
// 初期処理
// ----------------------------------------
// 地図の初期化
const leafletMap = L.map('map').setView(defaultPosition, 13);
// 標高マップの初期化
initTerrain();

// 地図のタイルセット
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(leafletMap);

// 現在地を取得（画面アクセス時に動作。位置情報権限の許可が必要）
navigator.geolocation.getCurrentPosition(
    (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        // 現在地をルート開始地点として保持
        startPoint = {
            latitude: latitude,
            longitude: longitude
        };

        // 現在地を中心に表示
        leafletMap.setView([latitude, longitude], 15);
        // 現在地にマーカーを配置
        currentLocationMarker = L.marker([latitude, longitude])
            .addTo(leafletMap)
            .bindPopup('現在地')
            .openPopup();
        // マーカーのクリックイベント
        currentLocationMarker.on('click', () => {
            callCreateTerrain(latitude, longitude);
        });

        updateRoute();  // 地図上のルート更新
        callCreateTerrain(latitude, longitude);
    },
    (error) => {
        console.error('現在地を取得できませんでした。', error);
    }
);

// ----------------------------------------
// イベント処理
// ----------------------------------------
// 地図のクリックイベント
function handleMapClick(e) {
    // Leafletから緯度・経度を取得
    const latitude = e.latlng.lat;
    const longitude = e.latlng.lng;
    // 選択地点を保持
    goalPoint = {
        latitude: latitude,
        longitude: longitude
    };

    // 既存のクリック地点マーカーを削除
    if (selectedLocationMarker) {
        leafletMap.removeLayer(selectedLocationMarker);
    }
    // クリック地点にマーカーを配置
    selectedLocationMarker = L.marker([latitude, longitude], { icon: selectedLocationIcon })
        .addTo(leafletMap)
        .bindPopup('選択地点')
        .openPopup();
    // マーカーのクリックイベント
    selectedLocationMarker.on('click', () => {
        callCreateTerrain(latitude, longitude);
    });

    updateRoute();  // 地図上のルート更新
    callCreateTerrain(latitude, longitude);
}
setMapClickEnabled(leafletMap, true);

// ルート再生ボタン
document.getElementById('terrainAnimationPlay')
    .addEventListener('click', () => {
        startTerrainRouteAnimation(
            startPoint,
            goalPoint,
            {
                /* アニメーション開始時の地図処理 */
                onStart: () => {
                    // ボタン状態を変更
                    document.getElementById('terrainAnimationPlay').disabled = true;
                    document.getElementById('terrainAnimationStop').disabled = false;

                    // 地図クリックを無効化
                    setMapClickEnabled(leafletMap, false);

                    // 現在地点マーカーを非表示
                    if (currentLocationMarker) {
                        currentLocationMarker.setOpacity(0);
                    }
                    // 出発地点にマーカーを表示
                    updateTerrainAnimationMapMarker(startPoint);
                },

                /* アニメーション中の地図更新 */
                // 地図マーカー更新
                onUpdateMarker: updateTerrainAnimationMapMarker,
                // 矩形更新（アニメーション中）
                onAreaUpdate: (centerPixel, metersPerPixel) => {
                    updateTerrainArea(
                        leafletMap,
                        centerPixel,
                        metersPerPixel
                    );
                },

                /* アニメーション停止時の地図処理 */
                onStop: () => {
                    // 地図クリックを有効化
                    setMapClickEnabled(leafletMap, true);

                    // NOTE: このタイミングではアニメーション用マーカーのままにする（標高マップと同期させるため）

                    // ボタン状態を変更
                    document.getElementById('terrainAnimationPlay').disabled = false;
                    document.getElementById('terrainAnimationStop').disabled = true;
                },

                /* アニメーション中の座標計算関数 */
                convertToPixel: (position) => convertToPixel(
                    position.latitude,
                    position.longitude
                ),
                getRoutePosition: (rate) => getRoutePosition(rate)
            }
        );
    });

// 停止ボタン
document.getElementById('terrainAnimationStop')
    .addEventListener('click', () => {
        stopTerrainRouteAnimation();
    });

// 移動方式のリストボックス
document.getElementById('terrainAnimationMode')
    .addEventListener('change', (event) => {
        const isSpeedMode = event.target.value === 'speed';

        document.getElementById('terrainAnimationSpeedArea')
            .classList.toggle('hidden', !isSpeedMode);

        document.getElementById('terrainAnimationDurationArea')
            .classList.toggle('hidden', isSpeedMode);
    });

// 地図クリックイベントの有効・無効を切り替え
function setMapClickEnabled(leafletMap, enabled) {
    if (!leafletMap) return;

    // 既存のイベントを解除
    leafletMap.off('click', handleMapClick);
    // 有効の場合は再登録
    if (enabled) {
        leafletMap.on('click', handleMapClick);
    }
}

// ----------------------------------------
// 地図描写処理
// ----------------------------------------
/* 現在地と選択地点間のルートライン */
function updateRoute() {
    // 2地点が揃っていない場合、描写しない
    if (!startPoint || !goalPoint) {
        return;
    }

    // 既存のルートを削除
    if (routeLine) {
        leafletMap.removeLayer(routeLine);
    }
    // 2地点を直線で結ぶ
    routeLine = L.polyline(
        [
            [startPoint.latitude, startPoint.longitude],
            [goalPoint.latitude, goalPoint.longitude]
        ],
        {
            color: '#ff0000',
            weight: 4,
            opacity: 0.8
        }
    ).addTo(leafletMap);

    // 再生ボタンを活性（現在地と選択地点が判明した時に再生有効化）
    document.getElementById('terrainAnimationPlay').disabled = false;
}

/* 地図上の"現在地点マーカー"を更新 */
function updateTerrainAnimationMapMarker(position) {
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

/* "地形表示範囲"を地図上に表示 */
function updateTerrainArea(
    leafletMap,
    centerPixel,
    metersPerPixel
) {
    // 地形の半分のサイズ（メートル）
    const halfSize = TERRAIN_SIZE / 2;

    // 中心地点から南北・東西に広げた範囲
    const southWest = leafletMap.unproject(
        L.point(
            centerPixel.x - halfSize / metersPerPixel,
            centerPixel.y + halfSize / metersPerPixel
        ),
        DEM_ZOOM
    );

    const northEast = leafletMap.unproject(
        L.point(
            centerPixel.x + halfSize / metersPerPixel,
            centerPixel.y - halfSize / metersPerPixel
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

// ----------------------------------------
// 標高マップ作成処理
// ----------------------------------------
// 地形を生成して3Dルートを更新
function callCreateTerrain(latitude, longitude) {
    /* アニメーション時のマーカーをリセット */
    // アニメーション用マーカーを削除
    if (terrainAnimationMapMarker) {
        leafletMap.removeLayer(terrainAnimationMapMarker);
        terrainAnimationMapMarker = null;
    }
    // 現在地点マーカーを再表示
    if (currentLocationMarker) {
        currentLocationMarker.setOpacity(1);
    }

    // 標高マップ中心のピクセル座標
    const centerPixel = convertToPixel(
        latitude,
        longitude
    );
    // 現在地・選択地点のピクセル座標（未設定の場合はnull）
    const startPixel = startPoint
        ? convertToPixel(startPoint.latitude, startPoint.longitude)
        : null;
    const goalPixel = goalPoint
        ? convertToPixel(goalPoint.latitude, goalPoint.longitude)
        : null;

    // 地形を生成
    createTerrain(
        latitude,
        longitude,
        centerPixel,
        startPixel,
        goalPixel,
        {
            // 矩形更新（地形生成時）
            onAreaUpdate: (centerPixel, metersPerPixel) => {
                updateTerrainArea(
                    leafletMap,
                    centerPixel,
                    metersPerPixel
                );
            }
        }
    );
}

// ----------------------------------------
// サブ関数
// ----------------------------------------
// 緯度・経度をピクセル座標に変換
function convertToPixel(latitude, longitude) {
    const point = leafletMap.project(
        L.latLng(latitude, longitude),
        DEM_ZOOM
    );

    return {
        x: point.x,
        y: point.y
    };
}

// ルート上の座標を計算 ... 地図側で計算し地形と同期させる
function getRoutePosition(rate) {
    // NOTE: ※現在地・選択地点が設定されている前提

    // 緯度・経度をピクセル座標に変換
    const startPixel = leafletMap.project(
        L.latLng(startPoint.latitude, startPoint.longitude),
        DEM_ZOOM
    );
    const goalPixel = leafletMap.project(
        L.latLng(goalPoint.latitude, goalPoint.longitude),
        DEM_ZOOM
    );

    // ピクセル座標を補間
    const currentPixel = L.point(
        startPixel.x + (goalPixel.x - startPixel.x) * rate,
        startPixel.y + (goalPixel.y - startPixel.y) * rate
    );

    // ピクセル座標を緯度・経度に戻す
    const currentLatLng = leafletMap.unproject(
        currentPixel,
        DEM_ZOOM
    );

    return {
        latitude: currentLatLng.lat,
        longitude: currentLatLng.lng
    };
}