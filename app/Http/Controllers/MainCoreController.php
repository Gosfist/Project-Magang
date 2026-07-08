<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MainCoreController extends Controller
{
    public function index(Request $request)
    {
        $query = MainCore::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('start_location', 'like', "%{$search}%");
            });
        }

        $mainCores = $query->latest()->paginate(15)->withQueryString();

        return view('dashboard.main-cores.index', compact('mainCores'));
    }

    public function create()
    {
        return view('dashboard.main-cores.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:255|unique:main_cores,code',
            'total_core' => 'required|integer|min:1',
            'start_location' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ], [
            'name.required' => 'Nama main core wajib diisi.',
            'code.required' => 'Kode main core wajib diisi.',
            'code.unique' => 'Kode main core sudah digunakan.',
            'total_core.required' => 'Jumlah core wajib diisi.',
            'total_core.integer' => 'Jumlah core harus angka.',
            'total_core.min' => 'Jumlah core minimal 1.',
        ]);

        MainCore::create($request->only(['name', 'code', 'total_core', 'start_location', 'description']));

        return redirect()->route('main-cores.index')->with('success', 'Main Core berhasil ditambahkan.');
    }

    public function show(MainCore $mainCore)
    {
        $mainCore->load('networkInputs.networkPoint');

        return view('dashboard.main-cores.show', compact('mainCore'));
    }

    public function edit(MainCore $mainCore)
    {
        return view('dashboard.main-cores.edit', compact('mainCore'));
    }

    public function update(Request $request, MainCore $mainCore)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => ['required', 'string', 'max:255', Rule::unique('main_cores')->ignore($mainCore->id)],
            'total_core' => 'required|integer|min:1',
            'start_location' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ], [
            'name.required' => 'Nama main core wajib diisi.',
            'code.required' => 'Kode main core wajib diisi.',
            'code.unique' => 'Kode main core sudah digunakan.',
            'total_core.required' => 'Jumlah core wajib diisi.',
            'total_core.integer' => 'Jumlah core harus angka.',
            'total_core.min' => 'Jumlah core minimal 1.',
        ]);

        $mainCore->update($request->only(['name', 'code', 'total_core', 'start_location', 'description']));

        return redirect()->route('main-cores.index')->with('success', 'Main Core berhasil diperbarui.');
    }

    public function destroy(MainCore $mainCore)
    {
        $mainCore->delete();

        return redirect()->route('main-cores.index')->with('success', 'Main Core berhasil dihapus.');
    }
}
