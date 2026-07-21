<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FiberDashboardController;
use App\Http\Controllers\FoCableController;
use App\Http\Controllers\FoClosureController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes - Web Profile
|--------------------------------------------------------------------------
*/

Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/tentang-kami', [HomeController::class, 'about'])->name('about');
Route::get('/layanan', [HomeController::class, 'services'])->name('services');
Route::get('/kontak', [HomeController::class, 'contact'])->name('contact');

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
        Route::get('/', [FiberDashboardController::class, 'index'])->name('dashboard');
        Route::post('closures/{closure}/cores', [FoClosureController::class, 'storeCore'])->name('closures.cores.store');
        Route::patch('closures/{closure}/cores/{fiberCore}', [FoClosureController::class, 'updateCore'])->name('closures.cores.update');
        Route::delete('closures/{closure}/cores/{fiberCore}', [FoClosureController::class, 'destroyCore'])->name('closures.cores.destroy');
        Route::resource('closures', FoClosureController::class)->except(['edit']);
        Route::resource('cables', FoCableController::class);
    });
});

Route::middleware(['auth'])->prefix('api')->group(function () {
    Route::get('closures', [FoClosureController::class, 'index']);
    Route::get('closures/{closure}', [FoClosureController::class, 'show']);
    Route::post('closures', [FoClosureController::class, 'store']);
    Route::put('closures/{closure}', [FoClosureController::class, 'update']);
    Route::delete('closures/{closure}', [FoClosureController::class, 'destroy']);

    Route::get('cables', [FoCableController::class, 'index']);
    Route::get('cables/{cable}', [FoCableController::class, 'show']);
    Route::post('cables', [FoCableController::class, 'store']);
    Route::put('cables/{cable}', [FoCableController::class, 'update']);
    Route::delete('cables/{cable}', [FoCableController::class, 'destroy']);
    Route::get('cables/{cable}/cores', [FoCableController::class, 'cores']);
    Route::get('fiber-cores/{fiberCore}', [FoCableController::class, 'showCore']);
    Route::put('fiber-cores/{fiberCore}', [FoCableController::class, 'updateCore']);

    Route::get('network/dashboard', [FiberDashboardController::class, 'index']);
});
