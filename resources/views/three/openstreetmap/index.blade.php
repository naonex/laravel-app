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

          <button id="startRouteAnimation">
            ルート再生
        </button>
      </div>
  </div>
</x-app-layout>