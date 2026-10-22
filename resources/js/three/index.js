window.addEventListener("DOMContentLoaded", init);

function init() {
    const width = 960;
    const height = 540;
  
    // レンダラーを作成
    const canvasElement = document.querySelector('#myCanvas')
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasElement
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
  
    // シーンを作成
    const scene = new THREE.Scene();
  
    // カメラを作成
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    // カメラの初期座標を設定（X座標, Y座標, Z座標）
    camera.position.set(0, 0, 1000);
  
    // カメラコントローラ作成
    const controls = new THREE.OrbitControls(camera, canvasElement);

    // 箱を作成
    const geometry = new THREE.BoxGeometry(400, 400, 400);
    //const material = new THREE.MeshStandardMaterial();
    const material = new THREE.MeshNormalMaterial();
    const box = new THREE.Mesh(geometry, material);
    scene.add(box);
  
    // 平行光源
    const light = new THREE.DirectionalLight(0xFFFFFF);
    light.intensity = 2; // 光の強さを倍に
    light.position.set(1, 1, 1); // ライトの方向
    // シーンに追加
    scene.add(light);

    // 初回実行
    tick();

    function tick() {
      requestAnimationFrame(tick);
    
      // 箱を回転させる
      box.rotation.x += 0.01;
      box.rotation.y += 0.01;
    
      // レンダリング
      renderer.render(scene, camera);
    }
}