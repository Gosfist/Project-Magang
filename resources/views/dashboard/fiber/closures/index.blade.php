@extends('layouts.dashboard')
@section('page-title', 'Closure FO')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
    <form method="GET" class="flex gap-2"><input name="search" value="{{ request('search') }}" class="px-4 py-2 border rounded-lg text-sm" placeholder="Cari nama atau alamat"><button class="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cari</button></form>
    <a href="{{ route('fiber.closures.create') }}" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Tambah Closure</a>
</div>
<div class="bg-white border border-gray-200 rounded-lg overflow-x-auto">
    <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-500"><tr><th class="text-left px-5 py-3">Nama CL</th><th class="text-left px-5 py-3">Alamat</th><th class="text-left px-5 py-3">Catatan</th><th class="text-right px-5 py-3">Aksi</th></tr></thead>
        <tbody>@forelse($closures as $closure)<tr class="border-t border-gray-100"><td class="px-5 py-3 font-medium">{{ $closure->nama_cl }}</td><td class="px-5 py-3">{{ $closure->alamat_cl ?? '-' }}</td><td class="px-5 py-3">{{ $closure->catatan ?? '-' }}</td><td class="px-5 py-3 text-right space-x-2"><a class="text-blue-600" href="{{ route('fiber.closures.show', $closure) }}">Detail</a></td></tr>@empty<tr><td colspan="4" class="px-5 py-8 text-center text-gray-400">Belum ada data.</td></tr>@endforelse</tbody>
    </table>
    <div class="px-5 py-3">{{ $closures->links() }}</div>
</div>
@endsection
