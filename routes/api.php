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
        Route::get('{type}', [MainCoreController::class, 'apiIndex'])
            ->whereIn('type', ['server', 'rasio', 'odc', 'odp'])
            ->name('index');
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
