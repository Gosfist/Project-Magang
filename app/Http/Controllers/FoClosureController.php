<?php

namespace App\Http\Controllers;

use App\Models\FiberCore;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Models\FoSplitter;
use App\Models\FoSplitterOutput;
use App\Services\FiberTopologyService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FoClosureController extends Controller
{
    public function __construct(private readonly FiberTopologyService $topology)
    {
    }

    public function index(Request $request)
    {
        $query = FoClosure::query();
        $this->applySearch($query, $request);
        $closures = $query->orderByDesc('fo_closure')->paginate((int) $request->input('size', 15))->withQueryString();

        if ($request->is('api/*')) {
            return response()->json($closures);
        }

        return view('dashboard.fiber.closures.index', compact('closures'));
    }

    public function create()
    {
        return view('dashboard.fiber.closures.form', ['closure' => new FoClosure()]);
    }

    public function store(Request $request)
    {
        $closure = FoClosure::create($this->validated($request));

        if ($request->is('api/*')) {
            return response()->json(['data' => $closure], 201);
        }

        if ($request->input('redirect_to') === 'fiber.dashboard') {
            return redirect()->route('fiber.dashboard')->with('success', 'Closure berhasil ditambahkan.');
        }

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Closure berhasil ditambahkan.');
    }

    public function show(Request $request, FoClosure $closure)
    {
        $cables = FoCable::with('cores.endpoints.closure', 'cores.splitter.outputs.targetClosure')
            ->whereHas('cores.endpoints', fn ($query) => $query->where('fo_closure', $closure->fo_closure))
            ->orderBy('nama_kabel')
            ->get();

        if ($request->is('api/*')) {
            return response()->json(['data' => $closure, 'cables' => $cables]);
        }

        return view('dashboard.fiber.closures.show', [
            'closure' => $closure,
            'closures' => FoClosure::orderBy('nama_cl')->get(),
            'cables' => $cables,
        ]);
    }

    public function updateCore(Request $request, FoClosure $closure, FiberCore $fiberCore)
    {
        abort_unless($fiberCore->endpoints()->where('fo_closure', $closure->fo_closure)->exists(), 404);

        $data = $request->validate([
            'redaman' => ['nullable', 'numeric'],
            'catatan' => ['nullable', 'string'],
            'add_splitter' => ['nullable', 'boolean'],
            'rasio_split' => ['required_if:add_splitter,1', Rule::in(FoSplitter::RATIOS)],
            'outputs' => ['nullable', 'array'],
            'outputs.*.redaman' => ['nullable', 'numeric'],
            'outputs.*.target_closure' => ['nullable', 'exists:fo_closure,fo_closure'],
            'outputs.*.catatan' => ['nullable', 'string'],
        ]);

        $fiberCore->update([
            'redaman' => $data['redaman'] ?? null,
            'catatan' => $data['catatan'] ?? null,
        ]);

        if (! empty($data['add_splitter'])) {
            $splitter = FoSplitter::updateOrCreate(
                ['fo_core' => $fiberCore->fo_core],
                [
                    'fo_closure' => $closure->fo_closure,
                    'rasio_split' => $data['rasio_split'],
                ]
            );

            $this->syncSplitterOutputs($splitter, $data['rasio_split'], $data['outputs'] ?? []);
        }

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Core berhasil diperbarui.');
    }

    public function storeCore(Request $request, FoClosure $closure)
    {
        $data = $request->validate([
            'fo_kabel' => ['required', 'exists:fo_kabel,fo_kabel'],
            'jumlah_core' => ['required', 'integer', 'min:1'],
        ]);

        $cable = FoCable::whereKey($data['fo_kabel'])
            ->whereHas('cores.endpoints', fn ($query) => $query->where('fo_closure', $closure->fo_closure))
            ->firstOrFail();

        $this->topology->addCoreToCable($cable, (int) $data['jumlah_core'], $closure->fo_closure);

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Core berhasil ditambahkan.');
    }

    public function destroyCore(FoClosure $closure, FiberCore $fiberCore)
    {
        abort_unless($fiberCore->endpoints()->where('fo_closure', $closure->fo_closure)->exists(), 404);

        $cable = $fiberCore->cable;
        $lastCoreNumber = (int) $cable?->cores()->max('nomer_core');

        if ($fiberCore->nomer_core !== $lastCoreNumber) {
            return redirect()
                ->route('fiber.closures.show', $closure)
                ->withErrors(['core' => 'Core tidak bisa dihapus karena masih ada core setelahnya. Hapus core terakhir terlebih dahulu.']);
        }

        $fiberCore->delete();

        if ($cable) {
            $remainingCoreCount = $cable->cores()->count();

            if ($remainingCoreCount === 0) {
                $cable->delete();
            } else {
                $cable->update(['jumlah_core' => $remainingCoreCount]);
            }
        }

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Core berhasil dihapus.');
    }

    public function edit(FoClosure $closure)
    {
        return view('dashboard.fiber.closures.form', compact('closure'));
    }

    public function update(Request $request, FoClosure $closure)
    {
        $closure->update($this->validated($request));

        if ($request->is('api/*')) {
            return response()->json(['data' => $closure]);
        }

        if ($request->input('redirect_to') === 'fiber.dashboard') {
            return redirect()->route('fiber.dashboard')->with('success', 'Closure berhasil diperbarui.');
        }

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Closure berhasil diperbarui.');
    }

    public function destroy(Request $request, FoClosure $closure)
    {
        $closure->delete();

        return $request->is('api/*')
            ? response()->json(['message' => 'Closure deleted'])
            : redirect()->route($request->input('redirect_to') === 'fiber.dashboard' ? 'fiber.dashboard' : 'fiber.closures.index')->with('success', 'Closure berhasil dihapus.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'nama_cl' => ['required', 'string', 'max:255'],
            'alamat_cl' => ['nullable', 'string'],
            'catatan' => ['nullable', 'string'],
        ]);
    }

    private function applySearch($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q->where('nama_cl', 'like', "%{$search}%")->orWhere('alamat_cl', 'like', "%{$search}%"));
        }
    }

    private function syncSplitterOutputs(FoSplitter $splitter, string $ratio, array $outputs): void
    {
        $outputCount = (int) str_replace('1:', '', $ratio);
        $splitter->outputs()->where('nomor_output', '>', $outputCount)->delete();

        for ($i = 1; $i <= $outputCount; $i++) {
            $output = $outputs[$i] ?? [];

            FoSplitterOutput::updateOrCreate(
                ['fo_splitter' => $splitter->fo_splitter, 'nomor_output' => $i],
                [
                    'redaman' => $output['redaman'] ?? null,
                    'target_closure' => ($output['target_closure'] ?? null) ?: null,
                    'catatan' => $output['catatan'] ?? null,
                ]
            );
        }
    }
}
