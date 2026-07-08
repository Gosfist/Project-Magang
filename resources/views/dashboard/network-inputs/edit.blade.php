@extends('layouts.dashboard')
@section('page-title', 'Edit Input Redaman')
@section('content')
<div class="max-w-2xl">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form method="POST" action="{{ route('network-inputs.update', $networkInput) }}" class="space-y-5">
            @csrf @method('PUT')
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Titik Jaringan <span class="text-red-500">*</span></label><select name="network_point_id" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Pilih Titik Jaringan</option>@foreach($networkPoints as $point)<option value="{{ $point->id }}" {{ old('network_point_id', $networkInput->network_point_id) == $point->id ? 'selected' : '' }}>{{ $point->name }} ({{ $point->code }})</option>@endforeach</select>@error('network_point_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Sumber Input <span class="text-red-500">*</span></label><input type="text" name="source_name" value="{{ old('source_name', $networkInput->source_name) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('source_name') border-red-500 @enderror">@error('source_name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Main Core</label><select name="main_core_id" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"><option value="">- Tidak dari Main Core -</option>@foreach($mainCores as $core)<option value="{{ $core->id }}" {{ old('main_core_id', $networkInput->main_core_id) == $core->id ? 'selected' : '' }}>{{ $core->name }} ({{ $core->code }})</option>@endforeach</select></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Warna Kabel/Core</label><input type="text" name="cable_color" value="{{ old('cable_color', $networkInput->cable_color) }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Nomor Core</label><input type="number" name="core_number" value="{{ old('core_number', $networkInput->core_number) }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Redaman Input (dBm) <span class="text-red-500">*</span></label><input type="number" step="0.01" name="input_attenuation" value="{{ old('input_attenuation', $networkInput->input_attenuation) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('input_attenuation') border-red-500 @enderror">@error('input_attenuation') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('description', $networkInput->description) }}</textarea></div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
                <a href="{{ route('network-inputs.index') }}" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</a>
            </div>
        </form>
    </div>
</div>
@endsection
