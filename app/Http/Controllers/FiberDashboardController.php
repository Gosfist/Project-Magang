<?php

namespace App\Http\Controllers;

use App\Models\FiberCore;
use App\Models\FoCable;
use App\Models\FoClosure;
use Illuminate\Http\Request;

class FiberDashboardController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->string('search')->toString();
        $closures = FoClosure::query()
            ->when($search, fn ($q) => $q->where('nama_cl', 'like', "%{$search}%")->orWhere('alamat_cl', 'like', "%{$search}%"))
            ->orderByDesc('fo_closure')
            ->paginate(10)
            ->withQueryString();

        $stats = [
            'closures' => FoClosure::count(),
            'cables' => FoCable::count(),
            'cores' => FiberCore::count(),
            'core_with_redaman' => FiberCore::whereNotNull('redaman')->count(),
        ];

        if ($request->is('api/*')) {
            return response()->json(['data' => $stats]);
        }

        return view('dashboard.fiber.index', compact('stats', 'closures', 'search'));
    }
}
