const { createFFmpeg, fetchFile } = FFmpeg;  // NOTE: FFmpegはbladeでminを読み込む形式なので、importではなくconstで取得する

let ffmpeg = null;

// 選択された動画ファイル
let selectedFiles = [];

// 処理状態
let isProcessing = false;

// ボタン要素
const startButton = document.getElementById('startCompression');
const mergeButton = document.getElementById('mergeVideos');
const cancelButton = document.getElementById('cancelCompression');

// CRFの表示値を更新
const crfInput = document.getElementById('crf');
const crfValue = document.getElementById('crfValue');
const presetInput = document.getElementById('preset');

// 進捗表示要素
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');

// 進捗管理
let currentFileIndex = 0;
let totalFiles = 0;
let progressMode = null;

// ファイル選択・一覧要素
const uploader = document.getElementById('uploader');
const selectedFilesElement = document.getElementById('selectedFiles');
// ドラッグ＆ドロップ領域
const dropArea = document.getElementById('dropArea');
const dropMessage = document.getElementById('dropMessage');
const dropMessageNormal = document.getElementById('dropMessageNormal');
const dropMessageActive = document.getElementById('dropMessageActive');

// (一覧内)ドラッグ中の動画インデックス
let draggedIndex = null;

// モーダル要素
const videoModal = document.getElementById("videoModal");
const previewVideo = document.getElementById("previewVideo");
const closeVideoModal = document.getElementById("closeVideoModal");

// --------------------
// イベント
// --------------------
// CRF値表示更新
crfInput.addEventListener('input', () => {
    crfValue.textContent = crfInput.value;
});

