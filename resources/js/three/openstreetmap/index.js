import { createTerrain, initTerrain } from './terrain.js';

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

// クリック地点のマーカー
let selectedLocationMarker = null;

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

        // 現在地を中心に表示
        leafletMap.setView([latitude, longitude], 15);

        // 現在地にマーカーを配置
        const currentLocationMarker = L.marker([latitude, longitude])
            .addTo(leafletMap)
            .bindPopup('現在地');

        // マーカーのクリックイベント
        currentLocationMarker.on('click', () => {
            // クリックした地点の標高データを取得して3D地形を表示
            createTerrain(leafletMap, latitude, longitude);
        });

        // 現在地の標高データを取得して3D地形を表示
        createTerrain(leafletMap, latitude, longitude);
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
        // クリックした地点の標高データを取得して3D地形を表示
        createTerrain(leafletMap, latitude, longitude);
    });    

    console.log('地形生成開始');
    console.log('緯度:', latitude);
    console.log('経度:', longitude);

    // そのまま国土地理院の標高データ取得に使用（国土地理院も世界測地系なので変換不要）
    createTerrain(leafletMap, latitude, longitude);
});


// // マーカー、円、多角形をセット
// var marker = L.marker([51.5, -0.09]).addTo(map);
// var circle = L.circle([51.508, -0.11], {
//     color: 'red',
//     fillColor: '#f03',
//     fillOpacity: 0.5,
//     radius: 500
// }).addTo(map);
// var polygon = L.polygon([
//     [51.509, -0.08],
//     [51.503, -0.06],
//     [51.51, -0.047]
// ]).addTo(map);
// // ポップアップをセット
// marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
// circle.bindPopup("I am a circle.");
// polygon.bindPopup("I am a polygon.");
// var popup = L.popup()
//     .setLatLng([51.513, -0.09])
//     .setContent("I am a standalone popup.")
//     .openOn(map);


// // イベントセット
// var clickPopup = L.popup();
// let camera, controls, scene, renderer;
// function onMapClick(e) {
//     //alert("You clicked the map at " + e.latlng);

//     clickPopup
//         .setLatLng(e.latlng)
//         .setContent("You clicked the map at " + e.latlng.toString())
//         .openOn(map);

//     //Mapから地図imgを取得 NOTE: CORS対策のため、laravelの内部APIで画像を取得して返す形とする
//     //let mapImgs = document.querySelectorAll("#map img")
//     let mapImg = document.querySelector("#map img")
//     const apiUrl = `${window.location.origin}/api/image`;
//     let imageUrl = apiUrl + '?url=' + mapImg.src.replace('https://', '')
    
//     const width = 500;
//     const height = 500;

//     // Renderer設定
//     let canvas = document.getElementById('myCanvas');
//     renderer = new THREE.WebGLRenderer( { 'canvas' : canvas } );
//     renderer.setSize(width, height);
//     renderer.setPixelRatio(window.devicePixelRatio);

//     // Cameraを用意
//     camera = new THREE.PerspectiveCamera();
//     camera.position.z = 500;
  
//     // カメラコントローラ作成
//     controls = new OrbitControls(camera, canvas);

//     // 画像を読み込む
//     new THREE.TextureLoader().load(
//       imageUrl,
//       function ( texture ) {
//         // 画像を指定したmaterialの用意
//         //var material = new THREE.MeshBasicMaterial( {
//         //  map:THREE.ImageUtils.loadTexture(imageUrl, {}, function() {renderer.render(scene, camera);})
//         //} );
//         var material = new THREE.MeshBasicMaterial( { map:texture } );

//         // Cubeの用意
//         var geometry = new THREE.PlaneGeometry(250, 250);
//         var mesh = new THREE.Mesh( geometry, material );

//         // Sceneを用意
//         scene = new THREE.Scene();
//         scene.add( mesh );

//         // 初回実行
//         tick();
//       }
//     );
// }
// map.on('click', onMapClick);

// function tick() {
//   requestAnimationFrame(tick);

//   //// 箱を回転させる
//   //box.rotation.x += 0.01;
//   //box.rotation.y += 0.01;

//   // レンダリング
//   renderer.render(scene, camera);
// }

