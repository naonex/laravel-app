import {
    transcodeVideos,
    mergeVideos as executeMergeVideos,
    cancelTranscode
} from './transcode.js';

import {
    updateProgressBar,
    renderMergedVideoResult,
    renderSelectedFiles as renderFileList,
    initializeDropArea,
    initializeVideoModal
} from './layout.js';


// CRFの表示値を更新
const crfInput = document.getElementById('crf');
const crfValue = document.getElementById('crfValue');
const presetInput = document.getElementById('preset');
// ボタン要素
const startButton = document.getElementById('startCompression');
const mergeButton = document.getElementById('mergeVideos');
const cancelButton = document.getElementById('cancelCompression');
// 進捗表示要素
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');

// ファイル選択・一覧要素
const uploader = document.getElementById('uploader');
const selectedFilesElement = document.getElementById('selectedFiles');
const mergedVideoResult = document.getElementById('mergedVideoResult');
// ドラッグ＆ドロップ領域
const dropArea = document.getElementById('dropArea');
const dropMessageNormal = document.getElementById('dropMessageNormal');
const dropMessageActive = document.getElementById('dropMessageActive');

// モーダル要素
const videoModal = document.getElementById("videoModal");
const previewVideo = document.getElementById("previewVideo");
const closeVideoModal = document.getElementById("closeVideoModal");

// 一覧描画で使用するDOM要素
const fileListElements = {
    selectedFilesElement,
    startButton,
    mergeButton,
    videoModal,
    previewVideo
};

// 選択された動画ファイル
let selectedFiles = [];


// --------------------
// イベント
// --------------------
// ドロップエリア初期化
initializeDropArea({
    dropArea,
    uploader,
    dropMessageNormal,
    dropMessageActive
});

// 動画プレビューモーダル初期化
initializeVideoModal({
    closeVideoModal,
    videoModal,
    previewVideo
});

// CRF値表示更新
crfInput.addEventListener('input', () => {
    crfValue.textContent = crfInput.value;
});


// --------------------
// ボタン操作
// --------------------
// 動画圧縮処理
const transcode = async () => {
    // 圧縮対象の動画を取得
    const files = selectedFiles.filter(file => file.included);

    // 対象がなければ終了
    if (files.length === 0) {
        progress.textContent = '圧縮対象の動画がありません';
        return;
    }

    // CRF値取得
    const crf = crfInput.value;

    // Preset
    const preset = presetInput.value;

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
            renderSelectedFiles();
        }
    });
};
startButton.addEventListener('click', transcode);

// 動画結合処理
const mergeVideos = async () => {
    // 結合対象の動画を取得
    const files = selectedFiles.filter(file =>
        file.included && file.status === 'completed'
    );

    // 2件以上必要
    if (files.length < 2) {
        progress.textContent = '結合対象の圧縮済み動画を2件以上選択してください';
        return;
    }

    try {
        // 動画結合を実行
        const result = await executeMergeVideos(files, {
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
            }
        });

        renderMergedVideoResult(
            files,
            result,
            {
                mergedVideoResult,
                videoModal,
                previewVideo
            }
        );

        updateProgressBar(
            100,
            progressBar,
            progressPercent
        );

        progress.textContent = 'すべての動画を結合しました';

    } catch (error) {
        console.error(error);

        progress.textContent = '動画の結合に失敗しました';
    }
};
mergeButton.addEventListener('click', mergeVideos);

// キャンセル処理
cancelButton.addEventListener('click', cancelTranscode);

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
            included: true
        });
    });

    // 同じファイルを再度選択できるようにリセット
    uploader.value = '';

    renderSelectedFiles();

    startButton.disabled = !selectedFiles.some(file => file.included);
});

// 選択動画一覧を描画
const renderSelectedFiles = () => {
    renderFileList(selectedFiles, fileListElements);
};