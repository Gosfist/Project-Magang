@extends('layouts.dashboard')
@section('page-title', 'Data Output Splitter')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <form method="GET" class="flex flex-wrap gap-2">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari splitter atau tujuan..." class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64">
        <select name="status" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Semua Status</option>@foreach(\App\Models\SplitterOutput::STATUS_LABELS as $val => $label)<option value="{{ $val }}" {{ request('status') == $val ? 'selected' : '' }}>{{ $label }}</option>@endforeach</select>
        <select name="splitter_id" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Semua Splitter</option>@foreach($splitters as $s)<option value="{{ $s->id }}" {{ request('splitter_id') == $s->id ? 'selected' : '' }}>{{ $s->splitter_name }} ({{ $s->networkPoint->name ?? '' }})</option>@endforeach</select>
        <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cari</button>
    </form>
</div>
<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Splitter</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Port</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Tujuan</th>
                <th class="text-right px-6 py-3 text-gray-500 font-medium">Redaman Output</th>
                <th class="text-right px-6 py-3 text-gray-500 font-medium">Selisih</th>
                <th class="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                <th class="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
            </tr></thead>
            <tbody>
                @forelse($splitterOutputs as $output)
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-700"><a href="{{ route('splitters.show', $output->splitter_id) }}" class="text-blue-600 hover:underline">{{ $output->splitter->splitter_name ?? '-' }}</a></td>
                    <td class="px-6 py-3 font-medium text-gray-900">Port {{ $output->port_number }}</td>
                    <td class="px-6 py-3 text-gray-600">{{ $output->destinationNetworkPoint->name ?? '-' }}</td>
                    <td class="px-6 py-3 text-right font-mono text-blue-600">{{ $output->output_attenuation ? $output->output_attenuation . ' dBm' : '-' }}</td>
                    <td class="px-6 py-3 text-right font-mono text-orange-600">{{ $output->attenuation_difference ? $output->attenuation_difference . ' dBm' : '-' }}</td>
                    <td class="px-6 py-3">@php $c = \App\Models\SplitterOutput::STATUS_COLORS[$output->status] ?? 'gray'; @endphp<span class="px-2 py-1 text-xs font-medium rounded-full bg-{{ $c }}-100 text-{{ $c }}-700">{{ $output->status_label }}</span></td>
                    <td class="px-6 py-3 text-right"><a href="{{ route('splitter-outputs.edit', $output) }}" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-block"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></a></td>
                </tr>
                @empty
                <tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">Belum ada data output splitter.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($splitterOutputs->hasPages())<div class="px-6 py-3 border-t border-gray-200">{{ $splitterOutputs->links() }}</div>@endif
</div>
@endsection
