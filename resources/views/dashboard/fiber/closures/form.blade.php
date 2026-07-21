@extends('layouts.dashboard')
@section('page-title', $closure->exists ? 'Edit Closure FO' : 'Tambah Closure FO')
@section('content')
<form method="POST" action="{{ $closure->exists ? route('fiber.closures.update', $closure) : route('fiber.closures.store') }}" class="bg-white border border-gray-200 rounded-lg p-6 max-w-3xl space-y-5">
    @csrf
    @if($closure->exists) @method('PUT') @endif
    <div><label class="block text-sm font-medium mb-1">Nama CL</label><input name="nama_cl" value="{{ old('nama_cl', $closure->nama_cl) }}" required class="w-full px-4 py-2 border rounded-lg">@error('nama_cl')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror</div>
    <div><label class="block text-sm font-medium mb-1">Alamat</label><textarea name="alamat_cl" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('alamat_cl', $closure->alamat_cl) }}</textarea></div>
    <div><label class="block text-sm font-medium mb-1">Catatan</label><textarea name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('catatan', $closure->catatan) }}</textarea></div>
    <div class="flex gap-2 justify-end"><a href="{{ route('fiber.dashboard') }}" class="px-4 py-2 border rounded-lg">Batal</a><button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Simpan</button></div>
</form>
@endsection
