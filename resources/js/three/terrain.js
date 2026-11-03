// ----------------------------------------
// 定数
// ----------------------------------------
import {
    DEM_ZOOM,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
} from './terrainConfig.js';
export { TERRAIN_SIZE, DEM_ZOOM };

// ----------------------------------------
// 変数
// ----------------------------------------
import { terrainState } from './terrainState.js';


// ----------------------------------------
// 関数処理
// ----------------------------------------
// レンダリング処理
import {
    initTerrain,
    updateTerrainRoute,
    updateTerrainCamera,
    createTerrainMarker,
    renderTerrainMesh
} from './terrainRenderer.js';
export { initTerrain };

// DEM取得処理
import {
    loadDemTile,
    decodeElevation
} from './terrainData.js';

// ルートアニメーション
import {
    startTerrainRouteAnimation,
    stopTerrainRouteAnimation
} from './terrainAnimation.js';
export {
    startTerrainRouteAnimation,
    stopTerrainRouteAnimation
};

// 3D地形生成
export async function createTerrain(
    latitude,
    longitude,
    centerPixel,
    startPixel,
    goalPixel,
    options = {}
) {
    // オプションのデフォルト値を設定（未定義の場合はデフォルト値を使用）
    const {
        preserveCamera = false,
        showStatus = true,
        onAreaUpdate = null
    } = options;

    console.log('地形生成開始');
    console.log('緯度:', latitude);
    console.log('経度:', longitude);

    // 地形取得リクエストを識別
    const requestId = ++terrainState.terrainRequestId;

    // カメラの現在位置と注視点の相対位置を保持
    const cameraOffset = terrainState.camera.position.clone().sub(terrainState.controls.target);

    if (showStatus) {
        terrainState.status.textContent = '標高データを取得しています...';
    }

    try {
        // 地形のタイル情報を取得
        const {
            tileX,
            tileY,
            metersPerPixel
        } = getTerrainTileInfo(centerPixel, latitude);

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
        if (requestId !== terrainState.terrainRequestId) {
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

        // 3D地形の頂点データ ... 標高データをサンプリング
        const elevations = sampleTerrainElevations(
            pixels,
            mosaic,
            centerPixel,
            tileX,
            tileY,
            metersPerPixel
        );

        // 標高の最小値・最大値を取得
        let { minElevation, maxElevation } =
            getElevationRange(elevations);

        // 標高データが1件も取得できなかった場合
        if (!Number.isFinite(minElevation)) {
            if (showStatus) {
                terrainState.status.textContent =
                    '標高データが取得できませんでした。';
            }
            // 仮の標高を設定
            minElevation = 0;
            maxElevation = 0;
        } else if (showStatus) {
            terrainState.status.textContent =
                `標高範囲：${minElevation.toFixed(1)}m ～ ${maxElevation.toFixed(1)}m`;
        }

        // 3D地形メッシュを生成
        renderTerrainMesh(
            elevations,
            minElevation,
            maxElevation
        );

        // クリック地点のマーカーを生成
        createTerrainMarker(
            elevations,
            minElevation
        );

        // 現在地・選択地点が設定されていれば、3D地形上にルートを描画
        if (startPixel && goalPixel) {
            updateTerrainRoute(
                centerPixel,
                startPixel,
                goalPixel,
                metersPerPixel
            );
        }

        // カメラ位置を更新
        updateTerrainCamera(
            minElevation,
            maxElevation,
            cameraOffset,
            preserveCamera
        );

        // 地形表示範囲を地図上に表示
        if (typeof onAreaUpdate === 'function') {
            onAreaUpdate(centerPixel, metersPerPixel);
        }

        return true;

    } catch (error) {
        console.error('地形生成エラー:', error);
        if (showStatus) {
            terrainState.status.textContent =
                '地形を取得できませんでした。別の地点を試してください。';
        }
        return false;
    }
}

// 地形のタイル情報を取得
function getTerrainTileInfo(centerPixel, latitude) {
    // タイル番号を取得
    const tileX = Math.floor(centerPixel.x / 256);
    const tileY = Math.floor(centerPixel.y / 256);

    // 地図の1ピクセルあたりの実距離（Webメルカトル図法（EPSG:3857）で計算する公式）
    const metersPerPixel =  // 地球の赤道周長 * 緯度による縮尺補正 / 全世界地図の横方向のピクセル数
        40075016.686 *                       
        Math.cos(latitude * Math.PI / 180) /
        (256 * Math.pow(2, DEM_ZOOM));  // 1タイル(256×256ピクセル)

    return {
        tileX,
        tileY,
        metersPerPixel
    };
}

// 標高データをサンプリング
function sampleTerrainElevations(
    pixels,
    mosaic,
    centerPixel,
    tileX,
    tileY,
    metersPerPixel
) {
    const elevations = [];

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
                centerPixel.x + localX / metersPerPixel -
                (tileX - 1) * 256
            );

            const pixelY = Math.round(
                centerPixel.y - localY / metersPerPixel -
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
        }
    }

    return elevations;
}

// 標高の最小値・最大値を取得
function getElevationRange(elevations) {
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    elevations.forEach((elevation) => {
        if (elevation !== null) {
            minElevation = Math.min(minElevation, elevation);
            maxElevation = Math.max(maxElevation, elevation);
        }
    });

    return {
        minElevation,
        maxElevation
    };
}
