<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Dashboard') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900">
                    {{ __("You're logged in!") }}
                </div>
            </div>
            <div class="mt-2 bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900 grid">
                    <a class="font-medium text-blue-600 dark:text-red-500 hover:underline" href="{{ route('three') }}">
                        {{ __('screens.three') }}
                    </a>
                    <a class="font-medium text-blue-600 dark:text-red-500 hover:underline" href="{{ route('threeOpenstreetmap') }}">
                        {{ __('screens.threeOpenstreetmap') }}
                    </a>
                </div>
            </div>
            <div class="mt-2 bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900 grid">
                    <a class="font-medium text-blue-600 dark:text-red-500 hover:underline" href="{{ route('ffmpeg.transcode') }}">
                        {{ __('screens.ffmpeg.transcode') }}
                    </a>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
