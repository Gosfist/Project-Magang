<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use App\Models\NetworkPoint;
use App\Models\Splitter;
use App\Models\SplitterOutput;
use App\Models\NetworkInput;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        $data = [
            'totalMainCores' => MainCore::count(),
            'totalNetworkPoints' => NetworkPoint::count(),
            'totalOdc' => NetworkPoint::where('type', 'odc')->count(),
            'totalOdp' => NetworkPoint::where('type', 'odp')->count(),
            'totalClosure' => NetworkPoint::where('type', 'closure')->count(),
            'totalDistributionBox' => NetworkPoint::where('type', 'distribution_box')->count(),
            'totalSplitters' => Splitter::count(),
            'totalPortActive' => SplitterOutput::where('status', 'active')->count(),
            'totalPortEmpty' => SplitterOutput::where('status', 'empty')->count(),
            'totalPortDamaged' => SplitterOutput::where('status', 'damaged')->count(),
            'latestInputs' => NetworkInput::with(['networkPoint', 'mainCore'])->latest()->take(5)->get(),
            'latestOutputs' => SplitterOutput::with(['splitter.mainCore', 'destinationMainCore'])->latest()->take(5)->get(),
        ];

        // Total petugas only for admin
        if (auth()->user()->isAdmin()) {
            $data['totalPetugas'] = User::where('role', 'petugas')->count();
            $data['totalUsers'] = User::count();
        }

        return view('dashboard.index', $data);
    }
}
