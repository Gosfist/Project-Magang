@extends('layouts.dashboard')
@section('page-title', 'Kabel FO')
@section('content')
<div class="flex justify-between gap-3 mb-5">
    <form method="GET" class="flex gap-2"><input name="search" value="{{ request('search') }}" class="px-4 py-2 border rounded-lg text-sm" placeholder="Cari kabel"><button class="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cari</button></form>
    <a href="{{ route('fiber.cables.create') }}" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Tambah Kabel</a>
</div>
<div class="bg-white border border-gray-200 rounded-lg overflow-x-auto">
    <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500"><tr><th class="text-left px-5 py-3">Nama Kabel</th><th class="text-left px-5 py-3">Jumlah Core</th><th class="text-left px-5 py-3">Catatan</th><th class="text-right px-5 py-3">Aksi</th></tr></thead>
        <tbody>@forelse($cables as $cable)<tr class="border-t"><td class="px-5 py-3 font-medium">{{ $cable->nama_kabel }}</td><td class="px-5 py-3">{{ $cable->jumlah_core }}</td><td class="px-5 py-3">{{ $cable->catatan ?? '-' }}</td><td class="px-5 py-3 text-right"><a class="text-blue-600" href="{{ route('fiber.cables.show', $cable) }}">Detail</a></td></tr>@empty<tr><td colspan="4" class="px-5 py-8 text-center text-gray-400">Belum ada kabel.</td></tr>@endforelse</tbody>
    </table>
    <div class="px-5 py-3">{{ $cables->links() }}</div>
</div>
@endsection
