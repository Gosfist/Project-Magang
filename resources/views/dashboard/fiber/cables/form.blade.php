@extends('layouts.dashboard')
@section('page-title', $cable->exists ? 'Edit Kabel FO' : 'Tambah Kabel FO')
@section('content')
<form method="POST" action="{{ $cable->exists ? route('fiber.cables.update', $cable) : route('fiber.cables.store') }}" class="bg-white border border-gray-200 rounded-lg p-6 max-w-4xl space-y-5">
    @csrf @if($cable->exists) @method('PUT') @endif
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium mb-1">Nama kabel</label><input name="nama_kabel" value="{{ old('nama_kabel', $cable->nama_kabel) }}" required class="w-full px-4 py-2 border rounded-lg">@error('nama_kabel')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror</div>
        <div><label class="block text-sm font-medium mb-1">Closure asal</label><select name="source_closure_id" class="w-full px-4 py-2 border rounded-lg"><option value="">Kosong</option>@foreach($closures as $closure)<option value="{{ $closure->fo_closure }}" @selected((string)old('source_closure_id', request('closure_id')) === (string)$closure->fo_closure)>{{ $closure->nama_cl }}</option>@endforeach</select></div>
        <div><label class="block text-sm font-medium mb-1">Closure tujuan</label><select name="destination_closure_id" class="w-full px-4 py-2 border rounded-lg"><option value="">Kosong</option>@foreach($closures as $closure)<option value="{{ $closure->fo_closure }}" @selected((string)old('destination_closure_id') === (string)$closure->fo_closure)>{{ $closure->nama_cl }}</option>@endforeach</select></div>
        <div><label class="block text-sm font-medium mb-1">Jumlah core</label><input name="jumlah_core" value="{{ old('jumlah_core', $cable->jumlah_core ?: 1) }}" type="number" min="1" @disabled($cable->exists) required class="w-full px-4 py-2 border rounded-lg">@if($cable->exists)<input type="hidden" name="jumlah_core" value="{{ $cable->jumlah_core }}">@endif</div>
    </div>
    <div><label class="block text-sm font-medium mb-1">Catatan</label><textarea name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('catatan', $cable->catatan) }}</textarea></div>
    <div class="flex gap-2 justify-end"><a href="{{ route('fiber.cables.index') }}" class="px-4 py-2 border rounded-lg">Batal</a><button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Simpan</button></div>
</form>
@endsection
