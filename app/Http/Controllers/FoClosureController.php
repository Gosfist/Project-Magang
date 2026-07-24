<?php

namespace App\Http\Controllers;

use App\Models\FiberCore;
use App\Models\FiberCoreEndpoint;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Models\FoSplice;
use App\Models\FoSplitter;
use App\Models\FoSplitterOutput;
use App\Services\FiberTopologyService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
        $cables = FoCable::with(
            'cores.endpoints.closure',
            'cores.incomingDirectCores.cable',
            'cores.incomingSplitterOutputs.splitter.core.cable',
            'cores.splitter.outputs.targetClosure',
            'cores.splitter.outputs.targetCore.cable',
            'targetClosure',
            'pairedCable'
        )
            ->where(fn ($query) => $query
                ->where('fo_closure', $closure->fo_closure)
                ->orWhereHas('cores.endpoints', fn ($query) => $query->where('fo_closure', $closure->fo_closure)))
            ->orderBy('nama_kabel')
            ->get();
        $splices = FoSplice::with('coreA.cable', 'coreA.pairedCore', 'coreB.cable', 'coreB.pairedCore')
            ->where('fo_closure', $closure->fo_closure)
            ->orderByDesc('fo_splice')
            ->get();
        $targetCoreOptions = FiberCoreEndpoint::with('fiberCore.cable', 'closure')
            ->whereNotNull('fo_closure')
            ->where('fo_closure', '!=', $closure->fo_closure)
            ->get()
            ->sortBy([
                fn (FiberCoreEndpoint $a, FiberCoreEndpoint $b) => strcmp($a->closure?->nama_cl ?? '', $b->closure?->nama_cl ?? ''),
                fn (FiberCoreEndpoint $a, FiberCoreEndpoint $b) => strcmp($a->fiberCore?->cable?->nama_kabel ?? '', $b->fiberCore?->cable?->nama_kabel ?? ''),
                fn (FiberCoreEndpoint $a, FiberCoreEndpoint $b) => ($a->fiberCore?->nomer_core ?? 0) <=> ($b->fiberCore?->nomer_core ?? 0),
            ]);

        if ($request->is('api/*')) {
            return response()->json(['data' => $closure, 'cables' => $cables]);
        }

        return view('dashboard.fiber.closures.show', [
            'closure' => $closure,
            'closures' => FoClosure::orderBy('nama_cl')->get(),
            'cables' => $cables,
            'splices' => $splices,
            'targetCoreOptions' => $targetCoreOptions,
        ]);
    }

    public function updateCore(Request $request, FoClosure $closure, FiberCore $fiberCore)
    {
        abort_unless($fiberCore->endpoints()->where('fo_closure', $closure->fo_closure)->exists(), 404);

        $data = $request->validate([
            'redaman' => ['required_if:splitter_status,active', 'nullable', 'numeric'],
            'catatan' => ['nullable', 'string'],
            'target_closure' => ['nullable', 'exists:fo_closure,fo_closure'],
            'target_core' => ['nullable', 'exists:fo_core,fo_core'],
            'splitter_form_open' => ['nullable', 'boolean'],
            'splitter_status' => ['required_if:splitter_form_open,1', Rule::in(['active', 'inactive'])],
            'rasio_split' => ['required_if:splitter_status,active', Rule::in(FoSplitter::RATIOS)],
            'outputs' => ['nullable', 'array'],
            'outputs.*.redaman' => ['nullable', 'numeric'],
            'outputs.*.target_closure' => ['nullable', 'exists:fo_closure,fo_closure'],
            'outputs.*.target_core' => ['nullable', 'exists:fo_core,fo_core'],
            'outputs.*.catatan' => ['nullable', 'string'],
        ], [
            'redaman.required_if' => 'Redaman core wajib diisi sebelum splitter diaktifkan.',
        ]);

        $this->validateSplitterOutputTargets($data['outputs'] ?? []);

        $coreData = [
            'redaman' => $data['redaman'] ?? null,
            'catatan' => $data['catatan'] ?? null,
        ];

        if (! empty($data['target_closure']) || ! empty($data['target_core'])) {
            $this->validateCoreTarget($data['target_closure'] ?? null, $data['target_core'] ?? null);

            $coreData['target_closure'] = ($data['target_closure'] ?? null) ?: null;
            $coreData['target_core'] = ($data['target_core'] ?? null) ?: null;
            $coreData['direct_redaman_awal'] = ! empty($data['target_core']) ? ($data['redaman'] ?? null) : null;
        }

        $fiberCore->update($coreData);

        if (! empty($data['splitter_form_open']) && ($data['splitter_status'] ?? null) === 'inactive') {
            $fiberCore->splitter?->delete();
        }

        if (! empty($data['splitter_form_open']) && ($data['splitter_status'] ?? null) === 'active') {
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

    public function storeSplice(Request $request, FoClosure $closure)
    {
        $data = $this->validatedSplice($request, $closure);
        $coreA = FiberCore::findOrFail($data['core_a']);

        $coreA->update(['redaman' => $data['redaman_core_a']]);

        FoSplice::updateOrCreate(
            [
                'fo_closure' => $closure->fo_closure,
                'core_a' => $data['core_a'],
                'core_b' => $data['core_b'],
            ],
            ['catatan' => $data['catatan'] ?? null]
        );

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Splice berhasil disimpan.');
    }

    public function updateSplice(Request $request, FoClosure $closure, FoSplice $splice)
    {
        abort_unless($splice->fo_closure === $closure->fo_closure, 404);

        $data = $this->validatedSplice($request, $closure);
        $coreA = FiberCore::findOrFail($data['core_a']);
        $coreA->update(['redaman' => $data['redaman_core_a']]);

        $splice->update([
            'core_a' => $data['core_a'],
            'core_b' => $data['core_b'],
            'catatan' => $data['catatan'] ?? null,
        ]);

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Splice berhasil diperbarui.');
    }

    public function destroySplice(FoClosure $closure, FoSplice $splice)
    {
        abort_unless($splice->fo_closure === $closure->fo_closure, 404);

        $splice->delete();

        return redirect()->route('fiber.closures.show', $closure)->with('success', 'Splice berhasil dihapus.');
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

        $pairedCore = $fiberCore->pairedCore;
        $pairedCable = $pairedCore?->cable;

        $fiberCore->delete();
        $pairedCore?->delete();

        if ($cable) {
            $remainingCoreCount = $cable->cores()->count();

            if ($remainingCoreCount === 0) {
                $cable->delete();
            } else {
                $cable->update(['jumlah_core' => $remainingCoreCount]);
            }
        }

        if ($pairedCable) {
            $remainingPairedCoreCount = $pairedCable->cores()->count();

            if ($remainingPairedCoreCount === 0) {
                $pairedCable->delete();
            } else {
                $pairedCable->update(['jumlah_core' => $remainingPairedCoreCount]);
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
        $closure->update($this->validated($request, $closure));

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

    private function validated(Request $request, ?FoClosure $closure = null): array
    {
        return $request->validate([
            'nama_cl' => [
                'required',
                'string',
                'max:255',
                Rule::unique('fo_closure', 'nama_cl')->ignore($closure?->fo_closure, 'fo_closure'),
            ],
            'alamat_cl' => ['nullable', 'string'],
            'catatan' => ['nullable', 'string'],
        ], [
            'nama_cl.unique' => 'Nama CL sudah ada.',
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
                    'target_core' => ($output['target_core'] ?? null) ?: null,
                    'catatan' => $output['catatan'] ?? null,
                ]
            );
        }
    }

    private function validateSplitterOutputTargets(array $outputs): void
    {
        $errors = [];

        foreach ($outputs as $index => $output) {
            $targetClosure = $output['target_closure'] ?? null;
            $targetCore = $output['target_core'] ?? null;

            if (! $targetCore) {
                continue;
            }

            if (! $targetClosure) {
                $errors["outputs.{$index}.target_core"] = 'Pilih target CL sebelum memilih core.';
                continue;
            }

            $coreBelongsToClosure = FiberCore::whereKey($targetCore)
                ->whereHas('endpoints', fn ($query) => $query->where('fo_closure', $targetClosure))
                ->exists();

            if (! $coreBelongsToClosure) {
                $errors["outputs.{$index}.target_core"] = 'Core tidak sesuai dengan target CL yang dipilih.';
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function validatedSplice(Request $request, FoClosure $closure): array
    {
        $data = $request->validate([
            'core_a' => ['required', 'exists:fo_core,fo_core'],
            'core_b' => ['required', 'exists:fo_core,fo_core', 'different:core_a'],
            'redaman_core_a' => ['required', 'numeric'],
            'catatan' => ['nullable', 'string'],
        ]);

        foreach (['core_a', 'core_b'] as $field) {
            $coreBelongsToClosure = FiberCore::whereKey($data[$field])
                ->where(fn ($query) => $query
                    ->whereHas('cable', fn ($query) => $query->where('fo_closure', $closure->fo_closure))
                    ->orWhereHas('endpoints', fn ($query) => $query->where('fo_closure', $closure->fo_closure)))
                ->exists();

            if (! $coreBelongsToClosure) {
                throw ValidationException::withMessages([$field => 'Core tidak ada di closure ini.']);
            }
        }

        $coreA = FiberCore::findOrFail($data['core_a']);
        $coreB = FiberCore::findOrFail($data['core_b']);

        if ($coreA->fo_kabel === $coreB->fo_kabel) {
            throw ValidationException::withMessages([
                'core_b' => 'Kabel 2 tidak boleh dari kabel yang sama dengan Kabel 1.',
            ]);
        }

        return $data;
    }

    private function validateCoreTarget(mixed $targetClosure, mixed $targetCore): void
    {
        if (! $targetCore) {
            return;
        }

        if (! $targetClosure) {
            throw ValidationException::withMessages([
                'target_core' => 'Pilih target CL sebelum memilih core.',
            ]);
        }

        $coreBelongsToClosure = FiberCore::whereKey($targetCore)
            ->whereHas('endpoints', fn ($query) => $query->where('fo_closure', $targetClosure))
            ->exists();

        if (! $coreBelongsToClosure) {
            throw ValidationException::withMessages([
                'target_core' => 'Core tidak sesuai dengan target CL yang dipilih.',
            ]);
        }
    }
}
