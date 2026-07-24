<?php

namespace App\Http\Controllers;

use App\Models\MainOdc;
use App\Models\MainOdp;
use App\Models\MainServerCore;
use App\Models\User;

class DashboardController extends Controller
{
    public function index()
    {
        $data = [
            'totalServerCores' => MainServerCore::count(),
            'totalOdcs' => MainOdc::count(),
            'totalOdps' => MainOdp::count(),
            'totalWithRedaman' => MainOdc::whereNotNull('redaman')->count() + MainOdp::whereNotNull('redaman')->count(),
        ];

        if (auth()->user()->isAdmin()) {
            $data['totalPetugas'] = User::where('role', 'petugas')->count();
            $data['totalUsers'] = User::count();
        }

        return view('dashboard.index', $data);
    }
}
