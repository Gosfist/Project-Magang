<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FiberDashboardController;
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
        Route::get('trace-jalur', [FiberDashboardController::class, 'traceJalur'])->name('trace');
        Route::get('server', [FiberDashboardController::class, 'server'])->name('server');
        Route::get('rasio', [FiberDashboardController::class, 'rasio'])->name('rasio');
        Route::get('odc', [FiberDashboardController::class, 'odc'])->name('odc');
        Route::get('odp', [FiberDashboardController::class, 'odp'])->name('odp');

        Route::post('{type}', [FiberDashboardController::class, 'store'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.store');
        Route::patch('{type}/{node}', [FiberDashboardController::class, 'update'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.update');
        Route::delete('{type}/{node}', [FiberDashboardController::class, 'destroy'])->whereIn('type', ['server', 'rasio', 'odc', 'odp'])->name('nodes.destroy');
    });
});
