<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use App\Models\User;

class DashboardController extends Controller
{
    public function index()
    {
        $data = [
            'totalServerCores' => MainCore::type('server')->count(),
            'totalOdcs' => MainCore::type('odc')->count(),
            'totalOdps' => MainCore::type('odp')->count(),
            'totalWithRedaman' => MainCore::whereNotNull('redaman_in')->count(),
        ];

        if (auth()->user()->isAdmin()) {
            $data['totalPetugas'] = User::where('role', 'petugas')->count();
            $data['totalUsers'] = User::count();
        }

        return view('dashboard.index', $data);
    }
}
