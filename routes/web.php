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

    // NOTE: 以下のルーティングを追加
    Route::get('/three', function () {
        return view('three.index');
    })->name('three');
    Route::get('/three/openstreetmap', function () {
        return view('three.openstreetmap.index');
    })->name('threeOpenstreetmap');

    // 動画圧縮画面
    Route::get('/ffmpeg/transcode', function () {
        return response()
            ->view('tool/ffmpeg/transcode')
            // NOTE: このheaderがないとSharedArrayBufferが使えない
            ->header("Cross-Origin-Embedder-Policy", "require-corp")
            ->header("Cross-Origin-Opener-Policy", "same-origin");
    })->name('ffmpeg.transcode');
});

require __DIR__.'/auth.php';
