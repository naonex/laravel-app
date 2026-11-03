// ----------------------------------------
// 変数
// ----------------------------------------
export const terrainState = {
    /*
    * 標高マップ
    */
    container: null,  // 標高マップ描写領域
    status: null,     // 標高マップ下の文字出力領域
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    // 方位磁針用
    compassScene: null,
    compassCamera: null,
    // 標高マップの初期化済みフラグ
    initialized: false,

    // 地形取得リクエストの管理
    terrainRequestId: 0,
    
    // 地形メッシュ
    terrainMesh: null,
    // 選択地点の標高マップ側マーカー
    terrainMarker: null,
    // ルートライン
    terrainRouteLine: null,

    /* ルートアニメーション管理 */
    isRouteAnimating: false,
    animationFrameId: null,
    previousAnimationTime: 0,

    /* 地形移動アニメーション管理 */
    terrainAnimationPath: [],
    terrainAnimationDistance: 0,  // 総移動距離（m）
    terrainAnimationDuration: 0,  // 総移動時間（秒）

    terrainAnimationElapsed: 0,   // 経過時間（秒）
    terrainAnimationLastUpdateTime: 0,  // 最終更新時刻（ミリ秒）
    terrainAnimationLastUpdateDistance: 0,  // 最後に地形を更新した距離（m）
    isTerrainUpdating: false,  // DEM取得中フラグ

    // 地図側アニメーションcallback用
    mapCallbacks: null,
};
