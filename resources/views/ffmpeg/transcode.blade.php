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
      <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4">

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

          <!-- 処理状況 -->
          <div class="mt-6 pt-4 border-t">
            <div class="flex justify-between items-center text-sm mb-2">
              <span id="progress">待機中</span>
              <span id="progressPercent" class="font-semibold">0%</span>
            </div>

            <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                id="progressBar"
                class="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style="width: 0%"></div>
            </div>
          </div>

        </aside>

        <!-- 右：動画一覧 -->
        <section class="bg-white border border-gray-200 rounded-lg p-4 min-w-0">

          <h3 class="font-semibold text-gray-800 text-lg mb-4">
            動画一覧
          </h3>

          <!-- ファイル選択・ドラッグ＆ドロップ -->
          <div
            id="dropArea"
            class="border-2 border-dashed border-gray-300 rounded-lg p-6
              text-center cursor-pointer
              transition-all duration-200
              hover:border-blue-400 hover:bg-blue-50 hover:shadow-md">

            <input
              type="file"
              id="uploader"
              accept="video/*"
              multiple
              class="hidden">

            <div class="pointer-events-none">
              <div class="text-gray-500 text-sm">
                動画をドラッグ＆ドロップ
              </div>
              <div class="text-gray-400 text-xs mt-1">
                またはクリックしてファイルを選択
              </div>
            </div>
          </div>

          <!-- 動画一覧の見出し -->
          <div class="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_64px_40px]
                      items-center gap-2 border-b bg-gray-50 px-2 py-2 mt-2
                      text-xs font-semibold text-gray-600">

            <div class="text-center">対象</div>
            <div class="border-l pl-2">IN（入力動画）</div>
            <div class="border-l pl-2">OUT（出力動画）</div>
            <div></div><!-- 入れ替えアイコン -->
            <div class="border-l pl-2 text-center">削除</div>
          </div>
          <!-- 動画一覧 -->
          <div id="selectedFiles"></div>

          <div id="separator" class="border-t-2 border-gray-400 mt-4 pt-4" hidden></div>
          <!-- 結合結果 -->
          <div id="mergedVideoResult"></div>

        </section>

      </div>

    </div>

  </div>

  <!-- 動画プレビューモーダル -->
  <div id="videoModal"
    class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70">
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

  @vite('resources/js/ffmpeg/index.js')

</x-app-layout>