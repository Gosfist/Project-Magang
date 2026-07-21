<?php

namespace App\Http\Controllers;

use App\Models\FiberCore;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Models\User;

class DashboardController extends Controller
{
    public function index()
    {
        $data = [
            'totalClosures' => FoClosure::count(),
            'totalCables' => FoCable::count(),
            'totalCores' => FiberCore::count(),
            'totalCoreWithRedaman' => FiberCore::whereNotNull('redaman')->count(),
        ];

        if (auth()->user()->isAdmin()) {
            $data['totalPetugas'] = User::where('role', 'petugas')->count();
            $data['totalUsers'] = User::count();
        }

        return view('dashboard.index', $data);
    }
}
