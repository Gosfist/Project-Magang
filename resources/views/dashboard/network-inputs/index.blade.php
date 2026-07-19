@extends('layouts.dashboard')
@section('page-title', 'Data Input Redaman')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <form method="GET" class="flex flex-wrap gap-2">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari closure atau core..." class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64">
        <select name="main_core_id" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Semua Closure</option>
            @foreach($mainCores as $core)
                <option value="{{ $core->id }}" {{ request('main_core_id') == $core->id ? 'selected' : '' }}>{{ $core->name }}</option>
            @endforeach
        </select>
        <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cari</button>
    </form>
    <button type="button" onclick="openModal('createInputModal')" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        Tambah Input Redaman
    </button>
</div>

<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
                <tr>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Data Closure</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Core</th>
                    <th class="text-right px-6 py-3 text-gray-500 font-medium">Redaman</th>
                    <th class="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
                </tr>
            </thead>
            <tbody>
                @forelse($networkInputs as $input)
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 font-medium text-gray-900">{{ $input->mainCore->name ?? '-' }}</td>
                    <td class="px-6 py-3 text-gray-600">Core {{ $input->core_number ?? '-' }}</td>
                    <td class="px-6 py-3 text-right font-mono text-blue-600">{{ $input->input_attenuation }} dBm</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button type="button" onclick="openModal('editInputModal{{ $input->id }}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <form method="POST" action="{{ route('network-inputs.destroy', $input) }}" onsubmit="return confirm('Yakin ingin menghapus input redaman ini?')">
                                @csrf @method('DELETE')
                                <button type="submit" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                            </form>
                        </div>
                    </td>
                </tr>
                @empty
                <tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Belum ada data input redaman.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($networkInputs->hasPages())<div class="px-6 py-3 border-t border-gray-200">{{ $networkInputs->links() }}</div>@endif
</div>

<div id="createInputModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-xl rounded-lg bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Tambah Input Redaman</h2>
            <button type="button" onclick="closeModal('createInputModal')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <form method="POST" action="{{ route('network-inputs.store') }}" id="createInputForm" class="space-y-5 px-6 py-5">
            @csrf
            <input type="hidden" name="form_mode" value="create">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Data Closure <span class="text-red-500">*</span></label>
                <select name="main_core_id" id="create_main_core_id" required onchange="renderCoreRows(true)" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if(old('form_mode') === 'create') @error('main_core_id') border-red-500 @enderror @endif">
                    <option value="">Pilih Data Closure</option>
                    @foreach($mainCores as $core)
                        <option value="{{ $core->id }}" data-total-core="{{ $core->total_core }}" {{ old('form_mode') === 'create' && old('main_core_id') == $core->id ? 'selected' : '' }}>{{ $core->name }} ({{ $core->total_core }} core)</option>
                    @endforeach
                </select>
                @if(old('form_mode') === 'create') @error('main_core_id') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
            </div>

            <div id="coreRows" class="space-y-3">
                <p class="text-sm text-gray-400">Pilih Data Closure untuk menampilkan daftar core.</p>
            </div>
            <div id="coreHiddenInputs"></div>

            @if(old('form_mode') === 'create')
                @error('attenuations') <p class="text-red-500 text-xs">{{ $message }}</p> @enderror
            @endif

            <div class="flex items-center justify-end gap-3 pt-2">
                <button type="button" onclick="closeModal('createInputModal')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" class="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Simpan</button>
            </div>
        </form>
    </div>
</div>

@foreach($networkInputs as $input)
<div id="editInputModal{{ $input->id }}" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-md rounded-lg bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">Edit Input Redaman</h2>
            <button type="button" onclick="closeModal('editInputModal{{ $input->id }}')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <form method="POST" action="{{ route('network-inputs.update', $input) }}" class="space-y-5 px-6 py-5">
            @csrf @method('PUT')
            <input type="hidden" name="editing_id" value="{{ $input->id }}">
            @php($isEditingThis = (string) old('editing_id') === (string) $input->id)
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div><span class="text-gray-500">Data Closure:</span><p class="font-medium text-gray-900">{{ $input->mainCore->name ?? '-' }}</p></div>
                <div><span class="text-gray-500">Core:</span><p class="font-medium text-gray-900">Core {{ $input->core_number ?? '-' }}</p></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Redaman Input (dBm) <span class="text-red-500">*</span></label><input type="number" step="0.01" name="input_attenuation" value="{{ $isEditingThis ? old('input_attenuation') : $input->input_attenuation }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @if($isEditingThis) @error('input_attenuation') border-red-500 @enderror @endif">@if($isEditingThis) @error('input_attenuation') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif</div>
            <div class="flex items-center justify-end gap-3 pt-2">
                <button type="button" onclick="closeModal('editInputModal{{ $input->id }}')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button>
                <button type="submit" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
            </div>
        </form>
    </div>
