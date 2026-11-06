// (一覧内)ドラッグ中の動画インデックス
let draggedIndex = null;


// --------------------
// 選択動画一覧の表示
// --------------------
export function renderSelectedFiles(
    files,
    elements,
    updateButtons,
    isProcessing = false
) {
    // DOM要素を取得
    const {
        selectedFilesElement,
        videoModal,
        previewVideo
    } = elements;

    // 一覧再描画用
    const render = () => renderSelectedFiles(files, elements, updateButtons, isProcessing);
    // ドラッグ＆ドロップ設定
    const setupRowDrag = setupDragAndDrop(files, selectedFilesElement, render, isProcessing);

    selectedFilesElement.innerHTML = '';

    files.forEach((file, index) => {
        // 1動画分の行
        const row = document.createElement('div');
        row.className = `
            group
            grid
            grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_64px_40px]
            items-center
            gap-2
            border-b
            px-2
            py-2
            min-w-0
            ${isProcessing ? 'cursor-not-allowed' : 'cursor-grab'}
            hover:bg-blue-50
            ${file.isProcessing ? 'bg-gray-100 opacity-60' : ''}
        `;
        // ドラッグ＆ドロップ設定
        setupRowDrag(row, index);

        // 対象チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = file.included;
        checkbox.disabled = isProcessing;
        checkbox.title = '処理対象にする';
        checkbox.className = `
            w-4 h-4
            ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}
        `;
        // チェック変更イベント
        checkbox.addEventListener('change', () => {
            file.included = checkbox.checked;
            updateButtons?.();
        });
        // チェックボックス配置
        const checkboxArea = document.createElement('div');
        checkboxArea.className = 'flex items-center justify-center';
        checkboxArea.append(checkbox);

        // 入力動画
        const inputArea = createInputArea([file]);

        // 出力動画
        const outputArea = createOutputArea({
            file,
            videoModal,
            previewVideo
        });

        // 並び変え（ドラッグ）可の記号表示
        const moveControls = document.createElement('div');
        moveControls.className = 'flex items-center justify-center gap-1 pl-2';
        const dragHandle = document.createElement('span');
        dragHandle.textContent = '⠿';
        dragHandle.title = 'ドラッグして順序を変更';
        dragHandle.className = `
            text-xl
            text-gray-400
            select-none
            transition-colors
            group-hover:text-blue-600
        `;
        moveControls.append(dragHandle);

        // 削除ボタン
        const deleteArea = createDeleteButton(() => {
            if (file.videoUrl) {
                URL.revokeObjectURL(file.videoUrl);
            }
            files.splice(index, 1);
            render();
            updateButtons?.();
        }, file.isProcessing);

        row.append(
            checkboxArea,
            inputArea,
            outputArea,
            moveControls,
            deleteArea
        );
        selectedFilesElement.append(row);
    });
}

// --------------------
// 結合結果の表示
// --------------------
export function renderMergedVideoResult(
    files, elements,
    { videoUrl, mergedFileName, compressedSize }
) {
    // DOM要素を取得
    const {
        mergedVideoResult,
        videoModal,
        previewVideo
    } = elements;

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
    const inputArea = createInputArea(files, true);

    // OUTエリア
    const outputArea = createOutputArea({
        videoUrl,
        fileName: mergedFileName,
        fileSize: compressedSize,
        videoModal,
        previewVideo
    });

    // 削除ボタン
    const deleteArea = createDeleteButton(() => {
        row.remove();
    });

    // 空の列（一覧とのグリッド整合用）
    const emptyArea = document.createElement('div');
    const emptyArea2 = document.createElement('div');

    // 行に配置
    row.append(
        emptyArea,   // 対象（40px）
        inputArea,   // IN（1fr）
        outputArea,  // OUT（1fr）
        emptyArea2,  // 入れ替え（64px）
        deleteArea // 削除（40px）
    );

    mergedVideoResult.append(row);
}

// --------------------
// ドラッグ＆ドロップ設定
// --------------------
export function setupDragAndDrop(files, container, render, disabled = false) {
    // ドラッグ中のインデックス
    let draggedIndex = null;

    // 挿入位置表示のTailwindクラス
    const dragOverClasses = [
        'border-t-[3px]',
        'border-b-[3px]',
        'border-t-blue-500',
        'border-b-blue-500'
    ];

    // 既存の挿入位置表示を解除
    const clearDragOver = () => {
        container.querySelectorAll('.drag-over-indicator')
            .forEach(element => {
                element.classList.remove(
                    'drag-over-indicator',
                    ...dragOverClasses
                );
            });
    };

    // 行ごとのイベント設定
    return (row, index) => {
        // 処理中はドラッグを無効化
        row.draggable = !disabled;
        if (disabled) return;

        // ドラッグ開始
        row.addEventListener('dragstart', (event) => {
            draggedIndex = index;

            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));

            row.classList.add('opacity-40');
        });

        // ドラッグ中
        row.addEventListener('dragover', (event) => {
            event.preventDefault();

            event.dataTransfer.dropEffect = 'move';

            if (draggedIndex === null || draggedIndex === index) {
                return;
            }

            const rect = row.getBoundingClientRect();
            const isAfter = event.clientY >= rect.top + rect.height / 2;

            clearDragOver();

            row.classList.add(
                'drag-over-indicator',
                isAfter ? 'border-b-[3px]' : 'border-t-[3px]',
                isAfter ? 'border-b-blue-500' : 'border-t-blue-500'
            );
        });

        // ドラッグ終了
        row.addEventListener('dragend', () => {
            draggedIndex = null;

            clearDragOver();

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

            const [movedFile] = files.splice(draggedIndex, 1);

            let targetIndex = index + (isAfter ? 1 : 0);

            if (draggedIndex < targetIndex) {
                targetIndex--;
            }

            files.splice(targetIndex, 0, movedFile);

            draggedIndex = null;

            render();
        });
    };
}

