@extends('layouts.dashboard')
@section('page-title', 'Dashboard')
@section('content')
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    @foreach([
        ['label' => 'Total CL', 'count' => $totalClosures],
        ['label' => 'Total Kabel', 'count' => $totalCables],
        ['label' => 'Total Core', 'count' => $totalCores],
        ['label' => 'Core Ada Redaman', 'count' => $totalCoreWithRedaman],
    ] as $item)
        <div class="bg-white rounded-lg border border-gray-200 p-5">
            <p class="text-sm text-gray-500">{{ $item['label'] }}</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ $item['count'] }}</p>
        </div>
    @endforeach
</div>

@if(auth()->user()->isAdmin())
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 p-5">
        <p class="text-sm text-gray-500">Total Petugas</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ $totalPetugas ?? 0 }}</p>
    </div>
    <div class="bg-white rounded-lg border border-gray-200 p-5">
        <p class="text-sm text-gray-500">Total User</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ $totalUsers ?? 0 }}</p>
    </div>
</div>
@endif
@endsection