</div>
@endforeach
@endsection

@push('scripts')
<script>
    const oldAttenuations = @json(old('attenuations', []));
    let corePage = 1;
    const coresPerPage = 4;

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (id === 'createInputModal') renderCoreRows();
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function getCoreValues(totalCore) {
        const values = {};
        for (let core = 1; core <= totalCore; core++) {
            const hidden = document.getElementById('attenuation_hidden_' + core);
            values[core] = hidden?.value ?? oldAttenuations?.[core] ?? '';
        }
        return values;
    }

    function updateCoreValue(core, value) {
        const hidden = document.getElementById('attenuation_hidden_' + core);
        if (hidden) hidden.value = value;
    }

    function renderCoreRows(resetPage = false) {
        const select = document.getElementById('create_main_core_id');
        const container = document.getElementById('coreRows');
        const hiddenContainer = document.getElementById('coreHiddenInputs');
        const selected = select?.selectedOptions?.[0];
        const totalCore = Number(selected?.dataset?.totalCore || 0);

        if (!container) return;
        if (!totalCore) {
            container.innerHTML = '<p class="text-sm text-gray-400">Pilih Data Closure untuk menampilkan daftar core.</p>';
            if (hiddenContainer) hiddenContainer.innerHTML = '';
            return;
        }

        if (resetPage) corePage = 1;
        const values = getCoreValues(totalCore);
        const totalPages = Math.ceil(totalCore / coresPerPage);
        corePage = Math.min(Math.max(corePage, 1), totalPages);
        const startCore = (corePage - 1) * coresPerPage + 1;
        const endCore = Math.min(startCore + coresPerPage - 1, totalCore);

        if (hiddenContainer) {
            let hiddenInputs = '';
            for (let core = 1; core <= totalCore; core++) {
                hiddenInputs += `<input type="hidden" id="attenuation_hidden_${core}" name="attenuations[${core}]" value="${values[core]}">`;
            }
            hiddenContainer.innerHTML = hiddenInputs;
        }

        let rows = '<div class="grid grid-cols-2 gap-3 text-sm font-medium text-gray-500"><div>Core</div><div>Redaman</div></div>';
        for (let core = startCore; core <= endCore; core++) {
            const value = values[core] ?? '';
            rows += `
                <div class="grid grid-cols-2 gap-3 items-center">
                    <div class="px-4 py-2.5 bg-gray-100 text-gray-900 rounded-lg font-medium">Core ${core}</div>
                    <input type="number" step="0.01" value="${value}" oninput="updateCoreValue(${core}, this.value)" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="cth: -7">
                </div>
            `;
        }
        if (totalPages > 1) {
            rows += '<div class="flex items-center justify-between pt-2">';
            rows += `<button type="button" onclick="changeCorePage(${corePage - 1})" ${corePage === 1 ? 'disabled' : ''} class="px-3 py-2 border border-gray-300 rounded-lg text-sm ${corePage === 1 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'}">Sebelumnya</button>`;
            rows += '<div class="flex items-center gap-2">';
            for (let page = 1; page <= totalPages; page++) {
                rows += `<button type="button" onclick="changeCorePage(${page})" class="w-9 h-9 rounded-lg text-sm font-medium ${page === corePage ? 'bg-gray-300 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">${page}</button>`;
            }
            rows += '</div>';
            rows += `<button type="button" onclick="changeCorePage(${corePage + 1})" ${corePage === totalPages ? 'disabled' : ''} class="px-3 py-2 border border-gray-300 rounded-lg text-sm ${corePage === totalPages ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'}">Berikutnya</button>`;
            rows += '</div>';
        }
        container.innerHTML = rows;
    }

    function changeCorePage(page) {
        corePage = page;
        renderCoreRows();
    }

    document.addEventListener('DOMContentLoaded', renderCoreRows);

    @if($errors->any() && old('form_mode') === 'create')
        openModal('createInputModal');
    @endif

    @if($errors->any() && old('editing_id'))
        openModal('editInputModal{{ old('editing_id') }}');
    @endif
</script>
@endpush
