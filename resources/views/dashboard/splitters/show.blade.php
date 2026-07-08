@extends('layouts.dashboard')
@section('page-title', 'Detail Splitter')
@section('content')
<div class="mb-6"><a href="{{ route('splitters.index') }}" class="text-sm text-blue-600 hover:underline">← Kembali ke Daftar Splitter</a></div>

<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{{ $splitter->splitter_name }}</h2>
        <span class="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">{{ $splitter->splitter_ratio }}</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Titik Jaringan:</span> <a href="{{ route('network-points.show', $splitter->networkPoint) }}" class="font-medium text-blue-600 hover:underline ml-1">{{ $splitter->networkPoint->name }}</a></div>
        <div><span class="text-gray-500">Total Port:</span> <span class="font-medium text-gray-900 ml-1">{{ $splitter->total_ports }} port</span></div>
        <div><span class="text-gray-500">Input:</span> <span class="font-medium text-gray-900 ml-1">{{ $splitter->networkInput->source_name ?? '-' }} ({{ $splitter->networkInput->input_attenuation ?? '-' }} dBm)</span></div>
        <div><span class="text-gray-500">Keterangan:</span> <span class="text-gray-700 ml-1">{{ $splitter->description ?? '-' }}</span></div>
    </div>
</div>

<div class="bg-white rounded-xl border border-gray-200 p-6">
    <h3 class="font-semibold text-gray-900 mb-4">Output Port</h3>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Port</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Tujuan</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Redaman Output</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Selisih</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Status</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Keterangan</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Aksi</th>
            </tr></thead>
            <tbody>
            @foreach($splitter->outputs as $output)
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-2 font-medium text-gray-900">Port {{ $output->port_number }}</td>
                <td class="px-4 py-2 text-gray-600">
                    @if($output->destinationNetworkPoint)
                        <a href="{{ route('network-points.show', $output->destinationNetworkPoint) }}" class="text-blue-600 hover:underline">{{ $output->destinationNetworkPoint->name }}</a>
                    @else
                        <span class="text-gray-400">-</span>
                    @endif
                </td>
                <td class="px-4 py-2 text-right font-mono {{ $output->output_attenuation ? 'text-blue-600' : 'text-gray-400' }}">{{ $output->output_attenuation ? $output->output_attenuation . ' dBm' : '-' }}</td>
                <td class="px-4 py-2 text-right font-mono {{ $output->attenuation_difference ? 'text-orange-600' : 'text-gray-400' }}">{{ $output->attenuation_difference ? $output->attenuation_difference . ' dBm' : '-' }}</td>
                <td class="px-4 py-2">
                    @php $colors = ['active'=>'green','backup'=>'blue','empty'=>'gray','damaged'=>'red','maintenance'=>'yellow']; $c = $colors[$output->status] ?? 'gray'; @endphp
                    <span class="px-2 py-1 text-xs font-medium rounded-full bg-{{ $c }}-100 text-{{ $c }}-700">{{ $output->status_label }}</span>
                </td>
                <td class="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{{ $output->description ?? '-' }}</td>
                <td class="px-4 py-2 text-right">
                    <a href="{{ route('splitter-outputs.edit', $output) }}" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-block" title="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></a>
                </td>
            </tr>
            @endforeach
            </tbody>
        </table>
    </div>
</div>
@endsection
