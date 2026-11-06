import {
    transcodeVideos,
    mergeVideos as executeMergeVideos,
    cancelTranscode
} from './transcode.js';

import {
    updateProgressBar,
    renderMergedVideoResult,
    renderSelectedFiles,
    initializeDropArea,
    initializeVideoModal
} from './layout.js';

// 圧縮設定
const crfInput = document.getElementById('crf');
const crfValue = document.getElementById('crfValue');
const presetInput = document.getElementById('preset');
// ボタン
const startButton = document.getElementById('startCompression');
const mergeButton = document.getElementById('mergeVideos');
const cancelButton = document.getElementById('cancelCompression');
// 進捗表示
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');

// ファイル選択
const dropArea = document.getElementById('dropArea');
const uploader = document.getElementById('uploader');
// 動画一覧
const selectedFilesElement = document.getElementById('selectedFiles');
const separator = document.getElementById('separator');
const mergedVideoResult = document.getElementById('mergedVideoResult');

// モーダル
const videoModal = document.getElementById("videoModal");
const previewVideo = document.getElementById("previewVideo");
const closeVideoModal = document.getElementById("closeVideoModal");

// 一覧描画で使用するDOM要素
const fileListElements = {
    selectedFilesElement,
    mergedVideoResult,
    videoModal,
    previewVideo
};

// 選択された動画ファイル
let selectedFiles = [];

// 処理状態
let isTranscoding = false;
let isMerging = false;


// --------------------
// 初期化
// --------------------
// ドロップエリア初期化
initializeDropArea({
    dropArea,
    uploader
});

// 動画プレビューモーダル初期化
initializeVideoModal({
    closeVideoModal,
    videoModal,
    previewVideo
});

// --------------------
// イベント
// --------------------
// CRFレンジの設定値表示更新
crfInput.addEventListener('input', () => {
    crfValue.textContent = crfInput.value;
});

// 動画ファイル追加
uploader.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);

    files.forEach(file => {
        // 同じファイルが登録済みなら追加しない
        const exists = selectedFiles.some(item =>
            item.originalFile.name === file.name &&
            item.originalFile.size === file.size &&
            item.originalFile.lastModified === file.lastModified
        );

        if (exists) return;

        selectedFiles.push({
            originalFile: file,
            compressedName: null,
            videoUrl: null,
            compressedSize: null,
            status: 'pending',
            included: !(isTranscoding || isMerging),
            isProcessing: false
        });
    });

    // 同じファイルを再度選択できるようにリセット
    uploader.value = '';

    renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);
    updateActionButtons();
});

// 動画圧縮ボタン
const transcode = async () => {
    // 処理中なら終了
    if (isTranscoding || isMerging) return;

    // 圧縮対象の動画を取得
    const files = selectedFiles.filter(file => file.included);
    // 対象がなければ終了
    if (files.length === 0) {
        progress.textContent = '圧縮対象の動画がありません';
        return;
    }

    // 圧縮設定値取得
    const crf = crfInput.value;
    const preset = presetInput.value;

    // 処理開始
    isTranscoding = true;
    updateActionButtons();
    try {
        // 処理対象を処理中にする
        files.forEach(file => {
            file.isProcessing = true;
        });
        renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);

        await transcodeVideos(files, {
            crf,
            preset,
            // 進捗更新
            onProgress: ({ percent, message }) => {
                if (percent !== undefined) {
                    updateProgressBar(
                        percent,
                        progressBar,
                        progressPercent
                    );
                }
                if (message) {
                    progress.textContent = message;
                }
            },
            // 一覧更新
            onFileUpdate: () => {
                renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);
                updateActionButtons();
            }
        });

        updateProgressBar(
            100,
            progressBar,
            progressPercent
        );
        progress.textContent = '対象の圧縮が完了しました';

    } catch (error) {
        console.error(error);
        progress.textContent = '動画の圧縮に失敗しました';

    } finally {
        // 処理終了
        isTranscoding = false;
        updateActionButtons();

        // 処理中フラグを解除
        files.forEach(file => {
            file.isProcessing = false;
        });
        renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);
    }
};
startButton.addEventListener('click', transcode);

// 動画結合ボタン
const mergeVideos = async () => {
    // 処理中なら終了
    if (isTranscoding || isMerging) return;

    // 結合対象の動画を取得
    const files = selectedFiles.filter(file =>
        file.included && file.status === 'completed'
    );
    // 2件以上必要
    if (files.length < 2) {
        progress.textContent = '結合対象の圧縮済み動画を2件以上選択してください';
        return;
    }

    // 処理開始
    isMerging = true;
    updateActionButtons();
    try {
        // 処理対象を処理中にする
        files.forEach(file => {
            file.isProcessing = true;
        });
        renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);

        // 動画結合を実行
        await executeMergeVideos(files, {
            // 進捗更新
            onProgress: ({ percent, message }) => {
                if (percent !== undefined) {
                    updateProgressBar(
                        percent,
                        progressBar,
                        progressPercent
                    );
                }
                if (message) {
                    progress.textContent = message;
                }
            },
            // 結果更新
            onResultUpdate: (result) => {
                separator.hidden = false;
                renderMergedVideoResult(files, fileListElements, result);
            }
        });

        updateProgressBar(
            100,
            progressBar,
            progressPercent
        );
        progress.textContent = '対象の動画を結合しました';

    } catch (error) {
        console.error(error);
        progress.textContent = '動画の結合に失敗しました';

    } finally {
        // 処理終了
        isMerging = false;
        updateActionButtons();

        // 処理中フラグを解除
        files.forEach(file => {
            file.isProcessing = false;
        });
        renderSelectedFiles(selectedFiles, fileListElements, updateActionButtons, isTranscoding || isMerging);
    }
};
mergeButton.addEventListener('click', mergeVideos);

// キャンセルボタン
cancelButton.addEventListener('click', cancelTranscode);

// 操作ボタン状態更新
function updateActionButtons() {
    const isProcessing = isTranscoding || isMerging;

    // 圧縮設定
    crfInput.disabled = isProcessing;
    presetInput.disabled = isProcessing;

    // 圧縮ボタン
    startButton.disabled = isProcessing ||
        !selectedFiles.some(file => file.included);

    // 結合ボタン
    mergeButton.disabled = isProcessing ||
        selectedFiles.filter(file =>
            file.included && file.status === 'completed'
        ).length < 2;
}