// モーダルを閉じる
closeVideoModal.addEventListener('click', () => {
    videoModal.classList.add('hidden');
    videoModal.classList.remove('flex');
    previewVideo.pause();
    previewVideo.src = '';
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
    // CRF（Constant Rate Factor）
    // 値が小さいほど高画質・低圧縮（ファイルサイズ大）
    // 値が大きいほど低画質・高圧縮（ファイルサイズ小）
    const crf = crfInput.value;

    // Preset
    // ultrafastに近いほど処理速度が速く、圧縮効率は低い
    // veryslowに近いほど処理速度が遅く、圧縮効率は高い
    // デフォルトはmedium
    const preset = presetInput.value;

    // 進捗初期化
    currentFileIndex = 0;
    totalFiles = files.length;
    progressMode = null;

    updateProgressBar(0);
    progress.textContent = 'FFmpeg準備中';

    if (ffmpeg === null) {
        ffmpeg = createFFmpeg({
            log: true,
            progress: ({ ratio }) => {

                // 有効な進捗率か確認
                if (!Number.isFinite(ratio)) {
                    return;
                }

                let percent = 0;

                if (progressMode === 'transcode') {
                    // 複数ファイル全体の進捗率
                    percent = (
                        (currentFileIndex + ratio) / totalFiles
                    ) * 100;

                } else if (progressMode === 'merge') {
                    // 動画結合の進捗率
                    percent = ratio * 100;
                }

                updateProgressBar(percent);
            }
        });
    }

    progress.textContent = 'FFmpeg読み込み中';

    if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
    }

    // 全体の圧縮処理を開始
    progressMode = 'transcode';

    for (let i = 0; i < files.length; i++) {

        // 現在処理中のファイル番号
        currentFileIndex = i;

        // 処理状態を更新
        files[i].status = 'processing';
        renderSelectedFiles();

        // ファイル名設定
        const file = files[i].originalFile;
        const { name } = file;

        const outputName =
            name.split('.').slice(0, -1).join('.') + '.ffmpeg.mp4';

        progress.textContent = `${i + 1} / ${files.length} 圧縮中`;

        // ffmpeg実行
        ffmpeg.FS('writeFile', name, await fetchFile(file));

        await ffmpeg.run(
            '-i', name,
            '-c:v', 'libx264',
            '-crf', crf,
            '-preset', preset,
            '-c:a', 'aac',
            '-b:a', '128k',
            outputName
        );

        // 圧縮結果を取得
        const data = ffmpeg.FS('readFile', outputName);

        // 動画URL作成
        const videoUrl = URL.createObjectURL(
            new Blob([data.buffer], { type: 'video/mp4' })
        );

        // 圧縮後のファイル情報を更新
        files[i].compressedName = outputName;
        files[i].videoUrl = videoUrl;
        files[i].compressedSize = data.byteLength;
        files[i].status = 'completed';

        // ファイル単位の進捗を確定
        updateProgressBar(
            ((i + 1) / files.length) * 100
        );

        // 一覧を更新
        renderSelectedFiles();
    }

    progressMode = null;

    updateProgressBar(100);

    progress.textContent = 'すべての圧縮が完了しました';

    // 圧縮後のファイル名で一覧を更新
    renderSelectedFiles();
}
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

    // 進捗初期化
    progressMode = 'merge';
    updateProgressBar(0);

    try {
        progress.textContent = '結合中';

        // 結合ファイル名を生成
        const mergedFileName = `merged_${Date.now()}.mp4`;
        
        // 結合リストを作成
        // ファイル名に空白やシングルクォートが含まれていても扱えるようにする
        const concatList = selectedFiles
            .map(file => {
                const escapedName = file.compressedName
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "'\\''");

                return `file '${escapedName}'`;
            })
            .join('\n');

        // FFmpegに結合対象のリストを渡す
        ffmpeg.FS(
            'writeFile',
            'input.txt',
            new TextEncoder().encode(concatList)
        );

        // 動画を結合
        await ffmpeg.run(
            '-f', 'concat',
            '-safe', '0',
            '-i', 'input.txt',
            '-c', 'copy',
            mergedFileName
        );

        // 結合結果を取得
        const data = ffmpeg.FS('readFile', mergedFileName);

        // ダウンロードURL作成
        const videoUrl = URL.createObjectURL(
            new Blob([data.buffer], { type: 'video/mp4' })
        );

        // ダウンロードリンク作成
        const downloadLink = document.createElement('a');
        downloadLink.href = videoUrl;
        downloadLink.download = mergedFileName;
        downloadLink.textContent = 'Download merged video';
        downloadLink.classList.add(
            'text-blue-600',
            'underline',
            'hover:text-blue-800'
        );

        // 結合結果を表示
        const mergedVideoResult = document.getElementById('mergedVideoResult');

        mergedVideoResult.innerHTML = '';

        // 一覧との区切り
        const separator = document.createElement('div');
        separator.className = 'border-t-2 border-gray-400 mt-4 pt-4';

        // 結果行
        const row = document.createElement('div');
        row.className = `
            grid
            grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_64px_40px]
            items-center
            gap-2
            border-b
            px-2
            py-2
            min-w-0
        `;

        // INエリア
        const inputArea = document.createElement('div');
        inputArea.className = 'flex items-center gap-2 min-w-0 w-full pl-2';

        const inputLabel = document.createElement('span');
        inputLabel.className = 'text-xs font-semibold text-blue-600 shrink-0';
        inputLabel.textContent = 'IN';

        // 結合元ファイル一覧
        const inputList = document.createElement('div');
        inputList.className = 'flex flex-col gap-1 min-w-0';

        files.forEach((file, index) => {
            // 1ファイル分の情報
            const inputInfo = document.createElement('div');
            inputInfo.className = 'flex items-center gap-2 min-w-0';

            const inputName = document.createElement('span');
            inputName.className = 'text-sm truncate min-w-0';
            inputName.textContent = file.compressedName;
            inputName.title = `${index + 1}. ${file.compressedName}`;

            const inputSize = document.createElement('span');
            inputSize.className = 'text-xs text-gray-500 shrink-0';
            inputSize.textContent = formatFileSize(file.compressedSize);

            inputInfo.append(inputName, inputSize);
            inputList.append(inputInfo);
        });

        inputArea.append(inputLabel, inputList);

        // OUTエリア
        const outputArea = document.createElement('div');
        outputArea.className = 'flex items-center gap-2 min-w-0 w-full border-l pl-2';

        const outputLabel = document.createElement('span');
        outputLabel.className = 'text-xs font-semibold text-green-600 shrink-0';
        outputLabel.textContent = 'OUT';

        const outputInfo = document.createElement('div');
        outputInfo.className = 'flex items-center gap-2 min-w-0 flex-1';

        const outputName = document.createElement('span');
        outputName.className = 'text-sm truncate min-w-0';
        outputName.textContent = mergedFileName;
        outputName.title = mergedFileName;

        const outputSize = document.createElement('span');
        outputSize.className = 'text-xs text-gray-500 shrink-0';
        outputSize.textContent = formatFileSize(data.byteLength);

        outputInfo.append(outputName, outputSize);
        outputArea.append(outputLabel, outputInfo);

        // ダウンロードボタン
        downloadLink.textContent = '↓';
        downloadLink.title = 'ダウンロード';
        downloadLink.className = `
            flex items-center justify-center
            w-7 h-7
            rounded
            text-gray-600
            hover:bg-blue-100
            hover:text-blue-600
            text-lg
        `;

        // プレビューボタン
        const previewButton = document.createElement('button');
        previewButton.textContent = '▶';
        previewButton.title = 'プレビュー';
        previewButton.className = `
            flex items-center justify-center
            w-7 h-7
            rounded
            text-gray-600
            hover:bg-blue-100
            hover:text-blue-600
            text-sm
        `;

        previewButton.addEventListener('click', () => {
            previewVideo.src = videoUrl;
            videoModal.classList.remove('hidden');
            videoModal.classList.add('flex');
            previewVideo.play();
        });

        // 出力エリアにボタンを配置
        outputArea.append(downloadLink, previewButton);

        // 空の列（一覧とのグリッド整合用）
        const emptyArea = document.createElement('div');
        const emptyArea2 = document.createElement('div');
        const emptyArea3 = document.createElement('div');

        // 行に配置
        row.append(
            emptyArea,  // 対象（40px）
            inputArea,  // IN（1fr）
            outputArea, // OUT（1fr）
            emptyArea2, // 入れ替え（64px）
            emptyArea3  // 削除（40px）
        );

        mergedVideoResult.append(separator, row);

        progressMode = null;
        updateProgressBar(100);

        progress.textContent = 'すべての動画を結合しました';

    } catch (error) {
        console.error(error);

        progressMode = null;
        progress.textContent = '動画の結合に失敗しました';
    }
};
mergeButton.addEventListener('click', mergeVideos);

