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
        Route::get('server', [FiberDashboardController::class, 'server'])->name('server');
        Route::get('odc', [FiberDashboardController::class, 'odc'])->name('odc');
        Route::get('odp', [FiberDashboardController::class, 'odp'])->name('odp');

        Route::post('servers', [FiberDashboardController::class, 'storeServer'])->name('servers.store');
        Route::patch('servers/{server}', [FiberDashboardController::class, 'updateServer'])->name('servers.update');
        Route::delete('servers/{server}', [FiberDashboardController::class, 'destroyServer'])->name('servers.destroy');

        Route::post('odcs', [FiberDashboardController::class, 'storeOdc'])->name('odcs.store');
        Route::get('odcs/{odc}', [FiberDashboardController::class, 'showOdc'])->name('odcs.show');
        Route::patch('odcs/{odc}', [FiberDashboardController::class, 'updateOdc'])->name('odcs.update');
        Route::delete('odcs/{odc}', [FiberDashboardController::class, 'destroyOdc'])->name('odcs.destroy');
        Route::patch('odcs/{odc}/outputs/{output}', [FiberDashboardController::class, 'updateOdcOutput'])->name('odcs.outputs.update');
        Route::delete('odcs/{odc}/outputs/{output}', [FiberDashboardController::class, 'destroyOdcOutput'])->name('odcs.outputs.destroy');

        Route::post('odps', [FiberDashboardController::class, 'storeOdp'])->name('odps.store');
        Route::get('odps/{odp}', [FiberDashboardController::class, 'showOdp'])->name('odps.show');
        Route::patch('odps/{odp}', [FiberDashboardController::class, 'updateOdp'])->name('odps.update');
        Route::delete('odps/{odp}', [FiberDashboardController::class, 'destroyOdp'])->name('odps.destroy');
        Route::patch('odps/{odp}/ports/{port}', [FiberDashboardController::class, 'updateOdpPort'])->name('odps.ports.update');
        Route::delete('odps/{odp}/ports/{port}', [FiberDashboardController::class, 'destroyOdpPort'])->name('odps.ports.destroy');
    });
});
