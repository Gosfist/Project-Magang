<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\MainCoreController;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->group(function () {
    Route::post('login', [LoginController::class, 'apiLogin'])->name('api.login');
});

Route::middleware('jwt')->group(function () {
    Route::get('me', [LoginController::class, 'me'])->name('api.me');

    Route::prefix('maincore')->name('api.maincore.')->group(function () {
        Route::middleware('web')->group(function () {
            // Endpoint GET memakai sesi Blade untuk merender fragment tanpa asset layout.
            Route::get('{type}', [MainCoreController::class, 'apiIndex'])
                ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
                ->name('index');
            Route::get('{type}/parents', [MainCoreController::class, 'apiParents'])
                ->whereIn('type', ['rasio', 'odc', 'odp'])
                ->name('parents');
            Route::get('{type}/{node}/edit', [MainCoreController::class, 'apiEdit'])
                ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
                ->whereNumber('node')
                ->name('edit');
        });

        // Endpoint perubahan data tetap memakai JWT dan tidak merender halaman penuh.
        Route::post('{type}', [MainCoreController::class, 'store'])
            ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
            ->name('store');
        Route::patch('{type}/{node}', [MainCoreController::class, 'update'])
            ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
            ->name('update');
        Route::delete('{type}/{node}', [MainCoreController::class, 'destroy'])
            ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
            ->name('destroy');
    });
});
