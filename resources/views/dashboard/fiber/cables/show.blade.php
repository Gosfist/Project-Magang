@extends('layouts.dashboard')
@section('page-title', $cable->nama_kabel . ' - Detail Core')
@section('content')
<div class="bg-white border border-gray-200 rounded-lg p-6 mb-5">
    <h2 class="text-xl font-semibold">{{ $cable->nama_kabel }}</h2>
    <p class="text-sm text-gray-500 mt-1">{{ $cable->jumlah_core }} core @if($cable->catatan)| {{ $cable->catatan }}@endif</p>
</div>
<div class="bg-white border border-gray-200 rounded-lg overflow-x-auto">
    <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500"><tr><th class="text-left px-5 py-3">Core</th><th class="text-left px-5 py-3">Redaman</th><th class="text-left px-5 py-3">Endpoint A</th><th class="text-left px-5 py-3">Endpoint B</th><th class="text-left px-5 py-3">Catatan</th></tr></thead>
        <tbody>
            @foreach($cable->cores as $core)
                @php($a = $core->endpoints->firstWhere('endpoint_side', 'A'))
                @php($b = $core->endpoints->firstWhere('endpoint_side', 'B'))
                <tr class="border-t">
                    <td class="px-5 py-3 font-medium">Core {{ $core->nomer_core }}</td>
                    <td class="px-5 py-3">{{ $core->redaman !== null ? $core->redaman.' dB' : '-' }}</td>
                    <td class="px-5 py-3">{{ $a?->closure?->nama_cl ?? '-' }}</td>
                    <td class="px-5 py-3">{{ $b?->closure?->nama_cl ?? '-' }}</td>
                    <td class="px-5 py-3">{{ $core->catatan ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endsection
