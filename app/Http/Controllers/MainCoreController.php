<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use App\Models\NetworkInput;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MainCoreController extends Controller
{
    public function index(Request $request)
    {
        $query = MainCore::with('networkInputs');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('start_location', 'like', "%{$search}%");
            });
        }

        $mainCores = $query->latest()->paginate(15)->withQueryString();

        return view('dashboard.main-cores.index', compact('mainCores'));
    }

    public function create()
    {
        return redirect()->route('main-cores.index');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'total_core' => 'required|integer|min:1',
            'start_location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'attenuations' => 'nullable|array',
        ], [
            'name.required' => 'Nama closure wajib diisi.',
            'total_core.required' => 'Jumlah core wajib diisi.',
            'total_core.integer' => 'Jumlah core harus angka.',
            'total_core.min' => 'Jumlah core minimal 1.',
            'start_location.required' => 'Lokasi closure wajib diisi.',
        ]);

        $this->validateAttenuations($request, (int) $validated['total_core']);

        $mainCore = MainCore::create([
            'name' => $validated['name'],
            'code' => $this->generateCode($validated['name']),
            'total_core' => $validated['total_core'],
            'start_location' => $validated['start_location'] ?? null,
            'description' => $validated['description'] ?? null,
        ]);

        $this->syncInputAttenuations($mainCore, $request);

        return redirect()->route('main-cores.index')->with('success', 'Data Closure berhasil ditambahkan.');
    }

    public function show(MainCore $mainCore)
    {
        $mainCore->load('networkInputs.networkPoint');

        return view('dashboard.main-cores.show', compact('mainCore'));
    }

    public function edit(MainCore $mainCore)
    {
        return redirect()->route('main-cores.index');
    }

    public function update(Request $request, MainCore $mainCore)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'total_core' => 'required|integer|min:1',
            'start_location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'attenuations' => 'nullable|array',
            'editing_id' => 'nullable|integer',
        ], [
            'name.required' => 'Nama closure wajib diisi.',
            'total_core.required' => 'Jumlah core wajib diisi.',
            'total_core.integer' => 'Jumlah core harus angka.',
            'total_core.min' => 'Jumlah core minimal 1.',
            'start_location.required' => 'Lokasi closure wajib diisi.',
        ]);

        $this->validateAttenuations($request, (int) $validated['total_core']);

        $mainCore->update([
            'name' => $validated['name'],
            'total_core' => $validated['total_core'],
            'start_location' => $validated['start_location'] ?? null,
            'description' => $validated['description'] ?? null,
        ]);

        $this->syncInputAttenuations($mainCore, $request);

        return redirect()->route('main-cores.index')->with('success', 'Data Closure berhasil diperbarui.');
    }

    public function destroy(MainCore $mainCore)
    {
        $mainCore->delete();

        return redirect()->route('main-cores.index')->with('success', 'Data Closure berhasil dihapus.');
    }

    private function generateCode(string $name): string
    {
        $base = Str::upper(Str::slug($name, '-')) ?: 'CLOSURE';
        $code = $base;
        $counter = 1;

        while (MainCore::where('code', $code)->exists()) {
            $code = $base . '-' . $counter;
            $counter++;
        }

        return $code;
    }

    private function validateAttenuations(Request $request, int $totalCore): void
    {
        $rules = [];
        $messages = [];

        for ($core = 1; $core <= $totalCore; $core++) {
            $rules["attenuations.{$core}"] = 'nullable|numeric';
            $messages["attenuations.{$core}.numeric"] = "Redaman Core {$core} harus angka.";
        }

        $request->validate($rules, $messages);
    }

    private function syncInputAttenuations(MainCore $mainCore, Request $request): void
    {
        for ($core = 1; $core <= $mainCore->total_core; $core++) {
            $attenuation = $request->input("attenuations.{$core}");

            if ($attenuation === null || $attenuation === '') {
                continue;
            }

            $networkInput = NetworkInput::where('main_core_id', $mainCore->id)
                ->where('core_number', $core)
                ->first();

            $data = [
                'main_core_id' => $mainCore->id,
                'source_name' => "Core {$core}",
                'cable_color' => null,
                'core_number' => $core,
                'input_attenuation' => $attenuation,
                'description' => null,
            ];

            if ($networkInput) {
                $networkInput->update($data);
            } else {
                $networkInput = NetworkInput::create($data);
            }

            $this->recalculateSplitterOutputs($networkInput);
        }
    }

    private function recalculateSplitterOutputs(NetworkInput $networkInput): void
    {
        $networkInput->loadMissing('splitters.outputs');

        foreach ($networkInput->splitters as $splitter) {
            foreach ($splitter->outputs as $output) {
                if ($output->output_attenuation !== null) {
                    $output->attenuation_difference = $output->output_attenuation - $networkInput->input_attenuation;
                    $output->save();
                }
            }
        }
    }
}
