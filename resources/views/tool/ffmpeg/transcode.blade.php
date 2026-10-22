<html>
  <head>
    <!--<script src="/dist/ffmpeg.dev.js"></script>-->
    <!--
      ※headerの影響でCDN使用不可
      <script src="//cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js"></script>
    -->
    <script src="{{ asset('assets/js/tool/ffmpeg/0.11.6/ffmpeg.min.js') }}"></script>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%
      }
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      #compressedFiles {
        margin-top: 1em;
      } 
      .compressedFile {
        display: grid; /* グリッドレイアウト */
        grid-template-columns: 1fr 1fr;
        column-gap: 1em;
        align-items: center;
      }
      .compressedFile p {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <h3>Upload a video to transcode to mp4 (x264) and play!</h3>
    <!--<video id="output-video" controls></video><br/>--><!-- 画面上で動画再生できなくて良いので無効化 -->
    <input type="file" id="uploader" multiple><!-- 複数ファイル選択可能とする -->
    <button onClick="cancel()">Cancel</button>
    <div id="compressedFiles"></div>
    <p id="progress"></p>
    <script>
      const { createFFmpeg, fetchFile } = FFmpeg;
      let ffmpeg = null;

      const transcode = async ({ target: { files } }) => {
        const compressedFiles = document.getElementById('compressedFiles');
        const progress = document.getElementById('progress');
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
          compressedFile.classList.add("compressedFile")
          compressedFiles.append(compressedFile);
          // メッセージフィールド作成
          let message = document.createElement("p");
          compressedFile.append(message);
          // ファイル名設定
          let { name } = files[i];
          let outputName = name.split('.').slice(0, -1).join('.') + '.ffmpeg.mp4'
          
          message.innerHTML = name + ' Start transcoding';
          // ffmpeg実行
          ffmpeg.FS('writeFile', name, await fetchFile(files[i]));
          await ffmpeg.run('-i', name, outputName);  // runでffmpegコマンドを実行する。公式サイトなどでオプション確認して使用できるはず
          let data = ffmpeg.FS('readFile', outputName);
          
          // 画面上で動画再生できなくて良いので無効化
          //const video = document.getElementById('output-video');
          //video.src = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
          
          // ダウンロードURL作成
          let downloadUrl = document.createElement("a");
          downloadUrl.href = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
          downloadUrl.download = outputName;  // ダウンロードデフォファイル名
          downloadUrl.textContent = outputName;
          compressedFile.append(downloadUrl);

          message.innerHTML = name + ' Complete transcoding';
        }
        progress.innerHTML = 'All completed';
      }
      const elm = document.getElementById('uploader');
      elm.addEventListener('change', transcode);

      const cancel = () => {
        try {
          ffmpeg.exit();
        } catch(e) {}
        ffmpeg = null;
      }
    </script>
  </body>
</html>