@extends('layouts.dashboard')
@section('page-title', 'Edit Titik Jaringan')
@section('content')
<div class="max-w-2xl">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form method="POST" action="{{ route('network-points.update', $networkPoint) }}" class="space-y-5">
            @csrf @method('PUT')
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Nama <span class="text-red-500">*</span></label><input type="text" name="name" value="{{ old('name', $networkPoint->name) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('name') border-red-500 @enderror">@error('name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Kode <span class="text-red-500">*</span></label><input type="text" name="code" value="{{ old('code', $networkPoint->code) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('code') border-red-500 @enderror">@error('code') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Jenis <span class="text-red-500">*</span></label><select name="type" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">@foreach(\App\Models\NetworkPoint::TYPE_LABELS as $val => $label)<option value="{{ $val }}" {{ old('type', $networkPoint->type) == $val ? 'selected' : '' }}>{{ $label }}</option>@endforeach</select>@error('type') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Lokasi <span class="text-red-500">*</span></label><input type="text" name="location" value="{{ old('location', $networkPoint->location) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('location') border-red-500 @enderror">@error('location') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Latitude</label><input type="text" name="latitude" value="{{ old('latitude', $networkPoint->latitude) }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Longitude</label><input type="text" name="longitude" value="{{ old('longitude', $networkPoint->longitude) }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('description', $networkPoint->description) }}</textarea></div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
                <a href="{{ route('network-points.index') }}" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</a>
            </div>
        </form>
    </div>
</div>
@endsection
