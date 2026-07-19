@extends('layouts.dashboard')
@section('page-title', 'Data Closure')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <form method="GET" class="flex gap-2">
        <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari nama atau lokasi..." class="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-72">
        <button type="submit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">Cari</button>
    </form>
    <button type="button" onclick="openModal('createClosureModal')" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        Tambah Closure
    </button>
</div>

<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Nama</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Jumlah Core</th>
                    <th class="text-left px-6 py-3 text-gray-500 font-medium">Lokasi</th>
                    <th class="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
                </tr>
            </thead>
            <tbody>
                @forelse($mainCores as $core)
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-3 font-medium text-gray-900">{{ $core->name }}</td>
                    <td class="px-6 py-3 text-gray-600">{{ $core->total_core }} core</td>
                    <td class="px-6 py-3 text-gray-500">{{ $core->start_location ?? '-' }}</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button type="button" onclick="openModal('editClosureModal{{ $core->id }}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <form method="POST" action="{{ route('main-cores.destroy', $core) }}" onsubmit="return confirm('Yakin ingin menghapus data closure ini?')">@csrf @method('DELETE')
                                <button type="submit" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                            </form>
                        </div>
                    </td>
                </tr>
                @empty
                <tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Belum ada data closure.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
    @if($mainCores->hasPages())<div class="px-6 py-3 border-t border-gray-200">{{ $mainCores->links() }}</div>@endif
</div>

