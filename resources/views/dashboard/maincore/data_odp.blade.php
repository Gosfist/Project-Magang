@extends('layouts.dashboard')
@section('page-title', 'Main Core')
@section('content')
    @php
        $section = 'odp';
        $label = 'ODP';
        $nameLabel = 'Nama ODP';
        $formatRedaman = fn($value) => $value === null
            ? '-'
            : rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' dBm';
        $formatTanggal = fn($value) => $value?->format('d-m-Y') ?? '-';
        $ratioOptions = \App\Models\MainCore::ODP_RATIOS;
    @endphp

    <div data-maincore-page data-type="odp" data-row-offset="{{ ($nodes->firstItem() ?? 1) - 1 }}" class="space-y-5">
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div>
                    <h2 class="font-semibold">Data {{ $label }}</h2>

                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <input id="odpSearch" data-table-search type="search" placeholder="Cari nama ODP..."
                        aria-label="Cari berdasarkan nama ODP"
                        class="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200">
                    <button type="button" data-open-modal="createModal"
                        class="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white" style="cursor: pointer;">Tambah Data</button>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full bg-white text-sm">
                    <thead class="border-b border-gray-200 bg-gray-50 text-gray-600">
                        <tr>
                            <th class="w-16 px-5 py-3 text-left">No</th>
                            <th class="px-5 py-3 text-left">Nama ODP</th>
                            <th class="px-5 py-3 text-left">Sumber Jalur</th>
                            <th class="px-5 py-3 text-left">Redaman In</th>
                            <th class="px-5 py-3 text-left">Tanggal</th>
                            <th class="px-5 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody id="nodeRows" class="divide-y divide-gray-200 bg-white">
                        @forelse($nodes as $node)
                            <tr class="bg-white" data-node-row="{{ $node->id }}" data-odp-row data-filter-row
                                data-search-name="{{ mb_strtolower($node->nama_titik) }}">
                                <td class="px-5 py-3" data-row-number>{{ $nodes->firstItem() + $loop->index }}</td>
                                <td class="px-5 py-3 font-medium">{{ $node->nama_titik }}</td>
                                <td class="px-5 py-3">{{ $node->parent?->nama_titik ?? '-' }}</td>
                                <td class="px-5 py-3">{{ $formatRedaman($node->redaman_in) }}</td>
                                <td class="px-5 py-3 whitespace-nowrap">{{ $formatTanggal($node->tanggal) }}</td>
                                <td class="px-5 py-3">
                                    <div class="flex justify-end gap-2 whitespace-nowrap">
                                        <button type="button" data-open-modal="editModal{{ $node->id }}"
                                            class="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-white"
                                            style="cursor: pointer;">Edit</button>
                                        <form data-maincore-form data-confirm="Yakin ingin menghapus data ini?" method="POST"
                                            action="{{ route('api.maincore.destroy', [$section, $node]) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="rounded-lg px-3 py-1.5 text-xs"
                                                style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="px-5 py-8 text-center text-gray-400">Belum ada data ODP.</td>
                            </tr>
                        @endforelse
                        <tr id="noOdpSearchResults" data-filter-empty class="hidden">
                            <td colspan="6" class="px-5 py-8 text-center text-gray-400">Nama ODP tidak ditemukan.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            @if ($nodes->hasPages())
                <div class="border-t border-gray-200 px-5 py-4">
                    {{ $nodes->onEachSide(1)->links('vendor.pagination.main-core') }}
                </div>
            @endif
        </div>
    </div>

    @include('dashboard.modal.data_odp', [
        'modalId' => 'createModal',
        'title' => 'Tambah Data ' . $label,
        'action' => route('api.maincore.store', $section),
        'method' => 'POST',
        'node' => null,
        'mode' => $section . '_create',
        'existingNames' => $existingNames,
        'ratioOptions' => $ratioOptions,
    ])

    @foreach ($nodes as $node)
        @include('dashboard.modal.data_odp', [
            'modalId' => 'editModal' . $node->id,
            'title' => 'Edit Data ' . $label,
            'action' => route('api.maincore.update', [$section, $node]),
            'method' => 'PATCH',
            'node' => $node,
            'mode' => $section . '_edit_' . $node->id,
            'parents' => $allParents->filter(
                fn($parent) => $parent->id !== $node->id && ($parent->id === $node->parent_id ||
                    ($parent->tipe_titik === 'server'
                        ? $parent->children_count === 0
                        : $parent->children_count < ($parent->jumlah_output ?? 0)))),
            'existingNames' => $existingNames,
            'ratioOptions' => $ratioOptions,
        ])
    @endforeach
@endsection
