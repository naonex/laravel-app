// (一覧内)ドラッグ中の動画インデックス
let draggedIndex = null;

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
// ファイルサイズ
// --------------------
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
// 結合結果の表示
// --------------------
export function renderMergedVideoResult(
    files,
    { videoUrl, mergedFileName, compressedSize },
    { mergedVideoResult, videoModal, previewVideo }
) {
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
    outputSize.textContent = formatFileSize(compressedSize);

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
}

// --------------------
// 一覧描写
// --------------------
// 選択動画一覧を描画
export function renderSelectedFiles(files, elements) {

    // DOM要素を取得
    const {
        selectedFilesElement,
        startButton,
        mergeButton,
        videoModal,
        previewVideo
    } = elements;

    // 一覧再描画用
    const render = () => renderSelectedFiles(files, elements);

    selectedFilesElement.innerHTML = '';

    files.forEach((file, index) => {
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
            const [movedFile] = files.splice(draggedIndex, 1);

            // 移動先の挿入位置を計算
            let targetIndex = index + (isAfter ? 1 : 0);

            // 移動元を取り除いたことによるインデックス調整
            if (draggedIndex < targetIndex) {
                targetIndex--;
            }

            // 移動先に挿入
            files.splice(targetIndex, 0, movedFile);

            draggedIndex = null;

            // 一覧を再描画
            render();
        });

        // 対象チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = file.included;
        checkbox.title = '処理対象にする';
        checkbox.className = 'w-4 h-4 cursor-pointer';

        checkbox.addEventListener('change', () => {
            file.included = checkbox.checked;
            render();

            startButton.disabled = !files.some(file => file.included);
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

            files.splice(index, 1);
            render();
            startButton.disabled = !files.some(file => file.included);
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
    mergeButton.disabled = files.filter(file =>
        file.included && file.status === 'completed'
    ).length < 2;
}

// --------------------
// ファイル選択・ドラッグ＆ドロップ
// --------------------
export function initializeDropArea({
    dropArea,
    uploader,
    dropMessageNormal,
    dropMessageActive
}) {
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