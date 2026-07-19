<?php

namespace App\Http\Controllers;

use App\Models\SplitterOutput;
use App\Models\Splitter;
use App\Models\MainCore;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SplitterOutputController extends Controller
{
    public function index(Request $request)
    {
        $query = SplitterOutput::with(['splitter.mainCore', 'splitter.networkInput', 'destinationMainCore']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('splitter', function ($sub) use ($search) {
                    $sub->where('splitter_name', 'like', "%{$search}%");
                })
                ->orWhereHas('destinationMainCore', function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%");
                });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('splitter_id')) {
            $query->where('splitter_id', $request->splitter_id);
        }

        $splitterOutputs = $query->latest()->paginate(15)->withQueryString();
        $splitters = Splitter::with('mainCore')->orderBy('splitter_name')->get();

        return view('dashboard.splitter-outputs.index', compact('splitterOutputs', 'splitters'));
    }

    public function edit(SplitterOutput $splitterOutput)
    {
        $splitterOutput->load(['splitter.mainCore', 'splitter.networkInput']);
        $mainCores = MainCore::orderBy('name')->get();

        return view('dashboard.splitter-outputs.edit', compact('splitterOutput', 'mainCores'));
    }

    public function update(Request $request, SplitterOutput $splitterOutput)
    {
        $rules = [
            'status' => 'required|in:empty,active,damaged',
            'description' => 'nullable|string',
        ];

        $messages = [
            'status.required' => 'Status wajib dipilih.',
            'status.in' => 'Status tidak valid.',
            'destination_main_core_id.required' => 'Tujuab Closure wajib dipilih jika status aktif.',
            'output_attenuation.required' => 'Redaman output wajib diisi jika status aktif.',
            'output_attenuation.numeric' => 'Redaman output harus angka.',
        ];

        // Conditional validation based on status
        if ($request->status === 'active') {
            $rules['destination_main_core_id'] = 'required|exists:main_cores,id';
            $rules['output_attenuation'] = 'required|numeric';
        } else {
            $rules['destination_main_core_id'] = 'nullable|exists:main_cores,id';
            $rules['output_attenuation'] = 'nullable|numeric';
        }

        $request->validate($rules, $messages);

        $data = [
            'status' => $request->status,
            'description' => $request->description,
            'destination_main_core_id' => $request->destination_main_core_id,
            'destination_network_point_id' => null,
            'output_attenuation' => $request->output_attenuation,
        ];

        // Clear destination and attenuation for non-active statuses if not provided
        if (in_array($request->status, ['empty', 'damaged']) && !$request->filled('destination_main_core_id')) {
            $data['destination_main_core_id'] = null;
        }
        if (in_array($request->status, ['empty', 'damaged']) && !$request->filled('output_attenuation')) {
            $data['output_attenuation'] = null;
            $data['attenuation_difference'] = null;
        }

        $splitterOutput->update($data);

        return redirect()->route('splitters.show', $splitterOutput->splitter_id)->with('success', 'Output port berhasil diperbarui.');
    }
}
