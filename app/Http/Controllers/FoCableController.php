<?php

namespace App\Http\Controllers;

use App\Models\FiberCore;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Services\FiberTopologyService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FoCableController extends Controller
{
    public function __construct(private readonly FiberTopologyService $topology)
    {
    }

    public function index(Request $request)
    {
        $query = FoCable::withCount('cores');
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q->where('nama_kabel', 'like', "%{$search}%"));
        }

        $cables = $query->orderByDesc('fo_kabel')->paginate((int) $request->input('size', 15))->withQueryString();

        if ($request->is('api/*')) {
            return response()->json($cables);
        }

        return view('dashboard.fiber.cables.index', ['cables' => $cables, 'closures' => FoClosure::orderBy('nama_cl')->get()]);
    }

    public function create()
    {
        return view('dashboard.fiber.cables.form', ['cable' => new FoCable(), 'closures' => FoClosure::orderBy('nama_cl')->get()]);
    }

    public function store(Request $request)
    {
        $cable = $this->topology->createCable($this->validated($request));

        if ($request->is('api/*')) {
            return response()->json(['data' => $cable->load('cores.endpoints')], 201);
        }

        if ($request->input('redirect_to') === 'fiber.closures.show' && $request->filled('redirect_closure_id')) {
            return redirect()->route('fiber.closures.show', $request->redirect_closure_id)->with('success', 'Kabel berhasil dibuat, core dan endpoint otomatis ditambahkan.');
        }

        return redirect()->route('fiber.cables.show', $cable)->with('success', 'Kabel berhasil dibuat.');
    }

    public function show(Request $request, FoCable $cable)
    {
        $cable->load(['cores.endpoints.closure']);
        if ($request->is('api/*')) {
            return response()->json(['data' => $cable]);
        }

        return view('dashboard.fiber.cables.show', compact('cable'));
    }

    public function edit(FoCable $cable)
    {
        return view('dashboard.fiber.cables.form', ['cable' => $cable, 'closures' => FoClosure::orderBy('nama_cl')->get()]);
    }

    public function update(Request $request, FoCable $cable)
    {
        $data = $this->validated($request, $cable);
        unset($data['jumlah_core'], $data['source_closure_id'], $data['destination_closure_id']);
        $cable->update($data);

        return redirect()->route('fiber.cables.show', $cable)->with('success', 'Kabel berhasil diperbarui.');
    }

    public function destroy(Request $request, FoCable $cable)
    {
        $cable->delete();

        return $request->is('api/*') ? response()->json(['message' => 'Cable deleted']) : redirect()->route('fiber.cables.index')->with('success', 'Kabel berhasil dihapus.');
    }

    public function cores(Request $request, FoCable $cable)
    {
        return response()->json(['data' => $cable->load('cores.endpoints.closure')->cores]);
    }

    public function showCore(FiberCore $fiberCore)
    {
        return response()->json(['data' => $fiberCore->load('cable', 'endpoints.closure')]);
    }

    public function updateCore(Request $request, FiberCore $fiberCore)
    {
        $data = $request->validate([
            'redaman' => ['nullable', 'numeric'],
            'warna_core' => ['nullable', 'string', 'max:255'],
            'catatan' => ['nullable', 'string'],
        ]);
        $fiberCore->update($data);

        return response()->json(['data' => $fiberCore->fresh()]);
    }

    private function validated(Request $request, ?FoCable $cable = null): array
    {
        $data = $request->validate([
            'nama_kabel' => ['required', 'string', 'max:255'],
            'jumlah_core' => [$cable ? 'sometimes' : 'required', 'integer', 'min:1'],
            'source_closure_id' => ['nullable', 'exists:fo_closure,fo_closure'],
            'destination_closure_id' => ['nullable', 'exists:fo_closure,fo_closure'],
            'catatan' => ['nullable', 'string'],
        ]);

        $this->ensureCableNameUniqueInClosures($data, $cable);

        return $data;
    }

    private function ensureCableNameUniqueInClosures(array $data, ?FoCable $cable = null): void
    {
        $closureIds = collect([
            $data['source_closure_id'] ?? null,
            $data['destination_closure_id'] ?? null,
        ])->filter()->unique()->values();

        if ($cable && $closureIds->isEmpty()) {
            $closureIds = $cable->cores()
                ->with('endpoints')
                ->get()
                ->flatMap(fn (FiberCore $core) => $core->endpoints->pluck('fo_closure'))
                ->filter()
                ->unique()
                ->values();
        }

        if ($closureIds->isEmpty()) {
            return;
        }

        $query = FoCable::where('nama_kabel', $data['nama_kabel'])
            ->whereHas('cores.endpoints', fn ($query) => $query->whereIn('fo_closure', $closureIds));

        if ($cable) {
            $query->where('fo_kabel', '!=', $cable->fo_kabel);
        }

        if (! $query->exists()) {
            return;
        }

        throw ValidationException::withMessages([
            'nama_kabel' => 'Nama kabel sudah digunakan pada closure ini.',
        ]);
    }
}
