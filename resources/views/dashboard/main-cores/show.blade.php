@extends('layouts.dashboard')
@section('page-title', 'Detail Main Core')
@section('content')
<div class="mb-6"><a href="{{ route('main-cores.index') }}" class="text-sm text-blue-600 hover:underline">← Kembali ke Daftar Main Core</a></div>
<div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">{{ $mainCore->name }}</h2>
        <span class="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-mono rounded-lg">{{ $mainCore->code }}</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Jumlah Core:</span> <span class="font-medium text-gray-900 ml-1">{{ $mainCore->total_core }} core</span></div>
        <div><span class="text-gray-500">Lokasi Awal:</span> <span class="font-medium text-gray-900 ml-1">{{ $mainCore->start_location ?? '-' }}</span></div>
        <div class="sm:col-span-2"><span class="text-gray-500">Keterangan:</span> <span class="text-gray-700 ml-1">{{ $mainCore->description ?? '-' }}</span></div>
    </div>
</div>
<div class="bg-white rounded-xl border border-gray-200 p-6">
    <h3 class="font-semibold text-gray-900 mb-4">Input Redaman yang Menggunakan Main Core Ini</h3>
    @if($mainCore->networkInputs->count() > 0)
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b"><tr>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Titik Jaringan</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Sumber</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">Warna Core</th>
                <th class="text-left px-4 py-2 text-gray-500 font-medium">No. Core</th>
                <th class="text-right px-4 py-2 text-gray-500 font-medium">Redaman</th>
            </tr></thead>
            <tbody>
            @foreach($mainCore->networkInputs as $input)
            <tr class="border-b border-gray-100">
                <td class="px-4 py-2 text-gray-700">{{ $input->networkPoint->name ?? '-' }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $input->source_name }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $input->cable_color ?? '-' }}</td>
                <td class="px-4 py-2 text-gray-500">{{ $input->core_number ?? '-' }}</td>
                <td class="px-4 py-2 text-right font-mono text-blue-600">{{ $input->input_attenuation }} dBm</td>
            </tr>
            @endforeach
            </tbody>
        </table>
    </div>
    @else
    <p class="text-gray-400 text-sm">Belum ada data input redaman.</p>
    @endif
</div>
@endsection
