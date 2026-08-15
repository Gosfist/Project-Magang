<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class FiberDashboardController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('fiber.server');
    }

    public function server()
    {
        return $this->listByType('server');
    }

    public function rasio()
    {
        return $this->listByType('rasio');
    }

    public function odc()
    {
        return $this->listByType('odc');
    }

    public function odp()
    {
        return $this->listByType('odp');
    }

    public function store(Request $request, string $type)
    {
        $node = MainCore::create($this->validatedNode($request, $type));

        return $this->responseFor($request, $node, "{$this->typeLabel($type)} berhasil ditambahkan.");
    }

    public function update(Request $request, string $type, MainCore $node)
    {
        abort_unless($node->tipe_titik === $type, 404);

        $node->update($this->validatedNode($request, $type, $node));

        return $this->responseFor($request, $node->fresh('parent'), "{$this->typeLabel($type)} berhasil diperbarui.");
    }

    public function destroy(Request $request, string $type, MainCore $node)
    {
        abort_unless($node->tipe_titik === $type, 404);

        if ($node->children()->exists()) {
            $message = "{$this->typeLabel($type)} masih memiliki anak. Hapus data dari paling bawah terlebih dahulu.";

            if ($request->expectsJson()) {
                return response()->json(['message' => $message], 422);
            }

            return redirect()->route("fiber.$type")->with('error', $message);
        }

        $node->forceDelete();

        if ($request->expectsJson()) {
            return response()->json(['message' => "{$this->typeLabel($type)} berhasil dihapus."]);
        }

        return redirect()->route("fiber.$type")->with('success', "{$this->typeLabel($type)} berhasil dihapus.");
    }

    private function listByType(string $type)
    {
        $allParents = $this->parentOptions($type, true);

        $view = match ($type) {
            'server' => 'dashboard.maincore.data_server',
            'odc' => 'dashboard.maincore.data_odc',
            'odp' => 'dashboard.maincore.data_odp',
            'rasio' => 'dashboard.maincore.data_rasio',
        };

        return view($view, [
            'section' => $type,
            'nodes' => MainCore::with('parent')->type($type)->orderBy('nama_titik')->get(),
            'parents' => $this->parentOptions($type),
            'allParents' => $allParents,
            'existingNames' => MainCore::select('id', 'nama_titik')->orderBy('nama_titik')->get(),
            'labels' => $this->labels(),
        ]);
    }

    private function validatedNode(Request $request, string $type, ?MainCore $node = null): array
    {
        abort_unless(in_array($type, MainCore::TYPES, true), 404);

        $parentTypes = $this->allowedParentTypes($type);
        $parentRule = Rule::exists('main_core', 'id')->where(fn ($query) => $query->whereIn('tipe_titik', $parentTypes));

        $rules = [
            'parent_id' => $type === 'server' ? ['nullable'] : ['required', $parentRule],
            'parent_port_out' => ['nullable', 'integer', 'min:1'],
            'nama_titik' => ['required', 'string', 'max:255', Rule::unique('main_core', 'nama_titik')->ignore($node?->id)],
            'redaman_in' => ['nullable', 'numeric', 'between:-99.99,99.99'],
        ];

        if ($type !== 'server') {
            $rules['alamat'] = ['nullable', 'string'];
        }

        if (in_array($type, ['rasio', 'odc', 'odp'], true)) {
            $ratios = $type === 'odp' ? MainCore::ODP_RATIOS : MainCore::SPLITTER_RATIOS;
            $rules['spesifikasi.jenis_splitter'] = ['required', Rule::in($ratios)];
        }

        if ($type === 'rasio') {
            $rules['spesifikasi.rasio_redaman_ports'] = ['nullable', 'array'];
            $rules['spesifikasi.rasio_redaman_ports.*'] = ['nullable', 'string', 'max:50'];
        }

        $data = $request->validate($rules, [
            'nama_titik.unique' => "{$this->nameLabel($type)} sudah digunakan!",
            'parent_id.required' => 'Sumber jalur wajib dipilih.',
            'spesifikasi.jenis_splitter.required' => 'Jenis splitter wajib dipilih.',
            'spesifikasi.jenis_splitter.in' => $type === 'odp'
                ? 'Jenis splitter hanya boleh 1:2, 1:4, atau 1:8.'
                : 'Jenis splitter hanya boleh 1:2 atau 1:4.',
        ]);

        $parentPortOut = null;

        if ($type !== 'server') {
            $parent = MainCore::with('children')->withCount('children')->find($data['parent_id']);

            if ($parent?->tipe_titik === 'server') {
                $alreadyConnected = $parent->children()
                    ->when($node, fn ($query) => $query->whereKeyNot($node->id))
                    ->exists();

                if ($alreadyConnected) {
                    throw ValidationException::withMessages([
                        'parent_id' => 'Sumber jalur server sudah tersambung ke data lain.',
                    ]);
                }
            } else {
                $outputCount = $parent?->jumlah_output ?? 0;
                $parentPortOut = (int) ($data['parent_port_out'] ?? 0);

                if ($parentPortOut < 1) {
                    throw ValidationException::withMessages([
                        'parent_port_out' => 'Port sumber wajib dipilih.',
                    ]);
                }

                if ($parentPortOut > $outputCount) {
                    throw ValidationException::withMessages([
                        'parent_port_out' => "Port sumber hanya tersedia dari port 1 sampai {$outputCount}.",
                    ]);
                }

                $portUsed = $parent->children()
                    ->where('parent_port_out', $parentPortOut)
                    ->when($node, fn ($query) => $query->whereKeyNot($node->id))
                    ->exists();

                if ($portUsed) {
                    throw ValidationException::withMessages([
                        'parent_port_out' => "Port {$parentPortOut} sudah digunakan.",
                    ]);
                }

                $full = $parent->children()
                    ->when($node, fn ($query) => $query->whereKeyNot($node->id))
                    ->count() >= $outputCount;

                if ($full && $node?->parent_id !== $parent->id) {
                    throw ValidationException::withMessages([
                        'parent_id' => 'Semua port sumber jalur sudah digunakan.',
                    ]);
                }
            }
        }

        $specification = $data['spesifikasi'] ?? null;

        if ($type === 'rasio' && is_array($specification)) {
            $outputCount = (int) str_replace('1:', '', $specification['jenis_splitter'] ?? '0');
            $ports = collect($specification['rasio_redaman_ports'] ?? [])
                ->only(range(1, $outputCount))
                ->map(fn ($value) => is_string($value) ? trim($value) : $value)
                ->filter(fn ($value) => $value !== null && $value !== '')
                ->all();

            unset($specification['rasio_redaman']);
            $specification['rasio_redaman_ports'] = $ports;
        }

        return [
            'parent_id' => $type === 'server' ? null : $data['parent_id'],
            'parent_port_out' => $type === 'server' ? null : $parentPortOut,
            'nama_titik' => $data['nama_titik'],
            'tipe_titik' => $type,
            'redaman_in' => $data['redaman_in'] ?? null,
            'alamat' => $type === 'server' ? null : ($data['alamat'] ?? null),
            'spesifikasi' => $specification,
        ];
    }

    private function responseFor(Request $request, MainCore $node, string $message): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'node' => $node->load('parent'),
            ]);
        }

        return redirect()->route("fiber.{$node->tipe_titik}")->with('success', $message);
    }

    private function parentOptions(string $type, bool $includeConnected = false)
    {
        $types = $this->allowedParentTypes($type);

        if ($types === []) {
            return collect();
        }

        return MainCore::with(['children:id,parent_id,parent_port_out'])
            ->withCount('children')
            ->whereIn('tipe_titik', $types)
            ->orderBy('tipe_titik')
            ->orderBy('nama_titik')
            ->get()
            ->filter(fn (MainCore $parent) => $includeConnected || $this->hasAvailableOutput($parent))
            ->values();
    }

    private function hasAvailableOutput(MainCore $parent): bool
    {
        if ($parent->tipe_titik === 'server') {
            return $parent->children_count === 0;
        }

        $outputCount = $parent->jumlah_output ?? 0;

        return $outputCount > 0 && $parent->children_count < $outputCount;
    }

    private function allowedParentTypes(string $type): array
    {
        return match ($type) {
            'server' => [],
            'rasio' => ['server', 'rasio', 'odc'],
            'odc', 'odp' => ['server', 'rasio', 'odc', 'odp'],
            default => [],
        };
    }

    private function labels(): array
    {
        return [
            'server' => 'Server',
            'rasio' => 'Rasio',
            'odc' => 'ODC',
            'odp' => 'ODP',
        ];
    }

    private function typeLabel(string $type): string
    {
        return $this->labels()[$type] ?? strtoupper($type);
    }

    private function nameLabel(string $type): string
    {
        return match ($type) {
            'server' => 'Nama core',
            'rasio' => 'Nama rasio',
            'odc' => 'Nama ODC',
            'odp' => 'Nama ODP',
            default => 'Nama titik',
        };
    }
}
