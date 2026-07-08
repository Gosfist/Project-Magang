<?php

namespace App\Http\Controllers;

use App\Models\SplitterOutput;
use App\Models\Splitter;
use App\Models\NetworkPoint;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SplitterOutputController extends Controller
{
    public function index(Request $request)
    {
        $query = SplitterOutput::with(['splitter.networkPoint', 'splitter.networkInput', 'destinationNetworkPoint']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('splitter', function ($sub) use ($search) {
                    $sub->where('splitter_name', 'like', "%{$search}%");
                })
                ->orWhereHas('destinationNetworkPoint', function ($sub) use ($search) {
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
        $splitters = Splitter::with('networkPoint')->orderBy('splitter_name')->get();

        return view('dashboard.splitter-outputs.index', compact('splitterOutputs', 'splitters'));
    }

    public function edit(SplitterOutput $splitterOutput)
    {
        $splitterOutput->load(['splitter.networkPoint', 'splitter.networkInput']);
        $networkPoints = NetworkPoint::orderBy('name')->get();

        return view('dashboard.splitter-outputs.edit', compact('splitterOutput', 'networkPoints'));
    }

    public function update(Request $request, SplitterOutput $splitterOutput)
    {
        $rules = [
            'status' => 'required|in:active,backup,empty,damaged,maintenance',
            'description' => 'nullable|string',
        ];

        $messages = [
            'status.required' => 'Status wajib dipilih.',
            'status.in' => 'Status tidak valid.',
            'destination_network_point_id.required' => 'Titik jaringan tujuan wajib dipilih jika status aktif.',
            'output_attenuation.required' => 'Redaman output wajib diisi jika status aktif.',
            'output_attenuation.numeric' => 'Redaman output harus angka.',
        ];

        // Conditional validation based on status
        if ($request->status === 'active') {
            $rules['destination_network_point_id'] = 'required|exists:network_points,id';
            $rules['output_attenuation'] = 'required|numeric';
        } else {
            $rules['destination_network_point_id'] = 'nullable|exists:network_points,id';
            $rules['output_attenuation'] = 'nullable|numeric';
        }

        $request->validate($rules, $messages);

        $data = [
            'status' => $request->status,
            'description' => $request->description,
            'destination_network_point_id' => $request->destination_network_point_id,
            'output_attenuation' => $request->output_attenuation,
        ];

        // Clear destination and attenuation for non-active statuses if not provided
        if (in_array($request->status, ['empty', 'backup', 'damaged', 'maintenance']) && !$request->filled('destination_network_point_id')) {
            $data['destination_network_point_id'] = null;
        }
        if (in_array($request->status, ['empty', 'backup', 'damaged', 'maintenance']) && !$request->filled('output_attenuation')) {
            $data['output_attenuation'] = null;
            $data['attenuation_difference'] = null;
        }

        $splitterOutput->update($data);

        return redirect()->route('splitters.show', $splitterOutput->splitter_id)->with('success', 'Output port berhasil diperbarui.');
    }
}
