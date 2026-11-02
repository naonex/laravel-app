<x-app-layout>
  <x-slot name="additionalHead">
    <!-- FFmpeg -->
    <script src="{{ asset('assets/js/tool/ffmpeg/0.11.6/ffmpeg.min.js') }}"></script>
  </x-slot>

  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">
      {{ __('screens.ffmpegTranscode') }}
    </h2>
  </x-slot>

  <div id="video-compressor" class="flex flex-col items-center p-4">
    <h3>Upload a video to transcode to mp4 (x264) and play!</h3>
    <!-- CRF設定 -->
    <div class="quality-setting flex flex-col items-center w-fit my-4">
      <label for="crf">Compression quality (CRF):</label>
      <input
        type="range"
        id="crf"
        min="18"
        max="35"
        value="23"
        step="1"
        list="crfMarks">
      <datalist id="crfMarks">
        <option value="18"></option>
        <option value="23" label="Default"></option>
        <option value="28"></option>
        <option value="35"></option>
      </datalist>
      <div>
        CRF: <strong id="crfValue">23</strong>
      </div>
      <p class="mt-2 w-[400px] max-w-full text-sm text-gray-600">
        数値が小さいほど高画質、大きいほど高圧縮になります。
        初期値は23（libx264標準設定）です。
      </p>
    </div>
    <!-- エンコード速度設定 -->
    <div class="preset-setting flex flex-col items-center my-2">
      <label for="preset">Encoding speed (Preset):</label>
      <select id="preset" class="border border-gray-300 rounded px-100 py-1">
        <option value="ultrafast">ultrafast</option>
        <option value="superfast">superfast</option>
        <option value="veryfast">veryfast</option>
        <option value="faster">faster</option>
        <option value="fast">fast</option>
        <option value="medium" selected>medium (Default)</option>
        <option value="slow">slow</option>
        <option value="slower">slower</option>
        <option value="veryslow">veryslow</option>
      </select>
      <p class="mt-1 text-sm text-gray-600">
        処理速度が速いほど圧縮効率は低く、遅いほど圧縮効率は高くなります。
      </p>
    </div>
    <!-- ファイル選択 -->
    <div class="flex flex-col items-center gap-3 my-4">
      <input type="file" id="uploader" accept="video/*" multiple>
      <!-- 選択ファイル一覧 -->
      <div id="selectedFiles" class="w-full max-w-2xl"></div>
      <!-- 圧縮開始ボタン -->
      <button
        type="button"
        id="startCompression"
        disabled
        class="border border-blue-500 rounded px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
        Start Compression
      </button>
      <!-- キャンセル -->
      <button
        type="button"
        id="cancelCompression"
        class="border border-gray-400 rounded px-3 py-1 bg-white hover:bg-gray-100">
        Cancel
      </button>
      <!-- 結合 -->
      <button
        type="button"
        id="mergeVideos"
        disabled
        class="border border-green-600 rounded px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
        Merge Videos
      </button>
    </div>
    <div id="compressedFiles" class="mt-4 max-w-full"></div>
    <p id="progress"></p>
  </div>

  <!-- 動画プレビューモーダル -->
  <div id="videoModal"
    class="hidden fixed inset-0 z-50 items-center justify-center bg-black/70">
    <div class="relative bg-white p-4 rounded-lg max-w-3xl w-full mx-4">
      <button id="closeVideoModal"
        class="absolute top-2 right-3 text-2xl">
        &times;
      </button>
      <video id="previewVideo"
        class="w-full mt-6"
        controls>
      </video>
    </div>
  </div>

  @vite('resources/js/ffmpeg/transcode.js')
</x-app-layout>