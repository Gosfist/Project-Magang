@extends('layouts.dashboard')
@section('page-title', 'Dashboard')
@section('content')
{{-- Summary Cards --}}
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500">Total Main Core</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ $totalMainCores }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
        </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500">Total Titik Jaringan</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ $totalNetworkPoints }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
            </div>
        </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500">Total Splitter</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">{{ $totalSplitters }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </div>
        </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500">Port Aktif</p>
                <p class="text-2xl font-bold text-green-600 mt-1">{{ $totalPortActive }}</p>
            </div>
            <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
        </div>
    </div>
</div>

{{-- Network Point Types + Port Status --}}
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-900 mb-4">Titik Jaringan per Jenis</h3>
        <div class="space-y-3">
            @foreach([
                ['label' => 'ODC', 'count' => $totalOdc, 'color' => 'blue'],
                ['label' => 'ODP', 'count' => $totalOdp, 'color' => 'green'],
                ['label' => 'Closure', 'count' => $totalClosure, 'color' => 'yellow'],
                ['label' => 'Box Distribusi', 'count' => $totalDistributionBox, 'color' => 'purple'],
            ] as $item)
            <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span class="text-sm text-gray-600">{{ $item['label'] }}</span>
                <span class="px-3 py-1 bg-{{ $item['color'] }}-100 text-{{ $item['color'] }}-700 text-sm font-semibold rounded-lg">{{ $item['count'] }}</span>
            </div>
            @endforeach
        </div>
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-900 mb-4">Status Port</h3>
        <div class="space-y-3">
            @foreach([
                ['label' => 'Aktif', 'count' => $totalPortActive, 'color' => 'green'],
                ['label' => 'Cadangan', 'count' => $totalPortBackup, 'color' => 'blue'],
                ['label' => 'Kosong', 'count' => $totalPortEmpty, 'color' => 'gray'],
                ['label' => 'Rusak', 'count' => $totalPortDamaged, 'color' => 'red'],
                ['label' => 'Maintenance', 'count' => $totalPortMaintenance, 'color' => 'yellow'],
            ] as $item)
            <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span class="text-sm text-gray-600">{{ $item['label'] }}</span>
                <span class="px-3 py-1 bg-{{ $item['color'] }}-100 text-{{ $item['color'] }}-700 text-sm font-semibold rounded-lg">{{ $item['count'] }}</span>
            </div>
            @endforeach
        </div>
    </div>
</div>

@if(auth()->user()->isAdmin())
<div class="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
    <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
        <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
    </div>
    <div>
        <p class="text-sm text-gray-500">Total Petugas</p>
        <p class="text-xl font-bold text-gray-900">{{ $totalPetugas ?? 0 }}</p>
    </div>
</div>
@endif

{{-- Latest Data --}}
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-900 mb-4">Input Redaman Terbaru</h3>
        @if($latestInputs->count() > 0)
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead><tr class="border-b border-gray-200">
                    <th class="text-left py-2 text-gray-500 font-medium">Titik</th>
                    <th class="text-left py-2 text-gray-500 font-medium">Sumber</th>
                    <th class="text-right py-2 text-gray-500 font-medium">Redaman</th>
                </tr></thead>
                <tbody>
                @foreach($latestInputs as $input)
                <tr class="border-b border-gray-100 last:border-0">
                    <td class="py-2 text-gray-700">{{ $input->networkPoint->name ?? '-' }}</td>
                    <td class="py-2 text-gray-500">{{ $input->source_name }}</td>
                    <td class="py-2 text-right font-mono text-blue-600">{{ $input->input_attenuation }} dBm</td>
                </tr>
                @endforeach
                </tbody>
            </table>
        </div>
        @else
        <p class="text-gray-400 text-sm">Belum ada data input redaman.</p>
        @endif
    </div>
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-900 mb-4">Output Redaman Terbaru</h3>
        @if($latestOutputs->count() > 0)
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead><tr class="border-b border-gray-200">
                    <th class="text-left py-2 text-gray-500 font-medium">Splitter</th>
                    <th class="text-left py-2 text-gray-500 font-medium">Port</th>
                    <th class="text-right py-2 text-gray-500 font-medium">Redaman</th>
                </tr></thead>
                <tbody>
                @foreach($latestOutputs as $output)
                <tr class="border-b border-gray-100 last:border-0">
                    <td class="py-2 text-gray-700">{{ $output->splitter->splitter_name ?? '-' }}</td>
                    <td class="py-2 text-gray-500">Port {{ $output->port_number }}</td>
                    <td class="py-2 text-right font-mono text-blue-600">{{ $output->output_attenuation ? $output->output_attenuation . ' dBm' : '-' }}</td>
                </tr>
                @endforeach
                </tbody>
            </table>
        </div>
        @else
        <p class="text-gray-400 text-sm">Belum ada data output redaman.</p>
        @endif
    </div>
</div>
@endsection
