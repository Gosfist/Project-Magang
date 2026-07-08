@extends('layouts.dashboard')
@section('page-title', 'Detail Titik Jaringan')
@section('content')
<div class="mb-6"><a href="{{ route('network-points.index') }}" class="text-sm text-blue-600 hover:underline">← Kembali ke Daftar Titik Jaringan</a></div>

<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{{ $networkPoint->name }}</h2>
        <div class="flex items-center gap-2">
            <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">{{ $networkPoint->type_label }}</span>
            <span class="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-mono rounded-lg">{{ $networkPoint->code }}</span>
        </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Lokasi:</span> <span class="font-medium text-gray-900 ml-1">{{ $networkPoint->location }}</span></div>
        @if($networkPoint->latitude && $networkPoint->longitude)
        <div><span class="text-gray-500">Koordinat:</span> <span class="font-medium text-gray-900 ml-1">{{ $networkPoint->latitude }}, {{ $networkPoint->longitude }}</span></div>
        @endif
        <div class="sm:col-span-2"><span class="text-gray-500">Keterangan:</span> <span class="text-gray-700 ml-1">{{ $networkPoint->description ?? '-' }}</span></div>
    </div>
</div>

{{-- Input Redaman --}}
<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900">Input Redaman</h3>
        <a href="{{ route('network-inputs.create', ['network_point_id' => $networkPoint->id]) }}" class="text-sm text-blue-600 hover:underline">+ Tambah Input</a>
    </div>
    @if($networkPoint->networkInputs->count() > 0)
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Sumber</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Main Core</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Warna/No Core</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Redaman</th>
            </tr></thead>
            <tbody>
            @foreach($networkPoint->networkInputs as $input)
            <tr class="border-b border-gray-100">
                <td class="px-4 py-2 text-gray-700">{{ $input->source_name }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $input->mainCore->name ?? '-' }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $input->cable_color ?? '' }}{{ $input->core_number ? ' #'.$input->core_number : '' }}</td>
                <td class="px-4 py-2 text-right font-mono text-blue-600">{{ $input->input_attenuation }} dBm</td>
            </tr>
            @endforeach
            </tbody>
        </table>
    </div>
    @else
    <p class="text-gray-400 text-sm">Belum ada input redaman.</p>
    @endif
</div>

{{-- Splitters --}}
<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900">Splitter</h3>
        <a href="{{ route('splitters.create', ['network_point_id' => $networkPoint->id]) }}" class="text-sm text-blue-600 hover:underline">+ Tambah Splitter</a>
    </div>
    @if($networkPoint->splitters->count() > 0)
    @foreach($networkPoint->splitters as $splitter)
    <div class="mb-6 last:mb-0 border border-gray-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
            <div>
                <h4 class="font-medium text-gray-900">{{ $splitter->splitter_name }}</h4>
                <p class="text-xs text-gray-500">Rasio: {{ $splitter->splitter_ratio }} | {{ $splitter->total_ports }} Port | Input: {{ $splitter->networkInput->source_name ?? '-' }}</p>
            </div>
            <a href="{{ route('splitters.show', $splitter) }}" class="text-sm text-blue-600 hover:underline">Lihat Detail →</a>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            @foreach($splitter->outputs as $output)
            <div class="p-2 rounded-lg border text-xs {{ $output->status == 'active' ? 'bg-green-50 border-green-200' : ($output->status == 'backup' ? 'bg-blue-50 border-blue-200' : ($output->status == 'damaged' ? 'bg-red-50 border-red-200' : ($output->status == 'maintenance' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'))) }}">
                <span class="font-medium">Port {{ $output->port_number }}</span>
                <span class="block text-gray-500 truncate">{{ $output->destinationNetworkPoint->name ?? $output->status_label }}</span>
                @if($output->output_attenuation)<span class="font-mono text-blue-600">{{ $output->output_attenuation }} dBm</span>@endif
            </div>
            @endforeach
        </div>
    </div>
    @endforeach
    @else
    <p class="text-gray-400 text-sm">Belum ada splitter.</p>
    @endif
</div>

{{-- Incoming Connections --}}
@if($networkPoint->incomingOutputs->count() > 0)
<div class="bg-white rounded-xl border border-gray-200 p-6">
    <h3 class="font-semibold text-gray-900 mb-4">Koneksi Masuk (dari splitter lain)</h3>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Dari Titik</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Splitter</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Port</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Redaman Output</th>
            </tr></thead>
            <tbody>
            @foreach($networkPoint->incomingOutputs as $output)
            <tr class="border-b border-gray-100">
                <td class="px-4 py-2 text-gray-700">{{ $output->splitter->networkPoint->name ?? '-' }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $output->splitter->splitter_name ?? '-' }}</td>
                <td class="px-4 py-2 text-gray-500">Port {{ $output->port_number }}</td>
                <td class="px-4 py-2 text-right font-mono text-blue-600">{{ $output->output_attenuation }} dBm</td>
            </tr>
            @endforeach
            </tbody>
        </table>
    </div>
</div>
@endif
@endsection
