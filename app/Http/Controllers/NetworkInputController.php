<?php

namespace App\Http\Controllers;

use App\Models\NetworkInput;
use App\Models\MainCore;
use Illuminate\Http\Request;

class NetworkInputController extends Controller
{
    public function index(Request $request)
    {
        $query = NetworkInput::with('mainCore');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('source_name', 'like', "%{$search}%")
                  ->orWhereHas('mainCore', function ($sub) use ($search) {
                      $sub->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('main_core_id')) {
            $query->where('main_core_id', $request->main_core_id);
        }

        $networkInputs = $query->orderBy('main_core_id')->orderBy('core_number')->paginate(15)->withQueryString();
        $mainCores = MainCore::orderBy('name')->get();

        return view('dashboard.network-inputs.index', compact('networkInputs', 'mainCores'));
    }

    public function create(Request $request)
    {
        return redirect()->route('network-inputs.index');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'main_core_id' => 'required|exists:main_cores,id',
            'attenuations' => 'nullable|array',
        ], [
            'main_core_id.required' => 'Data Closure wajib dipilih.',
            'main_core_id.exists' => 'Data Closure tidak valid.',
        ]);

        $mainCore = MainCore::findOrFail($validated['main_core_id']);

        $rules = [];
        $messages = [];
        for ($core = 1; $core <= $mainCore->total_core; $core++) {
            $rules["attenuations.{$core}"] = 'nullable|numeric';
            $messages["attenuations.{$core}.numeric"] = "Redaman Core {$core} harus angka.";
        }
        $request->validate($rules, $messages);

        for ($core = 1; $core <= $mainCore->total_core; $core++) {
            $networkInput = NetworkInput::where('main_core_id', $mainCore->id)
                ->where('core_number', $core)
                ->first();
            $attenuation = $request->input("attenuations.{$core}");

            if ($attenuation === null || $attenuation === '') {
                continue;
            }

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

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil disimpan.');
    }

    public function edit(NetworkInput $networkInput)
    {
        return redirect()->route('network-inputs.index');
    }

    public function update(Request $request, NetworkInput $networkInput)
    {
        $request->validate([
            'input_attenuation' => 'required|numeric',
        ], [
            'input_attenuation.required' => 'Redaman input wajib diisi.',
            'input_attenuation.numeric' => 'Redaman input harus angka.',
        ]);

        $networkInput->update([
            'input_attenuation' => $request->input_attenuation,
        ]);

        $this->recalculateSplitterOutputs($networkInput);

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil diperbarui.');
    }

    public function destroy(NetworkInput $networkInput)
    {
        $networkInput->delete();

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil dihapus.');
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
