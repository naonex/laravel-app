<x-app-layout>
  <x-slot name="additionalHead">
    <!-- three.jsを読み込む -->
    <script src="https://unpkg.com/three@0.146.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.131.3/examples/js/controls/OrbitControls.js"></script>

    <!-- index.jsを読み込む -->
    @vite('resources/js/three/index.js')
  </x-slot>

  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">
      {{ __('screens.three') }}
    </h2>
  </x-slot>

  <canvas id="myCanvas"></canvas>
</x-app-layout>