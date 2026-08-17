@extends('layouts.dashboard')
@section('page-title', 'Main Core')
@section('content')
    @php
        $section = 'server';
        $label = 'Server';
        $nameLabel = 'Nama Core';
        $formatRedaman = fn($value) => $value === null
            ? '-'
            : rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' dBm';
        $formatTanggal = fn($value) => $value?->format('d-m-Y') ?? '-';
    @endphp

    <div data-maincore-feature data-api-url="{{ route('api.maincore.index', $section) }}">
    <div data-maincore-page data-type="server" data-row-offset="{{ ($nodes->firstItem() ?? 1) - 1 }}" class="space-y-5">
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div>
                    <h2 class="font-semibold">Data {{ $label }}</h2>

                </div>
                <button type="button" data-open-modal="createModal"
                    class="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white" style="cursor: pointer;">Tambah Data</button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full bg-white text-sm">
                    <thead class="border-b border-gray-200 bg-gray-50 text-gray-600">
                        <tr>
                            <th class="w-16 px-5 py-3 text-left">No</th>
                            <th class="px-5 py-3 text-left">Nama Core</th>
                            <th class="px-5 py-3 text-left">Redaman In</th>
                            <th class="px-5 py-3 text-left">Tanggal</th>
                            <th class="px-5 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody id="nodeRows" class="divide-y divide-gray-200 bg-white">
                        @forelse($nodes as $node)
                            <tr class="bg-white" data-node-row="{{ $node->id }}">
                                <td class="px-5 py-3">{{ $nodes->firstItem() + $loop->index }}</td>
                                <td class="px-5 py-3 font-medium">{{ $node->nama_titik }}</td>
                                <td class="px-5 py-3">{{ $formatRedaman($node->redaman_in) }}</td>
                                <td class="px-5 py-3 whitespace-nowrap">{{ $formatTanggal($node->tanggal) }}</td>
                                <td class="px-5 py-3">
                                    <div class="flex justify-end gap-2 whitespace-nowrap">
                                        {{-- Modal Edit diminta dari API hanya ketika tombol ini diklik. --}}
                                        <button type="button" data-load-edit-modal
                                            data-edit-url="{{ route('api.maincore.edit', [$section, $node]) }}"
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
                                <td colspan="5" class="px-5 py-8 text-center text-gray-400">Belum ada data Server.</td>
                            </tr>
                        @endforelse
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

    @include('dashboard.modal.data_server', [
        'modalId' => 'createModal',
        'title' => 'Tambah Data ' . $label,
        'action' => route('api.maincore.store', $section),
        'method' => 'POST',
        'node' => null,
        'mode' => $section . '_create',
    ])
    </div>
@endsection