// キャンセル処理
const cancel = () => {
    try {
        ffmpeg.exit();
    } catch (e) { }

    ffmpeg = null;
};
cancelButton.addEventListener('click', cancel);

// --------------------
// プログレスバー
// --------------------
// 進捗バー更新
const updateProgressBar = (percent) => {
    // 0～100の範囲に制限
    percent = Math.min(100, Math.max(0, percent));

    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.floor(percent)}%`;
};

// --------------------
// ファイル一覧操作
// --------------------
let isDropHovered = false;
let isDraggingFile = false;

// ドロップエリアの表示を更新
function updateDropAreaStyle() {
    // ドラッグ中
    if (isDraggingFile) {
        dropArea.classList.add(
            'border-blue-500',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );

        dropArea.classList.remove('border-gray-300', 'bg-blue-50');

        dropMessageNormal.classList.add('hidden');
        dropMessageActive.classList.remove('hidden');

        return;
    }

    // 通常ホバー
    if (isDropHovered) {
        // CSSのhover指定に任せる
        dropArea.classList.remove(
            'border-blue-400',
            'border-gray-300',
            'bg-blue-50',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );
    } else {
        // 通常状態
        dropArea.classList.remove(
            'border-blue-400',
            'border-blue-500',
            'bg-blue-50',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );

        dropArea.classList.add(
            'border-gray-300'
        );
    }

    dropMessageNormal.classList.remove('hidden');
    dropMessageActive.classList.add('hidden');
}

// マウスホバー
dropArea.addEventListener('mouseenter', () => {
    isDropHovered = true;
    updateDropAreaStyle();
});

dropArea.addEventListener('mouseleave', () => {
    isDropHovered = false;
    updateDropAreaStyle();
});

// ファイルのドラッグ
dropArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    isDraggingFile = true;
    updateDropAreaStyle();
});

dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    isDraggingFile = true;
    updateDropAreaStyle();
});

dropArea.addEventListener('dragleave', (e) => {
    if (dropArea.contains(e.relatedTarget)) return;

    isDraggingFile = false;
    updateDropAreaStyle();
});

// ファイルのドロップ
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();

    isDraggingFile = false;
    updateDropAreaStyle();

    const files = Array.from(e.dataTransfer.files)
        .filter(file => file.type.startsWith('video/'));

    if (!files.length) return;

    const dt = new DataTransfer();

    files.forEach(file => dt.items.add(file));

    uploader.files = dt.files;
    uploader.dispatchEvent(
        new Event('change', { bubbles: true })
    );
});

// クリックでファイル選択
dropArea.addEventListener('click', () => {
    uploader.click();
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
            included: true
        });
    });

    // 同じファイルを再度選択できるようにリセット
    uploader.value = '';

    renderSelectedFiles();

    startButton.disabled = !selectedFiles.some(file => file.included);
});

// --------------------
// 一覧描写
// --------------------
// 選択動画一覧を描画
function renderSelectedFiles() {
    selectedFilesElement.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        // 1動画分の行
        const row = document.createElement('div');
        row.draggable = true;
        row.className = `
            grid
            grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_64px_40px]
            items-center
            gap-2
            border-b
            px-2
            py-2
            min-w-0
            cursor-grab
            active:cursor-grabbing
            hover:bg-blue-50
        `;
        row.style.cursor = 'grab';

        // ドラッグ開始
        row.addEventListener('dragstart', (event) => {
            row.style.cursor = 'grabbing';
            // 移動元のインデックスを保持
            draggedIndex = index;

            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));

            row.classList.add('opacity-40');
        });

        // ドラッグ中
        row.addEventListener('dragover', (event) => {
            event.preventDefault();

            event.dataTransfer.dropEffect = 'move';

            // 移動元自身には挿入位置を表示しない
            if (draggedIndex === null || draggedIndex === index) {
                return;
            }

            const rect = row.getBoundingClientRect();
            const isAfter = event.clientY >= rect.top + rect.height / 2;

            // 既存の挿入位置表示を解除
            selectedFilesElement.querySelectorAll('.drag-over-top, .drag-over-bottom')
                .forEach(element => {
                    element.classList.remove('drag-over-top', 'drag-over-bottom');
                });

            // 挿入位置を表示
            row.classList.add(isAfter ? 'drag-over-bottom' : 'drag-over-top');
        });

        // ドラッグ終了
        row.addEventListener('dragend', () => {
            row.style.cursor = 'grab';
            draggedIndex = null;

            selectedFilesElement.querySelectorAll('.drag-over-top, .drag-over-bottom')
                .forEach(element => {
                    element.classList.remove('drag-over-top', 'drag-over-bottom');
                });

            row.classList.remove('opacity-40');
        });

        // ドロップ
        row.addEventListener('drop', (event) => {
            event.preventDefault();

            if (draggedIndex === null || draggedIndex === index) {
                return;
            }

            const rect = row.getBoundingClientRect();
            const isAfter = event.clientY >= rect.top + rect.height / 2;

            // 移動元を取り出す
            const [movedFile] = selectedFiles.splice(draggedIndex, 1);

            // 移動先の挿入位置を計算
            let targetIndex = index + (isAfter ? 1 : 0);

            // 移動元を取り除いたことによるインデックス調整
            if (draggedIndex < targetIndex) {
                targetIndex--;
            }

            // 移動先に挿入
            selectedFiles.splice(targetIndex, 0, movedFile);

            draggedIndex = null;

            // 一覧を再描画
            renderSelectedFiles();
        });

        // 対象チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = file.included;
        checkbox.title = '処理対象にする';
        checkbox.className = 'w-4 h-4 cursor-pointer';

        checkbox.addEventListener('change', () => {
            file.included = checkbox.checked;
            renderSelectedFiles();

            startButton.disabled = !selectedFiles.some(file => file.included);
        });

        // チェックボックス配置
        const checkboxArea = document.createElement('div');
        checkboxArea.className = 'flex items-center justify-center';
        checkboxArea.append(checkbox);

        // 入力動画
        const inputArea = document.createElement('div');
        inputArea.className = 'flex items-center gap-2 min-w-0 w-full border-l pl-2';

        const inputLabel = document.createElement('span');
        inputLabel.className = 'text-xs font-semibold text-blue-600 shrink-0';
        inputLabel.textContent = 'IN';

        const inputInfo = document.createElement('div');
        inputInfo.className = 'flex items-center gap-2 min-w-0 flex-1';

        const inputName = document.createElement('span');
        inputName.className = 'text-sm truncate min-w-0';
        inputName.textContent = file.originalFile.name;
        inputName.title = file.originalFile.name;

        const inputSize = document.createElement('span');
        inputSize.className = 'text-xs text-gray-500 shrink-0';
        inputSize.textContent = formatFileSize(file.originalFile.size);

        inputInfo.append(inputName, inputSize);
        inputArea.append(inputLabel, inputInfo);

        // 出力動画
        const outputArea = document.createElement('div');
        outputArea.className = 'flex items-center gap-2 min-w-0 w-full border-l pl-2';

        const outputLabel = document.createElement('span');
        outputLabel.className = 'text-xs font-semibold text-green-600 shrink-0';
        outputLabel.textContent = 'OUT';

        const outputInfo = document.createElement('div');
        outputInfo.className = 'flex items-center gap-2 min-w-0 flex-1';

        const outputName = document.createElement('span');
        outputName.className = 'text-sm truncate min-w-0';

        const outputSize = document.createElement('span');
        outputSize.className = 'text-xs text-gray-500 shrink-0';

        if (file.status === 'completed') {
            outputName.textContent = file.compressedName;
            outputName.title = file.compressedName;
            outputSize.textContent = formatFileSize(file.compressedSize);
        } else {
            const statusText = {
                pending: '未変換',
                processing: '圧縮中...',
                error: '圧縮失敗'
            };

            outputName.textContent = statusText[file.status] || '未変換';
            outputName.classList.add('text-gray-500');
        }

        outputInfo.append(outputName, outputSize);
        outputArea.append(outputLabel, outputInfo);

        // 出力操作
        if (file.status === 'completed') {
            const downloadLink = document.createElement('a');
            downloadLink.href = file.videoUrl;
            downloadLink.download = file.compressedName;
            downloadLink.textContent = '↓';
            downloadLink.title = 'ダウンロード';
            downloadLink.className = `
                flex items-center justify-center
                w-7 h-7
                rounded
                text-gray-600
                hover:bg-blue-100
                hover:text-blue-600
                text-lg
            `;

            const previewButton = document.createElement('button');
            previewButton.textContent = '▶';
            previewButton.title = 'プレビュー';
            previewButton.className = `
                flex items-center justify-center
                w-7 h-7
                rounded
                text-gray-600
                hover:bg-blue-100
                hover:text-blue-600
                text-sm
            `;

            previewButton.addEventListener('click', () => {
                previewVideo.src = file.videoUrl;
                videoModal.classList.remove('hidden');
                videoModal.classList.add('flex');
                previewVideo.play();
            });

            outputArea.append(downloadLink, previewButton);
        }

        // ドラッグ用の表示
        const moveControls = document.createElement('div');
        moveControls.className = 'flex items-center justify-center gap-1 pl-2';

        const dragHandle = document.createElement('span');
        dragHandle.textContent = '⠿';
        dragHandle.title = 'ドラッグして順序を変更';
        dragHandle.className = `
            text-xl
            text-gray-400
            cursor-grab
            select-none
            transition-colors
            group-hover:text-blue-600
        `;

        moveControls.append(dragHandle);

        // 削除ボタン
        const deleteArea = document.createElement('div');
        deleteArea.className = 'flex items-center justify-center border-l pl-2';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = '×';
        deleteButton.className = `
            flex items-center justify-center
            w-7 h-7
            rounded
            text-gray-500
            hover:bg-red-100
            hover:text-red-600
            text-xl
            leading-none
        `;
        deleteButton.title = '削除';
        deleteButton.addEventListener('click', () => {
            if (file.videoUrl) {
                URL.revokeObjectURL(file.videoUrl);
            }

            selectedFiles.splice(index, 1);
            renderSelectedFiles();
            startButton.disabled = !selectedFiles.some(file => file.included);
        });

        deleteArea.append(deleteButton);

        row.append(
            checkboxArea,
            inputArea,
            outputArea,
            moveControls,
            deleteArea
        );
        selectedFilesElement.append(row);
    });

    // チェック済みの圧縮済み動画が2件以上なら結合可能
    mergeButton.disabled = selectedFiles.filter(file =>
        file.included && file.status === 'completed'
    ).length < 2;
}

// ファイルサイズを読みやすい単位に変換
const formatFileSize = (size) => {
    if (size === null || size === undefined) {
        return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
};