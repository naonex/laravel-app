// FFmpeg ... NOTE: FFmpegはbladeでminを読み込む形式なので、importではなくconstで取得する
const { createFFmpeg, fetchFile } = FFmpeg;

// FFmpegインスタンス
let ffmpeg = null;

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
                // 有効な進捗率か確認 ... NOTE: 圧縮時は進捗率描写に対応してないみたいで、NaN表示になる対策として実装
                if (!Number.isFinite(ratio)) {
                    return;
                }

                progressCallback({
                    percent: Math.min(100, Math.max(0, ratio * 100))
                });
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
    const ffmpeg = await initializeFFmpeg();

    // 圧縮処理開始
    for (let i = 0; i < files.length; i++) {
        progressCallback({
            message: `${i + 1} / ${files.length} 圧縮中`
        });

        try {
            // 処理状態を更新
            files[i].status = 'processing';
            onFileUpdate();

            // ファイル名設定
            const file = files[i].originalFile;
            const { name } = file;
            const outputName = name.split('.').slice(0, -1).join('.') + '.ffmpeg.mp4';

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
            onFileUpdate();

        } catch (error) {
            // エラー状態に更新
            files[i].status = 'error';
            onFileUpdate();
            // 呼び出し元にエラーを伝播
            throw error;
        }
    }
}

// --------------------
// 動画結合
// --------------------
export async function mergeVideos(
    files,
    { onProgress, onResultUpdate }
) {
    // コールバック設定
    progressCallback = onProgress;
    const ffmpeg = await initializeFFmpeg();

    progressCallback({
        percent: 0,
        message: '結合中'
    });

    // 結合ファイル名を生成
    const mergedFileName = `merged_${Date.now()}.mp4`;

    // 結合対象ファイルをFFmpegに再登録 ... NOTE: FFmpegの仮想ファイルシステムが消失している可能性があるため（キャンセルが実行された場合など）
    for (const file of files) {
        const response = await fetch(file.videoUrl);
        const data = new Uint8Array(await response.arrayBuffer());

        ffmpeg.FS('writeFile', file.compressedName, data);
    }

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

    onResultUpdate({
        videoUrl,
        mergedFileName,
        compressedSize: data.byteLength
    });
}

// --------------------
// キャンセル
// --------------------
export function cancelTranscode() {
    try {
        ffmpeg?.exit();
    } catch (e) { }

    ffmpeg = null;
}
