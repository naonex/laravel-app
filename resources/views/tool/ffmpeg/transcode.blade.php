<x-app-layout>
  <x-slot name="additionalHead">
    <!-- FFmpeg -->
    <script src="{{ asset('assets/js/tool/ffmpeg/0.11.6/ffmpeg.min.js') }}"></script>

    <style>
      #video-compressor {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
      }

      #video-compressor #compressedFiles {
        margin-top: 1em;
        max-width: 100%;
      }

      #video-compressor .compressedFile {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 1em;
        align-items: center;
      }

      #video-compressor .compressedFile p {
        margin: 0;
        overflow-wrap: anywhere;
      }
    </style>
  </x-slot>

  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">
      {{ __('screens.ffmpeg.transcode') }}
    </h2>
  </x-slot>

  <div id="video-compressor">
    <h3>Upload a video to transcode to mp4 (x264) and play!</h3>

    <input type="file" id="uploader" multiple>
    <button
      type="button"
      onclick="cancel()"
      class="border border-gray-400 rounded px-3 py-1 bg-white hover:bg-gray-100">
      Cancel
    </button>

    <div id="compressedFiles"></div>
    <p id="progress"></p>
  </div>

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
</x-app-layout>