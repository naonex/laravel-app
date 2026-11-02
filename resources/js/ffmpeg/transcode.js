const { createFFmpeg, fetchFile } = FFmpeg;  // NOTE: FFmpegはbladeでminを読み込む形式なので、importではなくconstで取得する

let ffmpeg = null;

// 選択された動画ファイル
let selectedFiles = [];

// 処理状態
let isProcessing = false;

// ファイル選択・一覧要素
const uploader = document.getElementById('uploader');
const selectedFilesElement = document.getElementById('selectedFiles');
const startButton = document.getElementById('startCompression');

const mergeButton = document.getElementById('mergeVideos');

// CRFの表示値を更新
const crfInput = document.getElementById('crf');
const crfValue = document.getElementById('crfValue');
const presetInput = document.getElementById('preset');

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

const transcode = async () => {
    const files = selectedFiles;
    const compressedFiles = document.getElementById('compressedFiles');
    const progress = document.getElementById('progress');

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


    if (ffmpeg === null) {
    ffmpeg = createFFmpeg({
        log: true,
        progress: ({ ratio }) => {
        progress.innerHTML = `Complete: ${(ratio * 100.0).toFixed(2)}%`;
        }
    });
    }

    progress.innerHTML = 'Loading ffmpeg-core.js';

    if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
    }

    for (let i = 0; i < files.length; i++) {
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

    progress.innerHTML = 'All completed';
    // 圧縮後のファイル名で一覧を更新
    renderSelectedFiles();
}

startButton.addEventListener('click', transcode);


// 動画結合処理
const mergeVideos = async () => {
    // 2つ以上の圧縮済み動画が必要
    if (selectedFiles.length < 2) return;

    if (!selectedFiles.every(file => file.compressedName)) return;

    const progress = document.getElementById('progress');

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

        progress.innerHTML = 'All videos merged';
    } catch (error) {
        console.error(error);
        progress.innerHTML = 'Video merging failed';
    }
};
mergeButton.addEventListener('click', mergeVideos);


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
        name.textContent = `${index + 1}. ${
            file.compressedName ?? file.originalFile.name
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


// キャンセル処理
const cancel = () => {
    try {
        ffmpeg.exit();
    } catch(e) {}

    ffmpeg = null;
};

// キャンセルボタン
const cancelButton = document.getElementById('cancelCompression');
cancelButton.addEventListener('click', cancel);