@extends('layouts.dashboard')
@section('page-title', 'Data Splitter')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <form method="GET" class="flex flex-wrap gap-2">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari nama splitter..." class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64">
        <select name="network_point_id" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Semua Titik</option>@foreach($networkPoints as $point)<option value="{{ $point->id }}" {{ request('network_point_id') == $point->id ? 'selected' : '' }}>{{ $point->name }}</option>@endforeach</select>
        <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cari</button>
    </form>
    <a href="{{ route('splitters.create') }}" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>Tambah Splitter</a>
</div>
<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Nama Splitter</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Titik Jaringan</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Rasio</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Total Port</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Input</th>
                <th class="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
            </tr></thead>
            <tbody>
                @forelse($splitters as $splitter)
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 font-medium text-gray-900">{{ $splitter->splitter_name }}</td>
                    <td class="px-6 py-3 text-gray-600">{{ $splitter->networkPoint->name ?? '-' }}</td>
                    <td class="px-6 py-3"><span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">{{ $splitter->splitter_ratio }}</span></td>
                    <td class="px-6 py-3 text-gray-600">{{ $splitter->total_ports }} port</td>
                    <td class="px-6 py-3 text-gray-500 text-xs">{{ $splitter->networkInput->source_name ?? '-' }}</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <a href="{{ route('splitters.show', $splitter) }}" class="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Detail"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></a>
                            <a href="{{ route('splitters.edit', $splitter) }}" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></a>
                            <form method="POST" action="{{ route('splitters.destroy', $splitter) }}" onsubmit="return confirm('Yakin? Semua output port juga akan dihapus.')">@csrf @method('DELETE')<button type="submit" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></form>
                        </div>
                    </td>
                </tr>
                @empty
                <tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Belum ada data splitter.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($splitters->hasPages())<div class="px-6 py-3 border-t border-gray-200">{{ $splitters->links() }}</div>@endif
</div>
@endsection
