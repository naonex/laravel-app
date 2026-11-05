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

  <div id="video-compressor" class="p-4 lg:p-6">

    <div class="max-w-[1440px] mx-auto">

      <!-- メインレイアウト -->
      <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] gap-4">

        <!-- 左：設定・操作メニュー -->
        <aside class="bg-white border border-gray-200 rounded-lg p-4 h-fit">

          <h3 class="font-semibold text-gray-800 text-lg mb-4">
            圧縮設定
          </h3>

          <!-- CRF設定 -->
          <div class="quality-setting mb-6">
            <label for="crf" class="block text-sm font-medium text-gray-700 mb-2">
              圧縮品質（CRF）
            </label>

            <input
              type="range"
              id="crf"
              min="18"
              max="35"
              value="23"
              step="1"
              list="crfMarks"
              class="w-full">

            <datalist id="crfMarks">
              <option value="18"></option>
              <option value="23" label="Default"></option>
              <option value="28"></option>
              <option value="35"></option>
            </datalist>

            <div class="text-center mt-2 text-sm text-gray-700">
              CRF: <strong id="crfValue">23</strong>
            </div>

            <p class="mt-2 text-xs text-gray-500 leading-relaxed">
              数値が小さいほど高画質、大きいほど高圧縮になります。
              初期値は23です。
            </p>
          </div>

          <!-- エンコード速度設定 -->
          <div class="preset-setting mb-6">
            <label for="preset" class="block text-sm font-medium text-gray-700 mb-2">
              エンコード速度
            </label>

            <select
              id="preset"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
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

            <p class="mt-2 text-xs text-gray-500 leading-relaxed">
              遅いほど圧縮効率が高くなります。
            </p>
          </div>

          <hr class="border-gray-200 my-4">

          <!-- 操作ボタン -->
          <div class="flex flex-col gap-3">

            <button
              type="button"
              id="startCompression"
              disabled
              class="w-full rounded-md px-4 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              圧縮開始
            </button>

            <button
              type="button"
              id="cancelCompression"
              class="w-full rounded-md px-4 py-2.5 border border-gray-300 text-gray-700 text-sm hover:bg-gray-100">
              キャンセル
            </button>

            <button
              type="button"
              id="mergeVideos"
              disabled
              class="w-full rounded-md px-4 py-2.5 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              動画を結合
            </button>

          </div>

        </aside>

        <!-- 中央：入力動画一覧 -->
        <section class="bg-white border border-gray-200 rounded-lg p-4 min-w-0">

          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800 text-lg">
              入力動画一覧
            </h3>
          </div>

          <!-- ファイル選択・ドラッグ＆ドロップ -->
          <div
            id="dropArea"
            class="mb-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition">
            <label for="uploader" class="cursor-pointer block">
              <div class="text-gray-600 font-medium text-sm">
                動画ファイルを追加
              </div>
              <div class="text-gray-400 text-xs mt-2">
                クリックまたはドラッグ＆ドロップ
              </div>
            </label>
            <input
              type="file"
              id="uploader"
              accept="video/*"
              multiple
              class="hidden">
          </div>

          <!-- 選択ファイル一覧 -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-3">
              選択ファイル
            </h4>

            <div id="selectedFiles" class="w-full space-y-2">
            </div>
          </div>

        </section>

        <!-- 右：変換結果一覧 -->
        <section class="bg-white border border-gray-200 rounded-lg p-4 min-w-0">

          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800 text-lg">
              変換結果一覧
            </h3>
          </div>

          <!-- 処理状況 -->
          <div class="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-3">
              処理状況
            </h4>
            <!-- 処理メッセージ・進捗率 -->
            <div class="flex justify-between items-center text-sm mb-2">
              <span id="progress">待機中</span>
              <span id="progressPercent" class="font-semibold">0%</span>
            </div>
            <!-- プログレスバー -->
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                id="progressBar"
                class="bg-blue-600 h-3 rounded-full transition-all duration-200"
                style="width: 0%">
              </div>
            </div>
          </div>

          <!-- 圧縮済みファイル一覧 -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-3">
              出力ファイル
            </h4>

            <div id="compressedFiles" class="max-w-full space-y-2">
            </div>
          </div>

        </section>

      </div>

    </div>

  </div>

  <!-- 動画プレビューモーダル -->
  <div id="videoModal"
    class="hidden fixed inset-0 z-50 items-center justify-center bg-black/70">

    <div class="relative bg-white p-4 rounded-lg max-w-3xl w-full mx-4">

      <button
        id="closeVideoModal"
        class="absolute top-2 right-3 text-2xl">
        &times;
      </button>

      <video
        id="previewVideo"
        class="w-full mt-6"
        controls>
      </video>

    </div>

  </div>

  @vite('resources/js/ffmpeg/transcode.js')

</x-app-layout>