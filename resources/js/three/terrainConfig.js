// ----------------------------------------
// 定数
// ----------------------------------------
// 標高タイルの取得先（優先順位順） .... 国土地理院のDEM（数値標高モデル）タイル
export const DEM_SOURCES = [
    'dem5a_png',
    'dem5b_png',
    'dem5c_png',
    'dem_png'
];
// 標高タイルのズームレベル
export const DEM_ZOOM = 14;
// 地形の表示範囲（メートル）
export const TERRAIN_SIZE = 1000;
// 地形の分割数
export const TERRAIN_SEGMENTS = 128;
// 標高の強調倍率
export const HEIGHT_SCALE = 2;

// アニメーション時の地形更新間隔（ミリ秒）
export const TERRAIN_UPDATE_INTERVAL_MS = 200;