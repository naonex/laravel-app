import { createTerrain, initTerrain, updateTerrainRoute, startTerrainRouteAnimation, resetMarker } from './terrain.js';

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
// 2地点の管理
// ----------------------------------------

let startPoint = null;
let goalPoint = null;

let currentLocationMarker = null;
// クリック地点のマーカー
let selectedLocationMarker = null;

let routeLine = null;


// マップの初期化
const leafletMap = L.map('map').setView(defaultPosition, 13);
// Three.js初期化
initTerrain();

// タイルセット
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(leafletMap);


// 現在地を取得
navigator.geolocation.getCurrentPosition(
    (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // 現在地を保持
        startPoint = {
            latitude: latitude,
            longitude: longitude
        };

        // 現在地を中心に表示
        leafletMap.setView([latitude, longitude], 15);

        // 現在地にマーカーを配置
        currentLocationMarker = L.marker([latitude, longitude])
            .addTo(leafletMap)
            .bindPopup('現在地');


        // マーカーのクリックイベント
        currentLocationMarker.on('click', () => {
            // クリックした地点の標高データを取得して3D地形を表示
            createTerrain(leafletMap, latitude, longitude)
                .then(() => {
                    updateTerrainRoute(leafletMap, startPoint, goalPoint);
                });
        });


        // 現在地の標高データを取得して3D地形を表示
        createTerrain(leafletMap, latitude, longitude);

        // 2地点間のルートを更新
        updateRoute();
    },
    (error) => {
        console.error('現在地を取得できませんでした。', error);
    }
);


// ----------------------------------------
// Leafletのクリックイベント
// ----------------------------------------

leafletMap.on('click', (e) => {
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
    // アニメーション時のマーカーをリセット
    resetMarker();

    // クリック地点にマーカーを配置
    selectedLocationMarker = L.marker([latitude, longitude], { icon: selectedLocationIcon })
        .addTo(leafletMap)
        .bindPopup('選択地点')
        .openPopup();

    // マーカーのクリックイベント
    selectedLocationMarker.on('click', () => {
        // クリックした地点の標高データを取得して3D地形を表示
        createTerrain(leafletMap, latitude, longitude)
            .then(() => {
                updateTerrainRoute(leafletMap, startPoint, goalPoint);
            });
    });
    
    console.log('地形生成開始');
    console.log('緯度:', latitude);
    console.log('経度:', longitude);


    // そのまま国土地理院の標高データ取得に使用（国土地理院も世界測地系なので変換不要）
    createTerrain(leafletMap, latitude, longitude)
        .then(() => {
            updateTerrainRoute(leafletMap, startPoint, goalPoint);
        });

        
    // 2地点間のルートを更新
    updateRoute();
});


// ----------------------------------------
// 2地点間のルート描画
// ----------------------------------------

function updateRoute() {

    // 2地点が揃っていなければ何もしない
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
}


// ----------------------------------------
// ルート再生ボタン
// ----------------------------------------

document.getElementById('terrainAnimationPlay')
    .addEventListener('click', () => {

        startTerrainRouteAnimation(
            leafletMap,
            startPoint,
            goalPoint,
            currentLocationMarker
        );

    });


// 移動設定の切り替え
document.getElementById('terrainAnimationMode')
    .addEventListener('change', (event) => {

        const isSpeedMode = event.target.value === 'speed';

        document.getElementById('terrainAnimationSpeedArea')
            .classList.toggle('hidden', !isSpeedMode);

        document.getElementById('terrainAnimationDurationArea')
            .classList.toggle('hidden', isSpeedMode);
    });

