@extends('layouts.dashboard')
@section('page-title', 'Edit Output Port')
@section('content')
<div class="max-w-2xl">
    <div class="mb-6"><a href="{{ route('splitters.show', $splitterOutput->splitter_id) }}" class="text-sm text-blue-600 hover:underline">← Kembali ke Detail Splitter</a></div>

    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm">
        <p class="font-medium text-blue-800">{{ $splitterOutput->splitter->splitter_name }} - Port {{ $splitterOutput->port_number }}</p>
        <p class="text-blue-600 text-xs mt-1">Closure: {{ $splitterOutput->splitter->mainCore->name ?? '-' }} | Input: {{ $splitterOutput->splitter->networkInput->source_name ?? '-' }} ({{ $splitterOutput->splitter->networkInput->input_attenuation ?? '-' }} dBm)</p>
    </div>

    <div class="bg-white rounded-lg border border-gray-200 p-6">
        <form method="POST" action="{{ route('splitter-outputs.update', $splitterOutput) }}" class="space-y-5">
            @csrf @method('PUT')
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Status <span class="text-red-500">*</span></label><select name="status" id="portStatus" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" onchange="toggleFields()">@foreach(\App\Models\SplitterOutput::STATUS_LABELS as $val => $label)<option value="{{ $val }}" {{ old('status', $splitterOutput->status) == $val ? 'selected' : '' }}>{{ $label }}</option>@endforeach</select>@error('status') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
            <div id="activeFields">
                <div class="space-y-5">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Nama Closure <span class="text-red-500" id="destRequired">*</span></label><select name="destination_main_core_id" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('destination_main_core_id') border-red-500 @enderror"><option value="">- Tidak ada tujuan -</option>@foreach($mainCores as $core)<option value="{{ $core->id }}" {{ old('destination_main_core_id', $splitterOutput->destination_main_core_id) == $core->id ? 'selected' : '' }}>{{ $core->name }}</option>@endforeach</select>@error('destination_main_core_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Redaman Output (dBm) <span class="text-red-500" id="attRequired">*</span></label><input type="number" step="0.01" name="output_attenuation" value="{{ old('output_attenuation', $splitterOutput->output_attenuation) }}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('output_attenuation') border-red-500 @enderror" placeholder="cth: -14">@error('output_attenuation') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror</div>
                </div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('description', $splitterOutput->description) }}</textarea></div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit" class="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
                <a href="{{ route('splitters.show', $splitterOutput->splitter_id) }}" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</a>
            </div>
        </form>
    </div>
</div>
@push('scripts')
<script>
function toggleFields() {
    const status = document.getElementById('portStatus').value;
    const fields = document.getElementById('activeFields');
    const destReq = document.getElementById('destRequired');
    const attReq = document.getElementById('attRequired');
    if (status === 'active') {
        fields.style.opacity = '1';
        destReq.textContent = '*';
        attReq.textContent = '*';
    } else {
        fields.style.opacity = '0.5';
        destReq.textContent = '';
        attReq.textContent = '';
    }
}
document.addEventListener('DOMContentLoaded', toggleFields);
</script>
@endpush
@endsection
