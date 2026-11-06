// FFmpeg ... NOTE: FFmpegはbladeでminを読み込む形式なので、importではなくconstで取得する
const { createFFmpeg, fetchFile } = FFmpeg;

// FFmpegインスタンス
let ffmpeg = null;

// 進捗管理
let currentFileIndex = 0;
let totalFiles = 0;
let progressMode = null;

// 進捗通知用コールバック
let progressCallback = () => {};

// --------------------
// FFmpeg初期化
// --------------------
async function initializeFFmpeg() {

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

                progressCallback({ percent });
            }
        });
    }

    // FFmpeg読み込み
    if (!ffmpeg.isLoaded()) {
        progressCallback({ message: 'FFmpeg読み込み中' });
        await ffmpeg.load();
    }

    return ffmpeg;
}

// --------------------
// 動画圧縮
// --------------------
export async function transcodeVideos(
    files,
    { crf, preset, onProgress, onFileUpdate }
) {
    // コールバック設定
    progressCallback = onProgress;

    // 進捗初期化
    currentFileIndex = 0;
    totalFiles = files.length;
    progressMode = null;

    progressCallback({
        percent: 0,
        message: 'FFmpeg準備中'
    });

    const ffmpeg = await initializeFFmpeg();

    // 圧縮処理開始
    progressMode = 'transcode';

    for (let i = 0; i < files.length; i++) {

        // 現在処理中のファイル番号
        currentFileIndex = i;

        // 処理状態を更新
        files[i].status = 'processing';
        onFileUpdate();

        // ファイル名設定
        const file = files[i].originalFile;
        const { name } = file;

        const outputName =
            name.split('.').slice(0, -1).join('.') + '.ffmpeg.mp4';

        progressCallback({
            message: `${i + 1} / ${files.length} 圧縮中`
        });

        // FFmpeg実行
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
        progressCallback({
            percent: ((i + 1) / files.length) * 100
        });

        // 一覧更新を通知
        onFileUpdate();
    }

    progressMode = null;

    progressCallback({
        percent: 100,
        message: 'すべての圧縮が完了しました'
    });
}

// --------------------
// 動画結合
// --------------------
export async function mergeVideos(
    files,
    { onProgress }
) {
    progressCallback = onProgress;
    progressMode = 'merge';

    progressCallback({
        percent: 0,
        message: '結合中'
    });

    const ffmpeg = await initializeFFmpeg();

    try {
        // 結合ファイル名を生成
        const mergedFileName = `merged_${Date.now()}.mp4`;

        // 結合リストを作成
        // ファイル名に空白やシングルクォートが含まれていても扱えるようにする
        const concatList = files
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

        // 動画URL作成
        const videoUrl = URL.createObjectURL(
            new Blob([data.buffer], { type: 'video/mp4' })
        );

        return {
            videoUrl,
            mergedFileName,
            compressedSize: data.byteLength
        };

    } finally {
        progressMode = null;
    }
}

// --------------------
// キャンセル
// --------------------
export function cancelTranscode() {

    try {
        ffmpeg?.exit();
    } catch (e) { }

    ffmpeg = null;
    progressMode = null;
}
