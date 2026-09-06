@extends('layouts.dashboard')

@section('title', 'Paket PPPoE')
@section('page-title', 'Daftar Paket PPPoE')

@section('content')
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" class="w-full sm:max-w-sm">
            <input name="search" value="{{ request('search') }}" placeholder="Cari nama paket..."
                class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-300">
        </form>
        <button type="button" data-open-modal="createPppoePackageModal"
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-black">
            <span class="text-lg leading-none">+</span> Tambah Paket
        </button>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <tr>
                        <th class="px-5 py-3 font-medium">Nama Paket</th>
                        <th class="px-5 py-3 font-medium">Download / Upload</th>
                        <th class="px-5 py-3 font-medium">Harga</th>
                        <th class="px-5 py-3 font-medium">Pool</th>
                        <th class="px-5 py-3 font-medium">Status</th>
                        <th class="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($packages as $package)
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                            <td class="px-5 py-3 font-medium text-gray-900">
                                {{ $package->name }}
                            </td>
                            <td class="px-5 py-3">{{ $package->download_mbps }} Mbps / {{ $package->upload_mbps }} Mbps</td>
                            <td class="px-5 py-3">Rp {{ number_format($package->price, 0, ',', '.') }}</td>
                            <td class="px-5 py-3">{{ $package->address_pool ?: '-' }}</td>
                            <td class="px-5 py-3">
                                <form method="POST" action="{{ route('pppoe.packages.toggle-status', $package) }}">
                                    @csrf @method('PATCH')
                                    <button type="submit" role="switch"
                                        aria-checked="{{ $package->is_active ? 'true' : 'false' }}"
                                        title="{{ $package->is_active ? 'Nonaktifkan paket' : 'Aktifkan paket' }}"
                                        class="relative inline-flex h-6 w-12 items-center rounded-full transition-colors {{ $package->is_active ? 'bg-emerald-500' : 'bg-red-500' }}">
                                        <span
                                            class="absolute text-[8px] font-bold text-white {{ $package->is_active ? 'left-1.5' : 'right-1.5' }}">
                                            {{ $package->is_active ? 'ON' : 'OFF' }}
                                        </span>
                                        <span
                                            class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform {{ $package->is_active ? 'translate-x-7' : 'translate-x-1' }}"></span>
                                    </button>
                                </form>
                            </td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-2">
                                    <button type="button" data-open-modal="editPppoePackageModal{{ $package->id }}"
                                        class="rounded-lg p-1.5 text-slate-900 hover:bg-slate-100"
                                        title="Edit">Edit</button>
                                    <form method="POST" action="{{ route('pppoe.packages.destroy', $package) }}"
                                        data-confirm-submit="Yakin ingin menghapus paket ini?">
                                        @csrf @method('DELETE')
                                        <button class="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                            type="submit">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-5 py-8 text-center text-gray-400">Belum ada paket PPPoE.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        @if ($packages->hasPages())
            <div class="border-t border-gray-200 px-5 py-4">{{ $packages->links('vendor.pagination.main-core') }}</div>
        @endif
    </div>

    @include('dashboard.modal.pppoe_package', [
        'modalId' => 'createPppoePackageModal',
        'title' => 'Tambah Paket PPPoE',
        'action' => route('pppoe.packages.store'),
        'method' => 'POST',
        'mode' => 'package_create',
        'package' => null,
    ])

    @foreach ($packages as $package)
        @include('dashboard.modal.pppoe_package', [
            'modalId' => 'editPppoePackageModal' . $package->id,
            'title' => 'Edit Paket PPPoE',
            'action' => route('pppoe.packages.update', $package),
            'method' => 'PUT',
            'mode' => 'package_edit_' . $package->id,
            'package' => $package,
        ])
    @endforeach
@endsection
