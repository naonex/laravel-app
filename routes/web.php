<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // threeマップ画面
    Route::get('/three/openstreetmap', function () {
        return view('three.openstreetmap');
    })->name('threeOpenstreetmap');

    // 動画圧縮画面
    Route::get('/ffmpeg/transcode', function () {
        return response()
            ->view('ffmpeg.transcode')
            // NOTE: このheaderがないとSharedArrayBufferが使えない
            ->header("Cross-Origin-Embedder-Policy", "credentialless")
            ->header("Cross-Origin-Opener-Policy", "same-origin");
    })->name('ffmpegTranscode');
});

require __DIR__.'/auth.php';
