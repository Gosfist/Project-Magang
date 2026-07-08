<?php

namespace App\Http\Controllers;

use App\Models\Splitter;
use App\Models\SplitterOutput;
use App\Models\NetworkPoint;
use App\Models\NetworkInput;
use Illuminate\Http\Request;

class SplitterController extends Controller
{
    public function index(Request $request)
    {
        $query = Splitter::with(['networkPoint', 'networkInput']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('splitter_name', 'like', "%{$search}%")
                  ->orWhere('splitter_ratio', 'like', "%{$search}%")
                  ->orWhereHas('networkPoint', function ($sub) use ($search) {
                      $sub->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('network_point_id')) {
            $query->where('network_point_id', $request->network_point_id);
        }

        $splitters = $query->latest()->paginate(15)->withQueryString();
        $networkPoints = NetworkPoint::orderBy('name')->get();

        return view('dashboard.splitters.index', compact('splitters', 'networkPoints'));
    }

    public function create(Request $request)
    {
        $networkPoints = NetworkPoint::orderBy('name')->get();
        $networkInputs = NetworkInput::with('networkPoint')->orderBy('source_name')->get();
        $selectedNetworkPoint = $request->network_point_id;

        return view('dashboard.splitters.create', compact('networkPoints', 'networkInputs', 'selectedNetworkPoint'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'network_point_id' => 'required|exists:network_points,id',
            'network_input_id' => 'required|exists:network_inputs,id',
            'splitter_name' => 'required|string|max:255',
            'splitter_ratio' => 'required|string|max:50',
            'total_ports' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ], [
            'network_point_id.required' => 'Titik jaringan wajib dipilih.',
            'network_input_id.required' => 'Input redaman wajib dipilih.',
            'splitter_name.required' => 'Nama splitter wajib diisi.',
            'splitter_ratio.required' => 'Jenis splitter wajib dipilih.',
            'total_ports.required' => 'Total port wajib diisi.',
            'total_ports.integer' => 'Total port harus angka.',
            'total_ports.min' => 'Total port minimal 1.',
        ]);

        $splitter = Splitter::create($request->only([
            'network_point_id', 'network_input_id', 'splitter_name',
            'splitter_ratio', 'total_ports', 'description'
        ]));

        // Auto-generate output ports
        for ($i = 1; $i <= $splitter->total_ports; $i++) {
            SplitterOutput::create([
                'splitter_id' => $splitter->id,
                'port_number' => $i,
                'status' => 'empty',
            ]);
        }

        return redirect()->route('splitters.show', $splitter)->with('success', 'Splitter berhasil ditambahkan dengan ' . $splitter->total_ports . ' port.');
    }

    public function show(Splitter $splitter)
    {
        $splitter->load([
            'networkPoint',
            'networkInput',
            'outputs.destinationNetworkPoint',
        ]);

        return view('dashboard.splitters.show', compact('splitter'));
    }

    public function edit(Splitter $splitter)
    {
        $networkPoints = NetworkPoint::orderBy('name')->get();
        $networkInputs = NetworkInput::with('networkPoint')->orderBy('source_name')->get();

        return view('dashboard.splitters.edit', compact('splitter', 'networkPoints', 'networkInputs'));
    }

    public function update(Request $request, Splitter $splitter)
    {
        $request->validate([
            'network_point_id' => 'required|exists:network_points,id',
            'network_input_id' => 'required|exists:network_inputs,id',
            'splitter_name' => 'required|string|max:255',
            'splitter_ratio' => 'required|string|max:50',
            'total_ports' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ], [
            'network_point_id.required' => 'Titik jaringan wajib dipilih.',
            'network_input_id.required' => 'Input redaman wajib dipilih.',
            'splitter_name.required' => 'Nama splitter wajib diisi.',
            'splitter_ratio.required' => 'Jenis splitter wajib dipilih.',
            'total_ports.required' => 'Total port wajib diisi.',
            'total_ports.integer' => 'Total port harus angka.',
            'total_ports.min' => 'Total port minimal 1.',
        ]);

        $oldPorts = $splitter->total_ports;
        $newPorts = (int) $request->total_ports;

        $splitter->update($request->only([
            'network_point_id', 'network_input_id', 'splitter_name',
            'splitter_ratio', 'total_ports', 'description'
        ]));

        // Adjust ports if total_ports changed
        if ($newPorts > $oldPorts) {
            for ($i = $oldPorts + 1; $i <= $newPorts; $i++) {
                SplitterOutput::create([
                    'splitter_id' => $splitter->id,
                    'port_number' => $i,
                    'status' => 'empty',
                ]);
            }
        } elseif ($newPorts < $oldPorts) {
            SplitterOutput::where('splitter_id', $splitter->id)
                ->where('port_number', '>', $newPorts)
                ->delete();
        }

        return redirect()->route('splitters.show', $splitter)->with('success', 'Splitter berhasil diperbarui.');
    }

    public function destroy(Splitter $splitter)
    {
        $splitter->delete();

        return redirect()->route('splitters.index')->with('success', 'Splitter berhasil dihapus.');
    }
}
