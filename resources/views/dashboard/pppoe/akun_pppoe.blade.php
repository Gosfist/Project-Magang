@extends('layouts.dashboard')

@section('title', 'Akun PPPoE')
@section('page-title', 'Daftar Akun PPPoE')

@section('content')
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" class="w-full sm:max-w-sm">
            <input name="search" value="{{ request('search') }}" placeholder="Cari pelanggan atau username..."
                class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-300">
        </form>
        <button type="button" data-open-modal="createPppoeAccountModal" @disabled($packages->isEmpty())
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
            <span class="text-lg leading-none">+</span> Tambah Akun
        </button>
    </div>

    @if ($packages->isEmpty())
        <div class="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tambahkan paket PPPoE terlebih dahulu sebelum membuat akun.
        </div>
    @endif

    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <tr>
                        <th class="px-5 py-3 font-medium">Pelanggan</th>
                        <th class="px-5 py-3 font-medium">Username</th>
                        <th class="px-5 py-3 font-medium">Paket</th>
                        <th class="px-5 py-3 font-medium">Nomor Telepon</th>
                        <th class="px-5 py-3 font-medium">Status RADIUS</th>
                        <th class="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($accounts as $account)
                        @php($radiusActive = $account->is_active && $account->package->is_active && (!$account->expires_at || $account->expires_at->endOfDay()->isFuture()))
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                            <td class="px-5 py-3 font-medium text-gray-900">
                                {{ $account->customer_name }}
                            </td>
                            <td class="px-5 py-3 font-mono">{{ $account->username }}</td>
                            <td class="px-5 py-3">
                                {{ $account->package->name }}
                                <p class="text-xs text-gray-400">
                                    {{ $account->package->download_mbps }}/{{ $account->package->upload_mbps }} Mbps</p>
                            </td>
                            <td class="px-5 py-3">{{ $account->phone ?: '-' }}</td>
                            <td class="px-5 py-3">
                                <span
                                    class="rounded-full px-2 py-1 text-xs font-medium {{ $radiusActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700' }}">
                                    {{ $radiusActive ? 'Aktif' : 'Ditolak' }}
                                </span>
                            </td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-2">
                                    <button type="button" data-open-modal="editPppoeAccountModal{{ $account->id }}"
                                        class="rounded-lg p-1.5 text-slate-900 hover:bg-slate-100">Edit</button>
                                    <form method="POST" action="{{ route('pppoe.accounts.destroy', $account) }}"
                                        data-confirm-submit="Yakin ingin menghapus akun PPPoE {{ $account->username }}?">
                                        @csrf @method('DELETE')
                                        <button class="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                            type="submit">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-5 py-8 text-center text-gray-400">Belum ada akun PPPoE.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        @if ($accounts->hasPages())
            <div class="border-t border-gray-200 px-5 py-4">{{ $accounts->links('vendor.pagination.main-core') }}</div>
        @endif
    </div>

    @include('dashboard.modal.pppoe_account', [
        'modalId' => 'createPppoeAccountModal',
        'title' => 'Tambah Akun PPPoE',
        'action' => route('pppoe.accounts.store'),
        'method' => 'POST',
        'mode' => 'account_create',
        'account' => null,
        'packages' => $packages,
    ])

    @foreach ($accounts as $account)
        @include('dashboard.modal.pppoe_account', [
            'modalId' => 'editPppoeAccountModal' . $account->id,
            'title' => 'Edit Akun PPPoE',
            'action' => route('pppoe.accounts.update', $account),
            'method' => 'PUT',
            'mode' => 'account_edit_' . $account->id,
            'account' => $account,
            'packages' => $packages,
        ])
    @endforeach
@endsection
