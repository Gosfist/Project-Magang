@extends('layouts.dashboard')
@section('page-title', 'Data Splitter')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <form method="GET" class="flex flex-wrap gap-2">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari splitter atau closure..." class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64">
        <select name="main_core_id" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Closure</option>
            @foreach($mainCores as $core)
                <option value="{{ $core->id }}" {{ request('main_core_id') == $core->id ? 'selected' : '' }}>{{ $core->name }}</option>
            @endforeach
        </select>
        <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cari</button>
    </form>
    <button type="button" onclick="openModal('createSplitterModal')" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        Tambah Splitter
    </button>
</div>

<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
                <tr>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Nama Splitter</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Data Closure</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Rasio</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Total Port</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Input</th>
                    <th class="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
                </tr>
            </thead>
            <tbody>
                @forelse($splitters as $splitter)
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 font-medium text-gray-900">{{ $splitter->splitter_name }}</td>
                    <td class="px-6 py-3 text-gray-600">{{ $splitter->mainCore->name ?? '-' }}</td>
                    <td class="px-6 py-3"><span class="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">{{ $splitter->splitter_ratio }}</span></td>
                    <td class="px-6 py-3 text-gray-600">{{ $splitter->total_ports }} port</td>
                    <td class="px-6 py-3 text-gray-500 text-xs">{{ $splitter->networkInput->source_name ?? '-' }}</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <a href="{{ route('splitters.show', $splitter) }}" class="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Detail"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></a>
                            <button type="button" onclick="openModal('editSplitterModal{{ $splitter->id }}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                            <form method="POST" action="{{ route('splitters.destroy', $splitter) }}" onsubmit="return confirm('Yakin? Semua output port juga akan dihapus.')">@csrf @method('DELETE')<button type="submit" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></form>
                        </div>
                    </td>
                </tr>
                @empty
                <tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">Belum ada data splitter.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($splitters->hasPages())<div class="px-6 py-3 border-t border-gray-200">{{ $splitters->links() }}</div>@endif
</div>

