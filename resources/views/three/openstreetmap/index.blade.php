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

    <!-- index.jsを読み込む ※Mapより後で実行（内部でMapを使えるようにするため） -->
    @vite('resources/js/three/openstreetmap/index.js')
  </x-slot>

  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">
      {{ __('screens.threeOpenstreetmap') }}
    </h2>
  </x-slot>

  <div class="flex flex-row justify-center">
    <div id="map" style="border:1px solid #777777; width:500px; height:500px;"></div>
    <div id="container">
      <canvas id="myCanvas"></canvas>
    </div>
  </div>
</x-app-layout>