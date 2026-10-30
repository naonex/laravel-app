<x-app-layout>
  <x-slot name="additionalHead">
    <!-- Leaflet -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="" />
    <!-- Make sure you put this AFTER Leaflet's CSS -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""></script>

    <!-- jsを読み込む ※Mapより後で実行（内部でMapを使えるようにするため） -->
    @vite('resources/js/three/openstreetmap/index.js')
    @vite('resources/js/three/openstreetmap/terrain.js')
  </x-slot>

  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">
      {{ __('screens.threeOpenstreetmap') }}
    </h2>
  </x-slot>

  <div class="flex flex-row justify-center w-full max-w-[1024px] mx-auto gap-2">
      <!-- Leaflet -->
      <div id="map"
          class="flex-1 min-w-0 h-[500px] border border-gray-500">
      </div>

      <!-- Three.js -->
      <div class="flex-1 min-w-0">
          <div id="terrain3d"
              class="w-full h-[500px] bg-slate-800">
          </div>

          <div id="terrainStatus" class="mt-2 text-gray-500">
              地図をクリックすると地形を表示します。
          </div>

          <!-- 地形アニメーション操作パネル -->
          <div class="mb-4 rounded-lg border border-gray-300 bg-white p-4 shadow-sm">

              <div class="mb-3 text-sm font-semibold text-gray-700">
                  地形アニメーション
              </div>

              <div class="flex flex-wrap items-end gap-3">

                  <!-- 移動方式 -->
                  <div class="flex flex-col gap-1">
                      <label for="terrainAnimationMode"
                            class="text-xs font-medium text-gray-600">
                          移動方式
                      </label>

                      <select
                          id="terrainAnimationMode"
                          class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                          <option value="speed">速度指定</option>
                          <option value="duration">時間指定</option>
                      </select>
                  </div>

                  <!-- 速度指定 -->
                  <div id="terrainAnimationSpeedArea"
                      class="flex flex-col gap-1">

                      <label for="terrainAnimationSpeed"
                            class="text-xs font-medium text-gray-600">
                          移動速度
                      </label>

                      <div class="flex">
                          <input
                              type="number"
                              id="terrainAnimationSpeed"
                              value="1000"
                              min="1"
                              max="1000"
                              class="w-24 rounded-l-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >

                          <span class="rounded-r-md border border-l-0 border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600">
                              m/s
                          </span>
                      </div>
                  </div>

                  <!-- 時間指定 -->
                  <div id="terrainAnimationDurationArea"
                      class="hidden flex-col gap-1">

                      <label for="terrainAnimationDurationInput"
                            class="text-xs font-medium text-gray-600">
                          移動時間
                      </label>

                      <div class="flex">
                          <input
                              type="number"
                              id="terrainAnimationDurationInput"
                              value="10"
                              min="1"
                              max="3600"
                              class="w-24 rounded-l-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >

                          <span class="rounded-r-md border border-l-0 border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600">
                              秒
                          </span>
                      </div>
                  </div>

                  <!-- 再生ボタン -->
                  <button
                      type="button"
                      id="terrainAnimationPlay"
                      class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                      ▶ 再生
                  </button>

                  <!-- 停止ボタン -->
                  <button
                      type="button"
                      id="terrainAnimationStop"
                      class="rounded-md bg-gray-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled
                  >
                      ■ 停止
                  </button>

              </div>
          </div>
      </div>
  </div>
</x-app-layout>