<div id="createSplitterModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Tambah Splitter</h2>
            <button type="button" onclick="closeModal('createSplitterModal')" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <form method="POST" action="{{ route('splitters.store') }}" class="space-y-5 px-6 py-5">
            @csrf
            <input type="hidden" name="form_mode" value="create">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Data Closure <span class="text-red-500">*</span></label><select name="main_core_id" id="create_main_core_id" required onchange="filterInputs('create')" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('main_core_id') border-red-500 @enderror @endif"><option value="">Pilih Data Closure</option>@foreach($mainCores as $core)<option value="{{ $core->id }}" {{ old('form_mode') === 'create' && old('main_core_id') == $core->id ? 'selected' : '' }}>{{ $core->name }}</option>@endforeach</select>@if(old('form_mode') === 'create') @error('main_core_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Input Redaman <span class="text-red-500">*</span></label><select name="network_input_id" id="create_network_input_id" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('network_input_id') border-red-500 @enderror @endif"><option value="">Pilih Data Closure dulu</option>@foreach($networkInputs as $input)<option value="{{ $input->id }}" data-main-core-id="{{ $input->main_core_id }}" {{ old('form_mode') === 'create' && old('network_input_id') == $input->id ? 'selected' : '' }}>{{ $input->mainCore->name ?? '-' }} - {{ $input->source_name }} ({{ $input->input_attenuation }} dBm)</option>@endforeach</select>@if(old('form_mode') === 'create') @error('network_input_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Nama Splitter <span class="text-red-500">*</span></label><input type="text" name="splitter_name" value="{{ old('form_mode') === 'create' ? old('splitter_name') : '' }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('splitter_name') border-red-500 @enderror @endif" placeholder="cth: Splitter Closure Area 1">@if(old('form_mode') === 'create') @error('splitter_name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Jenis Splitter <span class="text-red-500">*</span></label><select name="splitter_ratio" id="create_splitter_ratio" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('splitter_ratio') border-red-500 @enderror @endif" onchange="updatePorts('create')"><option value="">Pilih Jenis</option>@foreach(['1:2','1:4','1:8','1:16','1:32'] as $ratio)<option value="{{ $ratio }}" {{ old('form_mode') === 'create' && old('splitter_ratio') == $ratio ? 'selected' : '' }}>{{ $ratio }}</option>@endforeach<option value="custom" {{ old('form_mode') === 'create' && old('splitter_ratio') == 'custom' ? 'selected' : '' }}>Custom</option></select>@if(old('form_mode') === 'create') @error('splitter_ratio') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Total Port <span class="text-red-500">*</span></label><input type="number" name="total_ports" id="create_total_ports" value="{{ old('form_mode') === 'create' ? old('total_ports') : '' }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('total_ports') border-red-500 @enderror @endif">@if(old('form_mode') === 'create') @error('total_ports') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('form_mode') === 'create' ? old('description') : '' }}</textarea></div>
            <div class="flex items-center justify-end gap-3 pt-2"><button type="button" onclick="closeModal('createSplitterModal')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button><button type="submit" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Simpan</button></div>
        </form>
    </div>
</div>

@foreach($splitters as $splitter)
<div id="editSplitterModal{{ $splitter->id }}" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Edit Splitter</h2>
            <button type="button" onclick="closeModal('editSplitterModal{{ $splitter->id }}')" class="text-gray-400 hover:text-gray-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <form method="POST" action="{{ route('splitters.update', $splitter) }}" class="space-y-5 px-6 py-5">
            @csrf @method('PUT')
            <input type="hidden" name="editing_id" value="{{ $splitter->id }}">
            @php($isEditingThis = (string) old('editing_id') === (string) $splitter->id)
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Data Closure <span class="text-red-500">*</span></label><select name="main_core_id" id="edit_{{ $splitter->id }}_main_core_id" required onchange="filterInputs('edit_{{ $splitter->id }}')" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('main_core_id') border-red-500 @enderror @endif"><option value="">Pilih Data Closure</option>@foreach($mainCores as $core)<option value="{{ $core->id }}" {{ ($isEditingThis ? old('main_core_id') : $splitter->main_core_id) == $core->id ? 'selected' : '' }}>{{ $core->name }}</option>@endforeach</select>@if($isEditingThis) @error('main_core_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Input Redaman <span class="text-red-500">*</span></label><select name="network_input_id" id="edit_{{ $splitter->id }}_network_input_id" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('network_input_id') border-red-500 @enderror @endif"><option value="">Pilih Data Closure dulu</option>@foreach($networkInputs as $input)<option value="{{ $input->id }}" data-main-core-id="{{ $input->main_core_id }}" {{ ($isEditingThis ? old('network_input_id') : $splitter->network_input_id) == $input->id ? 'selected' : '' }}>{{ $input->mainCore->name ?? '-' }} - {{ $input->source_name }} ({{ $input->input_attenuation }} dBm)</option>@endforeach</select>@if($isEditingThis) @error('network_input_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Nama Splitter <span class="text-red-500">*</span></label><input type="text" name="splitter_name" value="{{ $isEditingThis ? old('splitter_name') : $splitter->splitter_name }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('splitter_name') border-red-500 @enderror @endif">@if($isEditingThis) @error('splitter_name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Jenis Splitter <span class="text-red-500">*</span></label><select name="splitter_ratio" id="edit_{{ $splitter->id }}_splitter_ratio" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('splitter_ratio') border-red-500 @enderror @endif" onchange="updatePorts('edit_{{ $splitter->id }}')">@foreach(['1:2','1:4','1:8','1:16','1:32'] as $ratio)<option value="{{ $ratio }}" {{ ($isEditingThis ? old('splitter_ratio') : $splitter->splitter_ratio) == $ratio ? 'selected' : '' }}>{{ $ratio }}</option>@endforeach<option value="custom" {{ !in_array($isEditingThis ? old('splitter_ratio') : $splitter->splitter_ratio, ['1:2','1:4','1:8','1:16','1:32']) ? 'selected' : '' }}>Custom</option></select>@if($isEditingThis) @error('splitter_ratio') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Total Port <span class="text-red-500">*</span></label><input type="number" name="total_ports" id="edit_{{ $splitter->id }}_total_ports" value="{{ $isEditingThis ? old('total_ports') : $splitter->total_ports }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('total_ports') border-red-500 @enderror @endif">@if($isEditingThis) @error('total_ports') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">Jika total port dikurangi, output port yang melebihi jumlah baru akan dihapus.</div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label><textarea name="description" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ $isEditingThis ? old('description') : $splitter->description }}</textarea></div>
            <div class="flex items-center justify-end gap-3 pt-2"><button type="button" onclick="closeModal('editSplitterModal{{ $splitter->id }}')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button><button type="submit" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button></div>
        </form>
    </div>
</div>
@endforeach
@endsection

@push('scripts')
<script>
    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function updatePorts(prefix) {
        const ratio = document.getElementById(prefix + '_splitter_ratio')?.value;
        const totalPorts = document.getElementById(prefix + '_total_ports');
        const portMap = {'1:2': 2, '1:4': 4, '1:8': 8, '1:16': 16, '1:32': 32};
        if (!totalPorts) return;
        if (portMap[ratio]) {
            totalPorts.value = portMap[ratio];
            totalPorts.readOnly = true;
            totalPorts.classList.add('bg-gray-100');
        } else {
            totalPorts.readOnly = false;
            totalPorts.classList.remove('bg-gray-100');
            if (ratio !== 'custom') totalPorts.value = '';
        }
    }

    function filterInputs(prefix) {
        const closureSelect = document.getElementById(prefix + '_main_core_id');
        const inputSelect = document.getElementById(prefix + '_network_input_id');
        if (!closureSelect || !inputSelect) return;

        const selectedClosure = closureSelect.value;
        let selectedInputStillVisible = false;

        Array.from(inputSelect.options).forEach((option) => {
            if (!option.value) {
                option.hidden = false;
                option.textContent = selectedClosure ? 'Pilih Input Redaman' : 'Pilih Data Closure dulu';
                return;
            }

            const isMatch = option.dataset.mainCoreId === selectedClosure;
            option.hidden = !selectedClosure || !isMatch;
            option.disabled = !selectedClosure || !isMatch;

            if (option.selected && isMatch) {
                selectedInputStillVisible = true;
            }
        });

        if (!selectedInputStillVisible) {
            inputSelect.value = '';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        updatePorts('create');
        filterInputs('create');
        @foreach($splitters as $splitter)
            updatePorts('edit_{{ $splitter->id }}');
            filterInputs('edit_{{ $splitter->id }}');
        @endforeach
    });

    @if($errors->any() && old('form_mode') === 'create')
        openModal('createSplitterModal');
    @endif

    @if($errors->any() && old('editing_id'))
        openModal('editSplitterModal{{ old('editing_id') }}');
    @endif
</script>
@endpush
