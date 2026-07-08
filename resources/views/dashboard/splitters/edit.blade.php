@extends('layouts.dashboard')
@section('page-title', 'Edit Splitter')
@section('content')
<div class="max-w-2xl">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form method="POST" action="{{ route('splitters.update', $splitter) }}" class="space-y-5">
            @csrf @method('PUT')
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Titik Jaringan <span class="text-red-500">*</span></label><select name="network_point_id" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Pilih Titik Jaringan</option>@foreach($networkPoints as $point)<option value="{{ $point->id }}" {{ old('network_point_id', $splitter->network_point_id) == $point->id ? 'selected' : '' }}>{{ $point->name }} ({{ $point->code }})</option>@endforeach</select>@error('network_point_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Input Redaman <span class="text-red-500">*</span></label><select name="network_input_id" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Pilih Input</option>@foreach($networkInputs as $input)<option value="{{ $input->id }}" {{ old('network_input_id', $splitter->network_input_id) == $input->id ? 'selected' : '' }}>{{ $input->networkPoint->name ?? '' }} - {{ $input->source_name }} ({{ $input->input_attenuation }} dBm)</option>@endforeach</select>@error('network_input_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Nama Splitter <span class="text-red-500">*</span></label><input type="text" name="splitter_name" value="{{ old('splitter_name', $splitter->splitter_name) }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('splitter_name') border-red-500 @enderror">@error('splitter_name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Jenis Splitter <span class="text-red-500">*</span></label><select name="splitter_ratio" id="splitterRatio" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" onchange="updatePorts()"><option value="1:2" {{ old('splitter_ratio', $splitter->splitter_ratio) == '1:2' ? 'selected' : '' }}>1:2</option><option value="1:4" {{ old('splitter_ratio', $splitter->splitter_ratio) == '1:4' ? 'selected' : '' }}>1:4</option><option value="1:8" {{ old('splitter_ratio', $splitter->splitter_ratio) == '1:8' ? 'selected' : '' }}>1:8</option><option value="1:16" {{ old('splitter_ratio', $splitter->splitter_ratio) == '1:16' ? 'selected' : '' }}>1:16</option><option value="1:32" {{ old('splitter_ratio', $splitter->splitter_ratio) == '1:32' ? 'selected' : '' }}>1:32</option><option value="custom" {{ !in_array(old('splitter_ratio', $splitter->splitter_ratio), ['1:2','1:4','1:8','1:16','1:32']) ? 'selected' : '' }}>Custom</option></select></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Total Port <span class="text-red-500">*</span></label><input type="number" name="total_ports" id="totalPorts" value="{{ old('total_ports', $splitter->total_ports) }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">@error('total_ports') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            </div>
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">⚠️ Jika total port dikurangi, output port yang melebihi jumlah baru akan dihapus.</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('description', $splitter->description) }}</textarea></div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
                <a href="{{ route('splitters.show', $splitter) }}" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</a>
            </div>
        </form>
    </div>
</div>
@push('scripts')
<script>
function updatePorts() {
    const ratio = document.getElementById('splitterRatio').value;
    const totalPorts = document.getElementById('totalPorts');
    const portMap = {'1:2': 2, '1:4': 4, '1:8': 8, '1:16': 16, '1:32': 32};
    if (portMap[ratio]) { totalPorts.value = portMap[ratio]; totalPorts.readOnly = true; totalPorts.classList.add('bg-gray-100'); }
    else { totalPorts.readOnly = false; totalPorts.classList.remove('bg-gray-100'); }
}
</script>
@endpush
@endsection