<div id="createClosureModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-sm max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-gray-900">Tambah Closure</h2>
            <button type="button" onclick="closeModal('createClosureModal')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <form method="POST" action="{{ route('main-cores.store') }}" class="px-6 py-5" data-closure-wizard data-total-input="create_total_core" data-values-id="attenuations-create">
            @csrf
            <input type="hidden" name="form_mode" value="create">
            <input type="hidden" name="description" value="">
            <div data-step="1" class="space-y-5">
                <div>
                    <label for="create_name" class="block text-sm font-medium text-gray-700 mb-1">Nama <span class="text-red-500">*</span></label>
                    <input type="text" name="name" id="create_name" value="{{ old('form_mode') === 'create' ? old('name') : '' }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if(old('form_mode') === 'create') @error('name') border-red-500 @enderror @endif" placeholder="cth: Closure Area Barat">
                    @if(old('form_mode') === 'create') @error('name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div>
                    <label for="create_total_core" class="block text-sm font-medium text-gray-700 mb-1">Jumlah Core <span class="text-red-500">*</span></label>
                    <input type="number" name="total_core" id="create_total_core" value="{{ old('form_mode') === 'create' ? old('total_core', 1) : 1 }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if(old('form_mode') === 'create') @error('total_core') border-red-500 @enderror @endif">
                    @if(old('form_mode') === 'create') @error('total_core') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div>
                    <label for="create_start_location" class="block text-sm font-medium text-gray-700 mb-1">Lokasi <span class="text-red-500">*</span></label>
                    <input type="text" name="start_location" id="create_start_location" value="{{ old('form_mode') === 'create' ? old('start_location') : '' }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if(old('form_mode') === 'create') @error('start_location') border-red-500 @enderror @endif" placeholder="cth: POP Utama">
                    @if(old('form_mode') === 'create') @error('start_location') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onclick="closeModal('createClosureModal')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button>
                    <button type="button" data-next-step class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next</button>
                </div>
            </div>
            <div data-step="2" class="hidden space-y-5">
                <div>
                    <h3 class="text-base font-semibold text-gray-900">Input Redaman</h3>
                    <p class="text-sm text-gray-500">Isi redaman core yang sudah ada nilainya. Core yang kosong tidak akan disimpan.</p>
                    @if(old('form_mode') === 'create' && $errors->has('attenuations.*'))
                        <p class="text-red-500 text-xs mt-2">Ada redaman yang harus berupa angka.</p>
                    @endif
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm font-medium text-gray-500">
                    <span>Core</span>
                    <span>Redaman</span>
                </div>
                <div data-core-list class="space-y-3"></div>
                <div class="flex items-center justify-between gap-3 pt-1">
                    <button type="button" data-prev-page class="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Sebelumnya</button>
                    <div data-page-buttons class="flex items-center justify-center gap-2"></div>
                    <button type="button" data-next-page class="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Berikutnya</button>
                </div>
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" data-back-step class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Kembali</button>
                    <button type="submit" class="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Simpan</button>
                </div>
            </div>
        </form>
    </div>
</div>

<script type="application/json" id="attenuations-create">@json(old('form_mode') === 'create' ? old('attenuations', []) : [])</script>

@foreach($mainCores as $core)
@php
    $isEditingThis = (string) old('editing_id') === (string) $core->id;
    $inputValues = $isEditingThis ? old('attenuations', []) : $core->networkInputs->pluck('input_attenuation', 'core_number');
@endphp
<div id="editClosureModal{{ $core->id }}" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-sm max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
            <h2 class="text-lg font-semibold text-gray-900">Edit Closure</h2>
            <button type="button" onclick="closeModal('editClosureModal{{ $core->id }}')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
        <form method="POST" action="{{ route('main-cores.update', $core) }}" class="px-6 py-5" data-closure-wizard data-total-input="edit_total_core_{{ $core->id }}" data-values-id="attenuations-edit-{{ $core->id }}">
            @csrf @method('PUT')
            <input type="hidden" name="editing_id" value="{{ $core->id }}">
            <input type="hidden" name="description" value="">
            <div data-step="1" class="space-y-5">
                <div>
                    <label for="edit_name_{{ $core->id }}" class="block text-sm font-medium text-gray-700 mb-1">Nama <span class="text-red-500">*</span></label>
                    <input type="text" name="name" id="edit_name_{{ $core->id }}" value="{{ $isEditingThis ? old('name') : $core->name }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if($isEditingThis) @error('name') border-red-500 @enderror @endif">
                    @if($isEditingThis) @error('name') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div>
                    <label for="edit_total_core_{{ $core->id }}" class="block text-sm font-medium text-gray-700 mb-1">Jumlah Core <span class="text-red-500">*</span></label>
                    <input type="number" name="total_core" id="edit_total_core_{{ $core->id }}" value="{{ $isEditingThis ? old('total_core') : $core->total_core }}" required min="1" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if($isEditingThis) @error('total_core') border-red-500 @enderror @endif">
                    @if($isEditingThis) @error('total_core') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div>
                    <label for="edit_start_location_{{ $core->id }}" class="block text-sm font-medium text-gray-700 mb-1">Lokasi <span class="text-red-500">*</span></label>
                    <input type="text" name="start_location" id="edit_start_location_{{ $core->id }}" value="{{ $isEditingThis ? old('start_location') : $core->start_location }}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none @if($isEditingThis) @error('start_location') border-red-500 @enderror @endif">
                    @if($isEditingThis) @error('start_location') <p class="text-red-500 text-xs mt-1">{{ $message }}</p> @enderror @endif
                </div>
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onclick="closeModal('editClosureModal{{ $core->id }}')" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button>
                    <button type="button" data-next-step class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next</button>
                </div>
            </div>
            <div data-step="2" class="hidden space-y-5">
                <div>
                    <h3 class="text-base font-semibold text-gray-900">Input Redaman</h3>
                    <p class="text-sm text-gray-500">Perbarui redaman core yang diperlukan. Core kosong tidak mengubah data lama.</p>
                    @if($isEditingThis && $errors->has('attenuations.*'))
                        <p class="text-red-500 text-xs mt-2">Ada redaman yang harus berupa angka.</p>
                    @endif
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm font-medium text-gray-500">
                    <span>Core</span>
                    <span>Redaman</span>
                </div>
                <div data-core-list class="space-y-3"></div>
                <div class="flex items-center justify-between gap-3 pt-1">
                    <button type="button" data-prev-page class="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Sebelumnya</button>
                    <div data-page-buttons class="flex items-center justify-center gap-2"></div>
                    <button type="button" data-next-page class="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Berikutnya</button>
                </div>
                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" data-back-step class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Kembali</button>
                    <button type="submit" class="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Perbarui</button>
                </div>
            </div>
        </form>
    </div>
</div>
<script type="application/json" id="attenuations-edit-{{ $core->id }}">@json($inputValues)</script>
@endforeach
@endsection

@push('scripts')
<script>
    const coreRowsPerPage = 4;

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const wizard = modal.querySelector('[data-closure-wizard]');
        if (wizard) {
            showWizardStep(wizard, 1);
            renderCorePage(wizard);
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function parseWizardValues(form) {
        if (form.dataset.valuesLoaded === 'true') return;

        const valuesNode = document.getElementById(form.dataset.valuesId);
        form._attenuations = valuesNode ? JSON.parse(valuesNode.textContent || '{}') : {};
        form._corePage = 1;
        form.dataset.valuesLoaded = 'true';
    }

    function captureCoreValues(form) {
        parseWizardValues(form);
        form.querySelectorAll('[data-core-input]').forEach((input) => {
            form._attenuations[input.dataset.coreInput] = input.value;
        });
    }

    function prepareSubmitValues(form) {
        captureCoreValues(form);
        form.querySelectorAll('[data-generated-hidden]').forEach((input) => input.remove());

        Object.entries(form._attenuations).forEach(([core, value]) => {
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = `attenuations[${core}]`;
            hidden.value = value ?? '';
            hidden.dataset.generatedHidden = 'true';
            form.appendChild(hidden);
        });
    }

    function totalCore(form) {
        const input = document.getElementById(form.dataset.totalInput);
        return Math.max(parseInt(input.value || '1', 10), 1);
    }

    function showWizardStep(form, step) {
        form.querySelectorAll('[data-step]').forEach((section) => {
            section.classList.toggle('hidden', section.dataset.step !== String(step));
        });
    }

    function validateClosureStep(form) {
        const step = form.querySelector('[data-step="1"]');
        const fields = step.querySelectorAll('input[required]');

        for (const field of fields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        }

        return true;
    }

    function renderCorePage(form) {
        parseWizardValues(form);
        captureCoreValues(form);

        const list = form.querySelector('[data-core-list]');
        if (!list) return;

        const total = totalCore(form);
        const maxPage = Math.max(Math.ceil(total / coreRowsPerPage), 1);
        form._corePage = Math.min(Math.max(form._corePage || 1, 1), maxPage);

        const start = (form._corePage - 1) * coreRowsPerPage + 1;
        const end = Math.min(start + coreRowsPerPage - 1, total);
        list.innerHTML = '';

        for (let core = start; core <= end; core++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-2 gap-4';
            row.innerHTML = `
                <div class="px-4 py-3 rounded-lg bg-gray-100 text-gray-900 font-medium">Core ${core}</div>
                <input type="number" step="0.01" name="attenuations[${core}]" data-core-input="${core}" value="${form._attenuations[core] ?? ''}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="cth: -7">
            `;
            list.appendChild(row);
        }

        renderPagination(form, maxPage);
    }

    function renderPagination(form, maxPage) {
        const buttons = form.querySelector('[data-page-buttons]');
        const prev = form.querySelector('[data-prev-page]');
        const next = form.querySelector('[data-next-page]');

        if (!buttons || !prev || !next) return;

        buttons.innerHTML = '';
        for (let page = 1; page <= maxPage; page++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = page;
            button.className = page === form._corePage
                ? 'h-10 min-w-10 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium'
                : 'h-10 min-w-10 px-3 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200';
            button.addEventListener('click', () => {
                captureCoreValues(form);
                form._corePage = page;
                renderCorePage(form);
            });
            buttons.appendChild(button);
        }

        prev.disabled = form._corePage === 1;
        next.disabled = form._corePage === maxPage;
        prev.classList.toggle('opacity-50', prev.disabled);
        next.classList.toggle('opacity-50', next.disabled);
    }

    document.querySelectorAll('[data-closure-wizard]').forEach((form) => {
        parseWizardValues(form);
        renderCorePage(form);

        form.querySelector('[data-next-step]')?.addEventListener('click', () => {
            if (!validateClosureStep(form)) return;
            form._corePage = 1;
            renderCorePage(form);
            showWizardStep(form, 2);
        });

        form.querySelector('[data-back-step]')?.addEventListener('click', () => {
            captureCoreValues(form);
            showWizardStep(form, 1);
        });

        form.querySelector('[data-prev-page]')?.addEventListener('click', () => {
            captureCoreValues(form);
            form._corePage = Math.max((form._corePage || 1) - 1, 1);
            renderCorePage(form);
        });

        form.querySelector('[data-next-page]')?.addEventListener('click', () => {
            captureCoreValues(form);
            form._corePage = (form._corePage || 1) + 1;
            renderCorePage(form);
        });

        document.getElementById(form.dataset.totalInput)?.addEventListener('change', () => {
            form._corePage = 1;
            renderCorePage(form);
        });

        form.addEventListener('submit', () => prepareSubmitValues(form));
    });

    @if($errors->any() && old('form_mode') === 'create')
        openModal('createClosureModal');
    @endif

    @if($errors->any() && old('editing_id'))
        openModal('editClosureModal{{ old('editing_id') }}');
    @endif
</script>
@endpush
