<?php

namespace App\Http\Controllers;

use App\Models\MainCore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MainCoreController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('fiber.server');
    }

    public function traceJalur(Request $request)
    {
        $traceCategories = $this->labels();

        $nodesByCategory = MainCore::query()
            ->select('id', 'nama_titik', 'tipe_titik')
            ->orderBy('nama_titik')
            ->get()
            ->groupBy('tipe_titik')
            ->map(fn ($nodes) => $nodes->values());

        $selectedNode = null;
        $tracePath = collect();
        $tracePaths = collect();
        $traceNodeCount = 0;

        if ($request->filled('category') || $request->filled('node_id')) {
            $data = $request->validate([
                'category' => ['required', Rule::in(array_keys($traceCategories))],
                'node_id' => ['required', 'integer', Rule::exists('main_core', 'id')],
            ], [
                'category.required' => 'Kategori wajib dipilih.',
                'category.in' => 'Kategori tidak valid.',
                'node_id.required' => 'Nama titik wajib dipilih.',
                'node_id.exists' => 'Nama titik tidak ditemukan.',
            ]);

            $selectedNode = MainCore::findOrFail($data['node_id']);

            if ($selectedNode->tipe_titik !== $data['category']) {
                throw ValidationException::withMessages([
                    'node_id' => 'Nama titik tidak sesuai dengan kategori yang dipilih.',
                ]);
            }

            $current = $selectedNode;
            $visited = [];

            while ($current && ! isset($visited[$current->id])) {
                $visited[$current->id] = true;
                $tracePath->prepend($current);
                $current = $current->parent;
            }

            $ancestorPrefix = array_slice($tracePath->values()->all(), 0, -1);
            $tracePaths = collect($this->pathsToLeafNodes($selectedNode))
                ->map(fn (array $descendantPath) => collect(array_merge($ancestorPrefix, $descendantPath)));
            $traceNodeCount = $tracePaths->flatten(1)->unique('id')->count();
        }

        return view('dashboard.maincore.trace_jalur', [
            'nodesByCategory' => $nodesByCategory,
            'selectedNode' => $selectedNode,
            'tracePath' => $tracePath,
            'tracePaths' => $tracePaths,
            'traceNodeCount' => $traceNodeCount,
            'traceCategories' => $traceCategories,
            'labels' => $this->labels(),
        ]);
    }

    /**
     * Build every path from the selected node through its descendants to a leaf node.
     *
     * @return array<int, array<int, MainCore>>
     */
    private function pathsToLeafNodes(MainCore $node, array $visited = []): array
    {
        if (isset($visited[$node->id])) {
            return [];
        }

        $visited[$node->id] = true;
        $children = $node->children->reject(fn (MainCore $child) => isset($visited[$child->id]));

        if ($children->isEmpty()) {
            return [[$node]];
        }

        $paths = [];

        foreach ($children as $child) {
            foreach ($this->pathsToLeafNodes($child, $visited) as $childPath) {
                $paths[] = array_merge([$node], $childPath);
            }
        }

        return $paths ?: [[$node]];
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

    public function apiIndex(Request $request, string $type): JsonResponse
    {
        abort_unless(in_array($type, MainCore::TYPES, true), 404);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $viewData = $this->listData($type, $perPage);
        $nodes = $viewData['nodes'];

        $nodes->getCollection()->each(fn (MainCore $node) => $node->append([
            'jenis_splitter',
            'jumlah_output',
            'rasio_redaman',
            'rasio_redaman_ports',
        ]));

        $payload = [
            'meta' => [
                'current_page' => $nodes->currentPage(),
                'last_page' => $nodes->lastPage(),
                'per_page' => $nodes->perPage(),
                'total' => $nodes->total(),
            ],
        ];

        if ($request->boolean('fragment')) {
            // Fragmen sudah memuat lima baris aktif, jadi data JSON tidak dikirim ulang dua kali.
            $sections = view($this->viewForType($type), $viewData)->renderSections();
            $payload['fragment'] = $sections['content'] ?? '';
        } else {
            // Endpoint data biasa tetap menyediakan record JSON untuk pemakai API lainnya.
            $payload['data'] = $nodes->items();
        }

        return response()->json($payload);
    }

    public function apiParents(Request $request, string $type): JsonResponse
    {
        abort_unless(in_array($type, MainCore::TYPES, true), 404);

        // Validasi kategori dan kata kunci sebelum menjalankan pencarian parent.
        $data = $request->validate([
            'category' => ['required', Rule::in($this->allowedParentTypes($type))],
            'search' => ['nullable', 'string', 'max:100'],
            'current_node_id' => ['nullable', 'integer', Rule::exists('main_core', 'id')],
            'current_parent_id' => ['nullable', 'integer', Rule::exists('main_core', 'id')],
        ]);

        $currentNodeId = (int) ($data['current_node_id'] ?? 0);
        $currentParentId = (int) ($data['current_parent_id'] ?? 0);

        // Ambil kandidat terbatas agar pencarian tetap ringan walaupun tabel berisi ribuan data.
        $parents = MainCore::query()
            ->with(['children:id,parent_id,parent_port_out'])
            ->withCount('children')
            ->where('tipe_titik', $data['category'])
            ->when(filled($data['search'] ?? null), fn ($query) => $query
                ->where('nama_titik', 'like', '%'.$data['search'].'%'))
            ->when($currentNodeId > 0, fn ($query) => $query->whereKeyNot($currentNodeId))
            ->orderBy('nama_titik')
            ->limit(60)
            ->get()
            // Hanya tampilkan sumber yang masih mempunyai port kosong.
            // Parent aktif tetap ditampilkan ketika pengguna sedang mengedit data.
            ->filter(fn (MainCore $parent) => $parent->id === $currentParentId
                || $this->hasAvailableOutput($parent))
            ->take(20)
            ->values()
            ->map(function (MainCore $parent) use ($currentNodeId) {
                // Port milik node yang sedang diedit tidak dihitung sebagai port terpakai.
                $usedPorts = $parent->children
                    ->reject(fn (MainCore $child) => $child->id === $currentNodeId)
                    ->pluck('parent_port_out')
                    ->filter()
                    ->values();

                return [
                    'id' => $parent->id,
                    'name' => $parent->nama_titik,
                    'type' => $parent->tipe_titik,
                    'redaman_in' => $parent->redaman_in !== null ? (float) $parent->redaman_in : null,
                    'splitter_ratio' => $parent->jenis_splitter,
                    'rasio_redaman_ports' => $parent->rasio_redaman_ports,
                    'output_count' => $parent->jumlah_output ?? 0,
                    'used_ports' => $usedPorts,
                ];
            });

        return response()->json(['data' => $parents]);
    }

    public function apiEdit(string $type, MainCore $node): JsonResponse
    {
        abort_unless($node->tipe_titik === $type, 404);

        // Modal Edit dimuat satu kali saat tombol Edit ditekan, bukan untuk setiap baris tabel.
        $node->load(['parent.children:id,parent_id,parent_port_out']);
        $fragment = view($this->modalViewForType($type), $this->editModalData($type, $node))->render();

        return response()->json(['fragment' => $fragment]);
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

        $connectedChildren = $node->children()->pluck('nama_titik');

        if ($connectedChildren->isNotEmpty()) {
            $childNames = $connectedChildren->join(', ', ' dan ');
            $message = "{$this->typeLabel($type)} tidak dapat dihapus karena masih terhubung dengan {$childNames}.";

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
        return view($this->viewForType($type), $this->listData($type));
    }

    private function listData(string $type, int $perPage = 5): array
    {
        // Siapkan hanya data yang dibutuhkan oleh fitur Main Core yang sedang dibuka.
        return [
            'section' => $type,
            'nodes' => MainCore::with('parent')
                ->type($type)
                ->orderBy('nama_titik')
                ->paginate($perPage)
                ->withPath(route("fiber.$type")),
            'labels' => $this->labels(),
        ];
    }

    private function viewForType(string $type): string
    {
        return match ($type) {
            'server' => 'dashboard.maincore.data_server',
            'odc' => 'dashboard.maincore.data_odc',
            'odp' => 'dashboard.maincore.data_odp',
            'rasio' => 'dashboard.maincore.data_rasio',
        };
    }

    private function modalViewForType(string $type): string
    {
        return match ($type) {
            'server' => 'dashboard.modal.data_server',
            'odc' => 'dashboard.modal.data_odc',
            'odp' => 'dashboard.modal.data_odp',
            'rasio' => 'dashboard.modal.data_rasio',
        };
    }

    private function editModalData(string $type, MainCore $node): array
    {
        // Susun data kecil yang diperlukan satu modal Edit sesuai jenis fiturnya.
        return [
            'section' => $type,
            'modalId' => 'editModal'.$node->id,
            'title' => 'Edit Data '.$this->typeLabel($type),
            'action' => route('api.maincore.update', [$type, $node]),
            'method' => 'PATCH',
            'node' => $node,
            'mode' => $type.'_edit_'.$node->id,
            'nameLabel' => $this->nameLabel($type),
            'labels' => $this->labels(),
            'ratioOptions' => $this->splitterRatios($type),
        ];
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
            'jarak_kabel' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
        ];

        if ($type !== 'server') {
            $rules['alamat'] = ['required', 'string', 'max:1000'];
        }

        if (in_array($type, ['odc', 'odp'], true)) {
            $ratios = $this->splitterRatios($type);
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
            'spesifikasi.jenis_splitter.in' => in_array($type, ['odc', 'odp'], true)
                ? 'Jenis splitter hanya boleh 1:2, 1:4, atau 1:8.'
                : 'Jenis splitter hanya boleh 1:2 atau 1:4.',
        ]);

        if ($type === 'rasio') {
            $data['spesifikasi'] = is_array($data['spesifikasi'] ?? null) ? $data['spesifikasi'] : [];
            $data['spesifikasi']['rasio_redaman_ports'] = $this->validatedRasioPorts(
                $data['spesifikasi']['rasio_redaman_ports'] ?? [],
            );
        }

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

        $redamanIn = $data['redaman_in'] ?? null;

        if ($type !== 'server' && $redamanIn === null && isset($data['jarak_kabel'])) {
            $sourceRedaman = (float) ($parent?->redaman_in ?? 0);
            $splitterLoss = $parent?->splitterLossForPort($parentPortOut) ?? 0;
            $cableLoss = ((float) $data['jarak_kabel'] / 1000) * MainCore::CABLE_LOSS_DB_PER_KM;
            $connectorLoss = $type === 'odp' && $parent?->tipe_titik === 'odc'
                ? MainCore::ODC_TO_ODP_CONNECTOR_PAIRS * MainCore::CONNECTOR_LOSS_DB_PER_PAIR
                : 0;
            $redamanIn = round($sourceRedaman - $splitterLoss - $cableLoss - $connectorLoss, 2);
        }

        if ($type === 'rasio') {
            $specification = is_array($specification) ? $specification : [];
            $outputCount = 2;
            $ports = collect($specification['rasio_redaman_ports'] ?? [])
                ->only(range(1, $outputCount))
                ->map(fn ($value) => is_string($value) ? trim($value) : $value)
                ->filter(fn ($value) => $value !== null && $value !== '')
                ->all();

            unset($specification['rasio_redaman']);
            $specification['jenis_splitter'] = MainCore::RASIO_SPLITTER;
            $specification['rasio_redaman_ports'] = $ports;
        }

        return [
            'parent_id' => $type === 'server' ? null : $data['parent_id'],
            'parent_port_out' => $type === 'server' ? null : $parentPortOut,
            'nama_titik' => $data['nama_titik'],
            'tipe_titik' => $type,
            'redaman_in' => $redamanIn,
            'jarak_kabel' => $type === 'server' ? null : ($data['jarak_kabel'] ?? null),
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

    private function allowedParentTypes(string $type): array
    {
        return match ($type) {
            'server' => [],
            'rasio', 'odc', 'odp' => MainCore::TYPES,
            default => [],
        };
    }

    private function hasAvailableOutput(MainCore $parent): bool
    {
        if ($parent->tipe_titik === 'server') {
            return $parent->children_count === 0;
        }

        $outputCount = $parent->jumlah_output ?? 0;

        return $outputCount > 0 && $parent->children_count < $outputCount;
    }

    private function splitterRatios(string $type): array
    {
        return match ($type) {
            'odc' => MainCore::ODC_RATIOS,
            'odp' => MainCore::ODP_RATIOS,
            default => [MainCore::RASIO_SPLITTER],
        };
    }

    private function validatedRasioPorts(array $ports): array
    {
        $firstValue = $ports[1] ?? null;
        $secondValue = $ports[2] ?? null;
        $hasSubmittedValue = filled($firstValue) || filled($secondValue);

        if (! $hasSubmittedValue) {
            return [1 => '10%', 2 => '90%'];
        }

        $firstPercentage = MainCore::parsePercentage($firstValue);
        $secondPercentage = MainCore::parsePercentage($secondValue);
        $errors = [];

        if ($firstPercentage === null) {
            $errors['spesifikasi.rasio_redaman_ports.1'] = 'Persentase Port 1 harus lebih dari 0 sampai 100.';
        }

        if ($secondPercentage === null) {
            $errors['spesifikasi.rasio_redaman_ports.2'] = 'Persentase Port 2 harus lebih dari 0 sampai 100.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        if (abs($firstPercentage + $secondPercentage - 100) > 0.001) {
            throw ValidationException::withMessages([
                'spesifikasi.rasio_redaman_ports.1' => 'Total persentase Port 1 dan Port 2 harus 100%.',
                'spesifikasi.rasio_redaman_ports.2' => 'Total persentase Port 1 dan Port 2 harus 100%.',
            ]);
        }

        return [
            1 => $this->formatPercentage($firstPercentage),
            2 => $this->formatPercentage($secondPercentage),
        ];
    }

    private function formatPercentage(float $percentage): string
    {
        return rtrim(rtrim(number_format($percentage, 2, '.', ''), '0'), '.').'%';
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
