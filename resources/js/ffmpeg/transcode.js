const { createFFmpeg, fetchFile } = FFmpeg;  // NOTE: FFmpegはbladeでminを読み込む形式なので、importではなくconstで取得する

let ffmpeg = null;

// 選択された動画ファイル
let selectedFiles = [];

// 処理状態
let isProcessing = false;

// ファイル選択・一覧要素
const uploader = document.getElementById('uploader');
const selectedFilesElement = document.getElementById('selectedFiles');
// ドラッグ＆ドロップ領域
const dropArea = document.getElementById('dropArea');

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

// モーダル要素取得
const videoModal = document.getElementById("videoModal");
const previewVideo = document.getElementById("previewVideo");
const closeVideoModal = document.getElementById("closeVideoModal");

// モーダルを閉じる
closeVideoModal.addEventListener("click", () => {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();

    videoModal.classList.add("hidden");
    videoModal.classList.remove("flex");
});

// CRF値表示更新
crfInput.addEventListener('input', () => {
    crfValue.textContent = crfInput.value;
});


// 動画圧縮処理
const transcode = async () => {
    const files = selectedFiles;
    const compressedFiles = document.getElementById('compressedFiles');

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

        // 圧縮ファイルのDOM作成
        let compressedFile = document.createElement("div");
        compressedFile.classList.add(
            "compressedFile",
            "flex",
            "flex-row",
            "items-center",
            "gap-4",
            "my-2"
        );
        compressedFiles.append(compressedFile);

        // メッセージフィールド作成
        let message = document.createElement("p");
        message.classList.add("m-0", "break-words");
        compressedFile.append(message);

        // ファイル名設定
        const file = files[i].originalFile;
        const { name } = file;
        let outputName = name.split('.').slice(0, -1).join('.') + '.ffmpeg.mp4'

        message.innerHTML = name + ' Start transcoding';

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

        // ファイル単位の進捗を確定
        updateProgressBar(
            ((i + 1) / files.length) * 100
        );

        let data = ffmpeg.FS('readFile', outputName);

        // 動画URL作成
        let videoUrl = URL.createObjectURL(
            new Blob([data.buffer], { type: 'video/mp4' })
        );
        // 圧縮後のファイル情報を保存
        files[i].compressedName = outputName;
        files[i].videoUrl = videoUrl;

        // ダウンロードURL作成
        let downloadUrl = document.createElement("a");
        downloadUrl.href = videoUrl;
        downloadUrl.download = outputName;  // ダウンロードデフォファイル名
        downloadUrl.textContent = outputName;
        downloadUrl.classList.add("text-blue-600", "underline", "hover:text-blue-800");
        compressedFile.append(downloadUrl);

        // 動画再生ボタン作成
        let previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.textContent = "▶";
        previewButton.classList.add(
            "text-2xl",
            "p-2",
            "text-blue-600",
            "hover:text-blue-800"
        );
        compressedFile.append(previewButton);

        // 動画再生ボタン
        previewButton.addEventListener("click", () => {
            previewVideo.src = videoUrl;
            videoModal.classList.remove("hidden");
            videoModal.classList.add("flex");
            previewVideo.play();
        });

        message.innerHTML = name + ' Complete transcoding';
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
    // 2つ以上の圧縮済み動画が必要
    if (selectedFiles.length < 2) return;

    if (!selectedFiles.every(file => file.compressedName)) return;

    // 進捗初期化
    progressMode = 'merge';
    updateProgressBar(0);

    try {
        progress.innerHTML = 'Preparing videos for merging';

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
            'merged.mp4'
        );

        // 結合結果を取得
        const data = ffmpeg.FS('readFile', 'merged.mp4');

        // ダウンロードURL作成
        const videoUrl = URL.createObjectURL(
            new Blob([data.buffer], { type: 'video/mp4' })
        );

        // ダウンロードリンク作成
        const downloadLink = document.createElement('a');
        downloadLink.href = videoUrl;
        downloadLink.download = 'merged.mp4';
        downloadLink.textContent = 'Download merged video';
        downloadLink.classList.add(
            'text-blue-600',
            'underline',
            'hover:text-blue-800'
        );

        document.getElementById('compressedFiles').append(downloadLink);

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


// ファイル選択時に一覧を更新
uploader.addEventListener('change', (event) => {
    selectedFiles = Array.from(event.target.files).map(file => ({
        originalFile: file,
        compressedName: null,
        videoUrl: null
    }));

    renderSelectedFiles();

    // ファイルが選択されている場合のみ開始可能
    startButton.disabled = selectedFiles.length === 0;
});

// 選択ファイル一覧を表示
const renderSelectedFiles = () => {
    selectedFilesElement.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.classList.add(
            'flex',
            'flex-row',
            'items-center',
            'gap-2',
            'my-2'
        );

        // ファイル名
        const name = document.createElement('span');
        name.textContent = `${index + 1}. ${file.compressedName ?? file.originalFile.name
            }`;
        name.classList.add('flex-1', 'break-all');

        // 上へ移動
        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.textContent = '↑';
        upButton.disabled = index === 0;
        upButton.addEventListener('click', () => {
            [selectedFiles[index - 1], selectedFiles[index]] =
                [selectedFiles[index], selectedFiles[index - 1]];

            renderSelectedFiles();
        });

        // 下へ移動
        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.textContent = '↓';
        downButton.disabled = index === selectedFiles.length - 1;
        downButton.addEventListener('click', () => {
            [selectedFiles[index], selectedFiles[index + 1]] =
                [selectedFiles[index + 1], selectedFiles[index]];

            renderSelectedFiles();
        });

        item.append(name, upButton, downButton);
        selectedFilesElement.append(item);
    });

    // すべての動画が圧縮済みなら結合可能
    mergeButton.disabled = !selectedFiles.every(file => file.compressedName);
};

// ドラッグ中
dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();

    dropArea.classList.add('border-blue-500', 'bg-blue-50');
});

// ドラッグ領域から離れたとき
dropArea.addEventListener('dragleave', (event) => {
    if (dropArea.contains(event.relatedTarget)) {
        return;
    }

    dropArea.classList.remove('border-blue-500', 'bg-blue-50');
});

// ファイルをドロップしたとき
dropArea.addEventListener('drop', (event) => {
    event.preventDefault();

    dropArea.classList.remove('border-blue-500', 'bg-blue-50');

    // ファイルを取得
    const files = Array.from(event.dataTransfer.files)
        .filter(file => file.type.startsWith('video/'));

    if (files.length === 0) {
        return;
    }

    // ファイル選択欄に設定
    const dataTransfer = new DataTransfer();

    files.forEach(file => {
        dataTransfer.items.add(file);
    });

    uploader.files = dataTransfer.files;

    // 既存のファイル選択イベントを実行
    uploader.dispatchEvent(new Event('change', {
        bubbles: true
    }));
});


// 進捗バー更新
const updateProgressBar = (percent) => {
    // 0～100の範囲に制限
    percent = Math.min(100, Math.max(0, percent));

    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.floor(percent)}%`;
};