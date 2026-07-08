<?php

namespace App\Http\Controllers;

use App\Models\NetworkInput;
use App\Models\NetworkPoint;
use App\Models\MainCore;
use Illuminate\Http\Request;

class NetworkInputController extends Controller
{
    public function index(Request $request)
    {
        $query = NetworkInput::with(['networkPoint', 'mainCore']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('source_name', 'like', "%{$search}%")
                  ->orWhere('cable_color', 'like', "%{$search}%")
                  ->orWhereHas('networkPoint', function ($sub) use ($search) {
                      $sub->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('network_point_id')) {
            $query->where('network_point_id', $request->network_point_id);
        }

        $networkInputs = $query->latest()->paginate(15)->withQueryString();
        $networkPoints = NetworkPoint::orderBy('name')->get();

        return view('dashboard.network-inputs.index', compact('networkInputs', 'networkPoints'));
    }

    public function create(Request $request)
    {
        $networkPoints = NetworkPoint::orderBy('name')->get();
        $mainCores = MainCore::orderBy('name')->get();
        $selectedNetworkPoint = $request->network_point_id;

        return view('dashboard.network-inputs.create', compact('networkPoints', 'mainCores', 'selectedNetworkPoint'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'network_point_id' => 'required|exists:network_points,id',
            'main_core_id' => 'nullable|exists:main_cores,id',
            'source_name' => 'required|string|max:255',
            'cable_color' => 'nullable|string|max:255',
            'core_number' => 'nullable|integer',
            'input_attenuation' => 'required|numeric',
            'description' => 'nullable|string',
        ], [
            'network_point_id.required' => 'Titik jaringan wajib dipilih.',
            'network_point_id.exists' => 'Titik jaringan tidak valid.',
            'source_name.required' => 'Sumber input wajib diisi.',
            'input_attenuation.required' => 'Redaman input wajib diisi.',
            'input_attenuation.numeric' => 'Redaman input harus angka.',
        ]);

        NetworkInput::create($request->only([
            'network_point_id', 'main_core_id', 'source_name',
            'cable_color', 'core_number', 'input_attenuation', 'description'
        ]));

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil ditambahkan.');
    }

    public function edit(NetworkInput $networkInput)
    {
        $networkPoints = NetworkPoint::orderBy('name')->get();
        $mainCores = MainCore::orderBy('name')->get();

        return view('dashboard.network-inputs.edit', compact('networkInput', 'networkPoints', 'mainCores'));
    }

    public function update(Request $request, NetworkInput $networkInput)
    {
        $request->validate([
            'network_point_id' => 'required|exists:network_points,id',
            'main_core_id' => 'nullable|exists:main_cores,id',
            'source_name' => 'required|string|max:255',
            'cable_color' => 'nullable|string|max:255',
            'core_number' => 'nullable|integer',
            'input_attenuation' => 'required|numeric',
            'description' => 'nullable|string',
        ], [
            'network_point_id.required' => 'Titik jaringan wajib dipilih.',
            'network_point_id.exists' => 'Titik jaringan tidak valid.',
            'source_name.required' => 'Sumber input wajib diisi.',
            'input_attenuation.required' => 'Redaman input wajib diisi.',
            'input_attenuation.numeric' => 'Redaman input harus angka.',
        ]);

        $networkInput->update($request->only([
            'network_point_id', 'main_core_id', 'source_name',
            'cable_color', 'core_number', 'input_attenuation', 'description'
        ]));

        // Recalculate attenuation difference for related splitter outputs
        foreach ($networkInput->splitters as $splitter) {
            foreach ($splitter->outputs as $output) {
                if ($output->output_attenuation !== null) {
                    $output->attenuation_difference = $output->output_attenuation - $networkInput->input_attenuation;
                    $output->save();
                }
            }
        }

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil diperbarui.');
    }

    public function destroy(NetworkInput $networkInput)
    {
        $networkInput->delete();

        return redirect()->route('network-inputs.index')->with('success', 'Input Redaman berhasil dihapus.');
    }
}
