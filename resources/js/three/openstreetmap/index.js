import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// map生成
var map = L.map('map').setView([51.505, -0.09], 13);
// タイルセット
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// マーカー、円、多角形をセット
var marker = L.marker([51.5, -0.09]).addTo(map);
var circle = L.circle([51.508, -0.11], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 500
}).addTo(map);
var polygon = L.polygon([
    [51.509, -0.08],
    [51.503, -0.06],
    [51.51, -0.047]
]).addTo(map);
// ポップアップをセット
marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
circle.bindPopup("I am a circle.");
polygon.bindPopup("I am a polygon.");
var popup = L.popup()
    .setLatLng([51.513, -0.09])
    .setContent("I am a standalone popup.")
    .openOn(map);
// イベントセット
var clickPopup = L.popup();
let camera, controls, scene, renderer;
function onMapClick(e) {
    //alert("You clicked the map at " + e.latlng);

    clickPopup
        .setLatLng(e.latlng)
        .setContent("You clicked the map at " + e.latlng.toString())
        .openOn(map);

    //Mapから地図imgを取得 NOTE: CORS対策のため、laravelの内部APIで画像を取得して返す形とする
    //let mapImgs = document.querySelectorAll("#map img")
    let mapImg = document.querySelector("#map img")
    let imageUrl = 'http://localhost/api/image?url=' + mapImg.src.replace('https://', '')

    const width = 500;
    const height = 500;

    // Renderer設定
    let canvas = document.getElementById('myCanvas');
    renderer = new THREE.WebGLRenderer( { 'canvas' : canvas } );
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Cameraを用意
    camera = new THREE.PerspectiveCamera();
    camera.position.z = 500;
  
    // カメラコントローラ作成
    controls = new OrbitControls(camera, canvas);

    // 画像を読み込む
    new THREE.TextureLoader().load(
      imageUrl,
      function ( texture ) {
        // 画像を指定したmaterialの用意
        //var material = new THREE.MeshBasicMaterial( {
        //  map:THREE.ImageUtils.loadTexture(imageUrl, {}, function() {renderer.render(scene, camera);})
        //} );
        var material = new THREE.MeshBasicMaterial( { map:texture } );

        // Cubeの用意
        var geometry = new THREE.PlaneGeometry(250, 250);
        var mesh = new THREE.Mesh( geometry, material );

        // Sceneを用意
        scene = new THREE.Scene();
        scene.add( mesh );

        // 初回実行
        tick();
      }
    );
}
map.on('click', onMapClick);

function tick() {
  requestAnimationFrame(tick);

  //// 箱を回転させる
  //box.rotation.x += 0.01;
  //box.rotation.y += 0.01;

  // レンダリング
  renderer.render(scene, camera);
}

/*
let container, stats;

let camera, controls, scene, renderer;

let mesh, texture;

const worldWidth = 256, worldDepth = 256,
  worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;

let helper;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();
animate();

function init() {
  //表示領域サイズ
  const divWidth = 500;
  const divHeight = 500;

  container = document.getElementById( 'container' );
  container.innerHTML = '';

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( divWidth, divHeight );
  renderer.useLegacyLights = false;
  container.appendChild( renderer.domElement );

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xbfd1e5 );

  camera = new THREE.PerspectiveCamera( 60, divWidth / divHeight, 10, 20000 );

  controls = new OrbitControls( camera, renderer.domElement );
  controls.minDistance = 1000;
  controls.maxDistance = 10000;
  controls.maxPolarAngle = Math.PI / 2;

  //

  const data = generateHeight( worldWidth, worldDepth );

  controls.target.y = data[ worldHalfWidth + worldHalfDepth * worldWidth ] + 500;
  camera.position.y = controls.target.y + 5000;
  camera.position.x = 2000;
  camera.position.x = 1000;
  controls.update();

  const geometry = new THREE.PlaneGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 );
  geometry.rotateX( - Math.PI / 2 );

  const vertices = geometry.attributes.position.array;

  for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {

    vertices[ j + 1 ] = data[ i ] * 10;

  }

  //

  texture = new THREE.CanvasTexture( generateTexture( data, worldWidth, worldDepth ) );
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  mesh = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture } ) );
  scene.add( mesh );

  const geometryHelper = new THREE.ConeGeometry( 20, 100, 3 );
  geometryHelper.translate( 0, 50, 0 );
  geometryHelper.rotateX( Math.PI / 2 );
  helper = new THREE.Mesh( geometryHelper, new THREE.MeshNormalMaterial() );
  scene.add( helper );

  container.addEventListener( 'pointermove', onPointerMove );

  stats = new Stats();
  container.appendChild( stats.dom );

  //

  window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

  camera.aspect = divWidth / divHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( divWidth, divHeight );

}

function generateHeight( width, height ) {

  const size = width * height, data = new Uint8Array( size ),
    perlin = new ImprovedNoise(), z = Math.random() * 100;

  let quality = 1;

  for ( let j = 0; j < 4; j ++ ) {

    for ( let i = 0; i < size; i ++ ) {

      const x = i % width, y = ~ ~ ( i / width );
      data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * quality * 1.75 );

    }

    quality *= 5;

  }

  return data;

}

function generateTexture( data, width, height ) {

  // bake lighting into texture

  let context, image, imageData, shade;

  const vector3 = new THREE.Vector3( 0, 0, 0 );

  const sun = new THREE.Vector3( 1, 1, 1 );
  sun.normalize();

  const canvas = document.createElement( 'canvas' );
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext( '2d' );
  context.fillStyle = '#000';
  context.fillRect( 0, 0, width, height );

  image = context.getImageData( 0, 0, canvas.width, canvas.height );
  imageData = image.data;

  for ( let i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++ ) {

    vector3.x = data[ j - 2 ] - data[ j + 2 ];
    vector3.y = 2;
    vector3.z = data[ j - width * 2 ] - data[ j + width * 2 ];
    vector3.normalize();

    shade = vector3.dot( sun );

    imageData[ i ] = ( 96 + shade * 128 ) * ( 0.5 + data[ j ] * 0.007 );
    imageData[ i + 1 ] = ( 32 + shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
    imageData[ i + 2 ] = ( shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );

  }

  context.putImageData( image, 0, 0 );

  // Scaled 4x

  const canvasScaled = document.createElement( 'canvas' );
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext( '2d' );
  context.scale( 4, 4 );
  context.drawImage( canvas, 0, 0 );

  image = context.getImageData( 0, 0, canvasScaled.width, canvasScaled.height );
  imageData = image.data;

  for ( let i = 0, l = imageData.length; i < l; i += 4 ) {

    const v = ~ ~ ( Math.random() * 5 );

    imageData[ i ] += v;
    imageData[ i + 1 ] += v;
    imageData[ i + 2 ] += v;

  }

  context.putImageData( image, 0, 0 );

  return canvasScaled;

}

//

function animate() {

  requestAnimationFrame( animate );

  render();
  stats.update();

}

function render() {

  renderer.render( scene, camera );

}

function onPointerMove( event ) {

  pointer.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
  pointer.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;
  raycaster.setFromCamera( pointer, camera );

  // See if the ray from the camera into the world hits one of our meshes
  const intersects = raycaster.intersectObject( mesh );

  // Toggle rotation bool for meshes that we clicked
  if ( intersects.length > 0 ) {

    helper.position.set( 0, 0, 0 );
    helper.lookAt( intersects[ 0 ].face.normal );

    helper.position.copy( intersects[ 0 ].point );

  }

}
*/