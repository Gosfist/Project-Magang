<?php

namespace App\Http\Controllers;

use App\Models\Splitter;
use App\Models\SplitterOutput;
use App\Models\NetworkInput;
use App\Models\MainCore;
use Illuminate\Http\Request;

class SplitterController extends Controller
{
    public function index(Request $request)
    {
        $query = Splitter::with(['mainCore', 'networkInput.mainCore']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('splitter_name', 'like', "%{$search}%")
                  ->orWhere('splitter_ratio', 'like', "%{$search}%")
                  ->orWhereHas('mainCore', function ($sub) use ($search) {
                      $sub->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('main_core_id')) {
            $query->where('main_core_id', $request->main_core_id);
        }

        $splitters = $query->latest()->paginate(15)->withQueryString();
        $mainCores = MainCore::orderBy('name')->get();
        $networkInputs = NetworkInput::with('mainCore')->orderBy('source_name')->get();

        return view('dashboard.splitters.index', compact('splitters', 'mainCores', 'networkInputs'));
    }

    public function create(Request $request)
    {
        return redirect()->route('splitters.index');
    }

    public function store(Request $request)
    {
        $request->validate([
            'main_core_id' => 'required|exists:main_cores,id',
            'network_input_id' => 'required|exists:network_inputs,id',
            'splitter_name' => 'required|string|max:255',
            'splitter_ratio' => 'required|string|max:50',
            'total_ports' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ], [
            'main_core_id.required' => 'Data Closure wajib dipilih.',
            'main_core_id.exists' => 'Data Closure tidak valid.',
            'network_input_id.required' => 'Input redaman wajib dipilih.',
            'splitter_name.required' => 'Nama splitter wajib diisi.',
            'splitter_ratio.required' => 'Jenis splitter wajib dipilih.',
            'total_ports.required' => 'Total port wajib diisi.',
            'total_ports.integer' => 'Total port harus angka.',
            'total_ports.min' => 'Total port minimal 1.',
        ]);

        $this->validateInputBelongsToClosure($request);

        $splitter = Splitter::create($request->only([
            'main_core_id', 'network_input_id', 'splitter_name',
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

        return redirect()->route('splitters.index')->with('success', 'Splitter berhasil ditambahkan dengan ' . $splitter->total_ports . ' port.');
    }

    public function show(Splitter $splitter)
    {
        $splitter->load([
            'mainCore',
            'networkInput',
            'outputs.destinationMainCore',
        ]);
        $mainCores = MainCore::orderBy('name')->get();

        return view('dashboard.splitters.show', compact('splitter', 'mainCores'));
    }

    public function edit(Splitter $splitter)
    {
        return redirect()->route('splitters.index');
    }

    public function update(Request $request, Splitter $splitter)
    {
        $request->validate([
            'main_core_id' => 'required|exists:main_cores,id',
            'network_input_id' => 'required|exists:network_inputs,id',
            'splitter_name' => 'required|string|max:255',
            'splitter_ratio' => 'required|string|max:50',
            'total_ports' => 'required|integer|min:1',
            'description' => 'nullable|string',
        ], [
            'main_core_id.required' => 'Data Closure wajib dipilih.',
            'main_core_id.exists' => 'Data Closure tidak valid.',
            'network_input_id.required' => 'Input redaman wajib dipilih.',
            'splitter_name.required' => 'Nama splitter wajib diisi.',
            'splitter_ratio.required' => 'Jenis splitter wajib dipilih.',
            'total_ports.required' => 'Total port wajib diisi.',
            'total_ports.integer' => 'Total port harus angka.',
            'total_ports.min' => 'Total port minimal 1.',
        ]);

        $this->validateInputBelongsToClosure($request);

        $oldPorts = $splitter->total_ports;
        $newPorts = (int) $request->total_ports;

        $splitter->update($request->only([
            'main_core_id', 'network_input_id', 'splitter_name',
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

        return redirect()->route('splitters.index')->with('success', 'Splitter berhasil diperbarui.');
    }

    private function validateInputBelongsToClosure(Request $request): void
    {
        $exists = NetworkInput::where('id', $request->network_input_id)
            ->where('main_core_id', $request->main_core_id)
            ->exists();

        if (!$exists) {
            back()
                ->withErrors(['network_input_id' => 'Input Redaman harus sesuai dengan Data Closure yang dipilih.'])
                ->withInput()
                ->throwResponse();
        }
    }

    public function destroy(Splitter $splitter)
    {
        $splitter->delete();

        return redirect()->route('splitters.index')->with('success', 'Splitter berhasil dihapus.');
    }
}
