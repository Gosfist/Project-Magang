@extends('layouts.dashboard')
@section('page-title', 'Tambah Main Core')
@section('content')
<div class="max-w-2xl">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form method="POST" action="{{ route('main-cores.store') }}" class="space-y-5">
            @csrf
            <div><label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nama Main Core <span class="text-red-500">*</span></label><input type="text" name="name" id="name" value="{{ old('name') }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @error('name') border-red-500 @enderror" placeholder="cth: Main Core Area Barat">@error('name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label for="code" class="block text-sm font-medium text-gray-700 mb-1">Kode Main Core <span class="text-red-500">*</span></label><input type="text" name="code" id="code" value="{{ old('code') }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @error('code') border-red-500 @enderror" placeholder="cth: MC-BRT-01">@error('code') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label for="total_core" class="block text-sm font-medium text-gray-700 mb-1">Jumlah Core <span class="text-red-500">*</span></label><input type="number" name="total_core" id="total_core" value="{{ old('total_core') }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @error('total_core') border-red-500 @enderror" placeholder="cth: 12">@error('total_core') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label for="start_location" class="block text-sm font-medium text-gray-700 mb-1">Lokasi Awal</label><input type="text" name="start_location" id="start_location" value="{{ old('start_location') }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="cth: Server Room / POP Utama"></div>
            <div><label for="description" class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" id="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="Keterangan tambahan...">{{ old('description') }}</textarea></div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Simpan</button>
                <a href="{{ route('main-cores.index') }}" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Batal</a>
            </div>
        </form>
    </div>
</div>
@endsection
