import { TERRAIN_UPDATE_INTERVAL_MS } from './terrainConfig.js';
import { terrainState } from './terrainState.js';

import { createTerrain } from './terrain.js';

/* ルートアニメーション */

// ----------------------------------------
// メイン処理
// ----------------------------------------
// ルートアニメーション開始
export function startTerrainRouteAnimation(
    startPoint,
    goalPoint,
    mapCallbacks
) {
    // アニメーション中なら何もしない
    if (terrainState.isRouteAnimating) {
        return;
    }
    
    // 必要なデータが揃っていなければ何もしない
    if (!startPoint || !goalPoint) {
        console.warn('出発地点または目的地が設定されていません。');
        return;
    }
    // 出発地点と目的地を保持
    terrainState.terrainAnimationPath = [
        {
            latitude: startPoint.latitude,
            longitude: startPoint.longitude
        },
        {
            latitude: goalPoint.latitude,
            longitude: goalPoint.longitude
        }
    ];

    // 2地点間の距離を計算
    terrainState.terrainAnimationDistance = getRouteDistance(startPoint, goalPoint);

    // 移動方式を取得
    const animationMode = document.getElementById('terrainAnimationMode').value;
    // 移動時間を計算
    if (animationMode === 'speed') {
        // 指定速度から移動時間を計算
        const speed = Number(
            document.getElementById('terrainAnimationSpeed').value
        );
        terrainState.terrainAnimationDuration = terrainState.terrainAnimationDistance / speed;
    } else {  // 'duration'
        // 指定時間をそのまま使用
        terrainState.terrainAnimationDuration = Number(
            document.getElementById('terrainAnimationDurationInput').value
        );
    }

    // アニメーションを初期化
    terrainState.terrainAnimationElapsed = 0;  // 経過時間
    terrainState.terrainAnimationLastUpdateTime = 0;  // 最終更新時刻
    terrainState.terrainAnimationLastUpdateDistance = 0;  // 最後に地形を更新した距離
    terrainState.isTerrainUpdating = false;  // DEM取得中フラグ

    // 地図側のコールバックを保持
    terrainState.mapCallbacks = mapCallbacks;

    // アニメーション開始
    terrainState.isRouteAnimating = true;
    // 地図側の開始処理
    terrainState.mapCallbacks?.onStart?.();

    // アニメーションループを開始
    if (terrainState.animationFrameId === null) {
        terrainState.previousAnimationTime = 0;
        animateTerrain();
    }
}

// 地形移動アニメーションを停止
export function stopTerrainRouteAnimation() {

    // アニメーションを停止
    terrainState.isRouteAnimating = false;

    // DEM取得リクエストを無効化
    terrainState.terrainRequestId++;

    // DEM取得中フラグを解除
    terrainState.isTerrainUpdating = false;

    // アニメーションループを停止
    if (terrainState.animationFrameId !== null) {
        cancelAnimationFrame(terrainState.animationFrameId);
        terrainState.animationFrameId = null;
    }

    // 地図側の停止処理
    terrainState.mapCallbacks?.onStop?.();

    // コールバックを初期化
    terrainState.mapCallbacks = null;
}

// アニメーションループ
function animateTerrain() {

    // アニメーションが終了していればループを終了
    if (!terrainState.isRouteAnimating) {
        terrainState.animationFrameId = null;
        return;
    }

    // 次のフレームを予約
    terrainState.animationFrameId = requestAnimationFrame(animateTerrain);

    // 現在時刻を取得
    const currentTime = performance.now();

    // 前回からの経過時間（秒）
    const deltaTime = terrainState.previousAnimationTime === 0
        ? 0
        : (currentTime - terrainState.previousAnimationTime) / 1000;
    // 経過時間に応じて進行度を更新
    terrainState.terrainAnimationElapsed += deltaTime;
    const progress = Math.min(
        terrainState.terrainAnimationElapsed / terrainState.terrainAnimationDuration,
        1
    );
    terrainState.previousAnimationTime = currentTime;  // 前回時刻更新

    // ルート上の現在位置を計算
    const currentPosition = terrainState.mapCallbacks.getRoutePosition(progress);

    // 現在の移動距離
    const currentDistance = terrainState.terrainAnimationDistance * progress;

    // 一定時間ごとに地形を更新
    if (
        !terrainState.isTerrainUpdating &&
        (
            currentTime - terrainState.terrainAnimationLastUpdateTime >= TERRAIN_UPDATE_INTERVAL_MS ||
            progress >= 1
        )
    ) {
        // DEM取得中フラグ
        terrainState.isTerrainUpdating = true;
        // 更新開始時刻を保持
        terrainState.terrainAnimationLastUpdateTime = currentTime;

        // 地図側のコールバックでピクセル座標を取得
        const centerPixel = terrainState.mapCallbacks.convertToPixel(currentPosition);
        // 地図側のコールバックでルートのピクセル座標を取得
        const startPixel = terrainState.mapCallbacks.convertToPixel(
            terrainState.terrainAnimationPath[0]
        );
        const goalPixel = terrainState.mapCallbacks.convertToPixel(
            terrainState.terrainAnimationPath[1]
        );

        // 地形を生成
        createTerrain(
            currentPosition.latitude,
            currentPosition.longitude,
            centerPixel,
            startPixel,
            goalPixel,
            {
                preserveCamera: true,
                showStatus: false,
                onAreaUpdate: terrainState.mapCallbacks?.onAreaUpdate  // 地図上の矩形更新(callback)
            }
        ).then((success) => {
            if (success) {
                // 地図上の現在地点マーカーを更新(callback)
                terrainState.mapCallbacks?.onUpdateMarker?.(currentPosition);

                // 最後に更新した距離を保持
                terrainState.terrainAnimationLastUpdateDistance = currentDistance;

            } else {
                console.warn('移動中の地形更新に失敗しました。');
            }

            // DEM取得終了
            terrainState.isTerrainUpdating = false;

            // 目的地まで到着し、最後の地形更新も完了した
            if (
                terrainState.terrainAnimationElapsed >= terrainState.terrainAnimationDuration &&
                terrainState.terrainAnimationLastUpdateDistance >= terrainState.terrainAnimationDistance
            ) {
                // アニメーション終了
                stopTerrainRouteAnimation();
            }
        });
    }
}

// ----------------------------------------
// サブ処理
// ----------------------------------------
// ルート上の距離計算
function getRouteDistance(startPoint, goalPoint) {

    // 地球の半径（メートル）
    const earthRadius = 6371000;

    // 緯度・経度をラジアンに変換
    const startLatitude =
        startPoint.latitude * Math.PI / 180;

    const goalLatitude =
        goalPoint.latitude * Math.PI / 180;

    const latitudeDifference =
        (goalPoint.latitude - startPoint.latitude) * Math.PI / 180;

    const longitudeDifference =
        (goalPoint.longitude - startPoint.longitude) * Math.PI / 180;

    // Haversine公式で距離を計算
    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(startLatitude) *
        Math.cos(goalLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return earthRadius * c;
}
