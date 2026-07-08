<?php

namespace App\Http\Controllers;

use App\Models\NetworkPoint;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NetworkPointController extends Controller
{
    public function index(Request $request)
    {
        $query = NetworkPoint::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $networkPoints = $query->latest()->paginate(15)->withQueryString();

        return view('dashboard.network-points.index', compact('networkPoints'));
    }

    public function create()
    {
        return view('dashboard.network-points.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:255|unique:network_points,code',
            'type' => 'required|in:odc,odp,closure,distribution_box,other',
            'location' => 'required|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'description' => 'nullable|string',
        ], [
            'name.required' => 'Nama titik jaringan wajib diisi.',
            'code.required' => 'Kode titik jaringan wajib diisi.',
            'code.unique' => 'Kode titik jaringan sudah digunakan.',
            'type.required' => 'Jenis titik jaringan wajib dipilih.',
            'type.in' => 'Jenis titik jaringan tidak valid.',
            'location.required' => 'Lokasi wajib diisi.',
        ]);

        NetworkPoint::create($request->only(['name', 'code', 'type', 'location', 'latitude', 'longitude', 'description']));

        return redirect()->route('network-points.index')->with('success', 'Titik Jaringan berhasil ditambahkan.');
    }

    public function show(NetworkPoint $networkPoint)
    {
        $networkPoint->load([
            'networkInputs.mainCore',
            'networkInputs.splitters.outputs.destinationNetworkPoint',
            'splitters.outputs.destinationNetworkPoint',
            'splitters.networkInput',
            'incomingOutputs.splitter.networkPoint',
        ]);

        return view('dashboard.network-points.show', compact('networkPoint'));
    }

    public function edit(NetworkPoint $networkPoint)
    {
        return view('dashboard.network-points.edit', compact('networkPoint'));
    }

    public function update(Request $request, NetworkPoint $networkPoint)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => ['required', 'string', 'max:255', Rule::unique('network_points')->ignore($networkPoint->id)],
            'type' => 'required|in:odc,odp,closure,distribution_box,other',
            'location' => 'required|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'description' => 'nullable|string',
        ], [
            'name.required' => 'Nama titik jaringan wajib diisi.',
            'code.required' => 'Kode titik jaringan wajib diisi.',
            'code.unique' => 'Kode titik jaringan sudah digunakan.',
            'type.required' => 'Jenis titik jaringan wajib dipilih.',
            'type.in' => 'Jenis titik jaringan tidak valid.',
            'location.required' => 'Lokasi wajib diisi.',
        ]);

        $networkPoint->update($request->only(['name', 'code', 'type', 'location', 'latitude', 'longitude', 'description']));

        return redirect()->route('network-points.index')->with('success', 'Titik Jaringan berhasil diperbarui.');
    }

    public function destroy(NetworkPoint $networkPoint)
    {
        $networkPoint->delete();

        return redirect()->route('network-points.index')->with('success', 'Titik Jaringan berhasil dihapus.');
    }
}
