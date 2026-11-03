import { DEM_SOURCES } from './terrainConfig.js';

// ----------------------------------------
// DEM取得処理
// ----------------------------------------
// 指定されたタイルを取得
export async function loadDemTile(x, y, z) {
    
    const maxTile = Math.pow(2, z);  // ズームレベル分の2のべき乗で、縦,横方向の最大タイル枚数を計算

    // X座標は地球を一周するため折り返す
    x = ((x % maxTile) + maxTile) % maxTile;
    // Y座標が範囲外の場合
    if (y < 0 || y >= maxTile) {
        return null;
    }

    // DEMデータを優先順位順に取得
    for (const source of DEM_SOURCES) {
        const url = `https://cyberjapandata.gsi.go.jp/xyz/${source}/${z}/${x}/${y}.png`;
        try {
            return await loadImage(url);
        } catch (error) {
            // 次のデータソースを試す
            continue;
        }
    }
    // 取得できなければnullを返却
    return null;
}

// 標高タイル取得
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

// RGBから標高を取得（DEM画像はRGB値に標高情報が格納される）
export function decodeElevation(r, g, b, a) {
    // 透明ピクセルは除外（画素が無効と判断する）
    if (a === 0) {
        return null;
    }

    // RGBの3つの値を1つの24bit整数にまとめる
    const x = (r << 16) + (g << 8) + b;

    // 標高データなし（国土地理院のDEM画像の仕様）
    if (x === 8388608) {
        return null;
    }

    // RGB値から標高を復元
    if (x < 8388608) {
        return x * 0.01;  // 正の標高の場合（0~8388607 正の標高）
    }
    return (x - 16777216) * 0.01;  // 負の標高の場合（8388609~16777215 負の標高）
}