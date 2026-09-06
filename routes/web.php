<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MainCoreController;
use App\Http\Controllers\PppoeAccountController;
use App\Http\Controllers\PppoePackageController;
use App\Http\Controllers\ToolController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes - Web Profile
|--------------------------------------------------------------------------
*/

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::redirect('/tentang-kami', '/#tentang-kami')->name('about');
Route::redirect('/layanan', '/#layanan')->name('services');
Route::redirect('/kontak', '/#kontak')->name('contact');

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

Route::get('/login', [LoginController::class, 'showLogin'])->name('login');
Route::post('/login', [LoginController::class, 'login']);
Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

/*
|--------------------------------------------------------------------------
| Dashboard Routes (Requires Authentication)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->prefix('dashboard')->group(function () {
    // Dashboard Home
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

    // User Management (Admin Only)
    Route::middleware(['role:admin'])->group(function () {
        Route::resource('users', UserController::class)->except(['show']);
    });

    Route::prefix('fiber')->name('fiber.')->group(function () {
        Route::get('/', [MainCoreController::class, 'index'])->name('dashboard');
        Route::get('trace-jalur', [MainCoreController::class, 'traceJalur'])->name('trace');
        Route::get('server', [MainCoreController::class, 'server'])->name('server');
        Route::get('rasio', [MainCoreController::class, 'rasio'])->name('rasio');
        Route::get('odc', [MainCoreController::class, 'odc'])->name('odc');
        Route::get('odp', [MainCoreController::class, 'odp'])->name('odp');

        Route::post('{type}', [MainCoreController::class, 'store'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.store');
        Route::patch('{type}/{node}', [MainCoreController::class, 'update'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.update');
        Route::delete('{type}/{node}', [MainCoreController::class, 'destroy'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.destroy');
    });

    Route::prefix('pppoe')->name('pppoe.')->group(function () {
        Route::patch('packages/{package}/status', [PppoePackageController::class, 'toggleStatus'])
            ->name('packages.toggle-status');
        Route::resource('packages', PppoePackageController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('accounts', PppoeAccountController::class)->only(['index', 'store', 'update', 'destroy']);
    });

    Route::prefix('tools')->name('tools.')->group(function () {
        Route::get('kalkulator-redaman', [ToolController::class, 'attenuationCalculator'])
            ->name('attenuation-calculator');
    });
});