// --------------------
// 各パーツのレイアウト
// --------------------
/* INエリア生成 */
function createInputArea(files, useCompressed = false) {
    // INエリア
    const inputArea = document.createElement('div');
    inputArea.className = `flex items-center gap-2 min-w-0 w-full pl-2 ${
        useCompressed ? '' : 'border-l'
    }`;

    const inputLabel = document.createElement('span');
    inputLabel.className = 'text-xs font-semibold text-blue-600 shrink-0';
    inputLabel.textContent = 'IN';

    // ファイル情報一覧
    const inputList = document.createElement('div');
    inputList.className = 'flex flex-col gap-1 min-w-0 flex-1';

    files.forEach((file, index) => {
        // 1ファイル分の情報
        const inputInfo = document.createElement('div');
        inputInfo.className = 'flex items-center gap-2 min-w-0';

        const inputName = document.createElement('span');
        inputName.className = 'text-sm truncate min-w-0';

        const inputSize = document.createElement('span');
        inputSize.className = 'text-xs text-gray-500 shrink-0';

        // ファイル名とサイズ
        const fileName = useCompressed
            ? file.compressedName
            : file.originalFile.name;

        const fileSize = useCompressed
            ? file.compressedSize
            : file.originalFile.size;

        inputName.textContent = fileName;
        inputName.title = `${index + 1}. ${fileName}`;
        inputSize.textContent = formatFileSize(fileSize);

        inputInfo.append(inputName, inputSize);
        inputList.append(inputInfo);
    });

    inputArea.append(inputLabel, inputList);

    return inputArea;
}

/* OUTエリア生成 */
function createOutputArea({
    file = null,
    videoUrl = null,
    fileName = null,
    fileSize = null,
    status = 'completed',
    videoModal,
    previewVideo
}) {
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

    const outputSize = document.createElement('span');
    outputSize.className = 'text-xs text-gray-500 shrink-0';

    // ファイル情報を設定
    if (file) {
        status = file.status;

        fileName = file.compressedName;
        fileSize = file.compressedSize;
        videoUrl = file.videoUrl;
    }

    if (status === 'completed') {
        outputName.textContent = fileName;
        outputName.title = fileName;
        outputSize.textContent = formatFileSize(fileSize);

        // ダウンロードリンク
        const downloadLink = createDownloadLink(
            videoUrl,
            fileName
        );

        // プレビューボタン
        const previewButton = createPreviewButton(
            videoUrl,
            videoModal,
            previewVideo
        );

        outputArea.append(downloadLink, previewButton);
    } else {
        const statusText = {
            pending: '未変換',
            processing: '圧縮中...',
            error: '圧縮失敗'
        };

        outputName.textContent = statusText[status] || '未変換';
        outputName.classList.add('text-gray-500');
    }

    outputInfo.append(outputName, outputSize);
    outputArea.prepend(outputLabel, outputInfo);

    return outputArea;
}

// ダウンロードリンク
function createDownloadLink(videoUrl, fileName) {
    const downloadLink = document.createElement('a');

    downloadLink.href = videoUrl;
    downloadLink.download = fileName;
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

    return downloadLink;
}

// プレビューボタン
function createPreviewButton(videoUrl, videoModal, previewVideo) {
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

    return previewButton;
}

/* 削除ボタン */
function createDeleteButton(onDelete, disabled = false) {
    const deleteArea = document.createElement('div');
    deleteArea.className = 'flex items-center justify-center border-l pl-2';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '×';
    deleteButton.disabled = disabled;
    deleteButton.className = `
        flex items-center justify-center
        w-7 h-7
        rounded
        text-gray-500
        hover:bg-red-100
        hover:text-red-600
        text-xl
        leading-none
        ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
    `;
    deleteButton.title = '削除';

    deleteButton.addEventListener('click', onDelete);

    deleteArea.append(deleteButton);

    return deleteArea;
}

/* サブ関数 */
// ファイルサイズを読みやすい単位に変換
function formatFileSize(size) {
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
}

// --------------------
// ファイル選択・ドラッグ＆ドロップ
// --------------------
export function initializeDropArea({
    dropArea,
    uploader
}) {
    // ファイルのドラッグ
    dropArea.addEventListener('dragenter', (e) => {
        e.preventDefault();

        dropArea.classList.add(
            'border-blue-500',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );
    });

    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    // ドラッグ終了
    dropArea.addEventListener('dragleave', (e) => {
        if (dropArea.contains(e.relatedTarget)) return;

        dropArea.classList.remove(
            'border-blue-500',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );
    });

    // ファイルのドロップ
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();

        dropArea.classList.remove(
            'border-blue-500',
            'bg-blue-100',
            'ring-4',
            'ring-blue-200',
            'shadow-md'
        );

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
}

// --------------------
// プログレスバー
// --------------------
// 進捗バー更新
export function updateProgressBar(
    percent,
    progressBar,
    progressPercent
) {
    // 0～100の範囲に制限
    percent = Math.min(100, Math.max(0, percent));

    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.floor(percent)}%`;
}

// --------------------
// 動画プレビューモーダル
// --------------------
export function initializeVideoModal({
    closeVideoModal,
    videoModal,
    previewVideo
}) {
    // モーダルを閉じる
    closeVideoModal.addEventListener('click', () => {
        videoModal.classList.add('hidden');
        videoModal.classList.remove('flex');
        previewVideo.pause();
        previewVideo.src = '';
    });
}