@extends('layouts.dashboard')
@section('page-title')
    <a href="{{ route('fiber.dashboard') }}" class="text-gray-800 hover:text-blue-600">&lt; Kembali</a>
@endsection
@section('content')
@if($errors->has('core'))
    <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ $errors->first('core') }}
    </div>
@endif

<div class="bg-white border border-gray-200 rounded-lg p-6 mb-5">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
            <h2 class="text-xl font-semibold">{{ $closure->nama_cl }}</h2>
            <p class="text-sm text-gray-500 mt-1">Alamat: {{ $closure->alamat_cl ?? '-' }}</p>
            @if($closure->catatan)<p class="text-sm text-gray-500 mt-1">Catatan: {{ $closure->catatan }}</p>@endif
        </div>
        <div class="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" onclick="openModal('coreModal')" @disabled($cables->isEmpty()) class="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed" style="cursor: pointer;">Tambah Core</button>
            <button type="button" onclick="openModal('cableModal')" class="shrink-0 px-4 py-2 bg-green-600 text-white rounded-lg text-sm" style="cursor: pointer;">Tambah Kabel</button>
        </div>
    </div>
</div>

<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
                <tr>
                    <th class="text-left px-5 py-3">Nama Kabel</th>
                    <th class="text-left px-5 py-3">Tujuan Closure</th>
                    <th class="text-left px-5 py-3">Core</th>
                    <th class="text-left px-5 py-3">Warna</th>
                    <th class="text-left px-5 py-3">Redaman Awal</th>
                    <th class="text-left px-5 py-3">Redaman Akhir</th>
                    <th class="text-right px-5 py-3">Action</th>
                </tr>
            </thead>
            <tbody>
                @forelse($cables as $cable)
                    @foreach($cable->cores as $core)
                        @php($splitter = $core->splitter)
                        @php($incomingOutput = $core->incomingSplitterOutputs->first())
                        @php($incomingDirectCore = $core->incomingDirectCores->first())
                        @php($redamanAwal = $incomingOutput?->redaman ?? $incomingDirectCore?->direct_redaman_awal ?? $incomingDirectCore?->redaman)
                        @php($targetClosures = $core->endpoints->where('fo_closure', '!=', $closure->fo_closure)->pluck('closure.nama_cl')->filter()->unique()->join(', '))
                        <tr class="border-t align-top">
                            <td class="px-5 py-4">
                                <div class="font-medium text-gray-900">{{ $cable->nama_kabel }}</div>
                            </td>
                            <td class="px-5 py-4">{{ $targetClosures ?: '-' }}</td>
                            <td class="px-5 py-4">Core {{ $core->nomer_core }}</td>
                            <td class="px-5 py-4">{{ $core->warna_core ?? '-' }}</td>
                            <td class="px-5 py-4">{{ $redamanAwal !== null ? $redamanAwal.' dB' : '-' }}</td>
                            <td class="px-5 py-4">{{ $core->redaman !== null ? $core->redaman.' dB' : '-' }}</td>
                            <td class="px-5 py-4 text-right">
                                <div class="flex justify-end gap-2 whitespace-nowrap">
                                    <button type="button" onclick="openModal('editCoreModal{{ $core->fo_core }}')" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs" style="cursor: pointer;">Edit</button>
                                    @if($splitter)
                                        <button type="button" onclick="openModal('detailCoreModal{{ $core->fo_core }}')" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs" style="cursor: pointer;">Detail</button>
                                    @endif
                                    <form method="POST" action="{{ route('fiber.closures.cores.destroy', [$closure, $core]) }}" onsubmit="return confirm('Yakin ingin menghapus core ini?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="px-3 py-1.5 rounded-lg text-xs" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @endforeach
                @empty
                    <tr><td colspan="7" class="px-5 py-8 text-center text-gray-400">Belum ada kabel pada closure ini.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

@foreach($cables as $cable)
    @foreach($cable->cores as $core)
        @php($splitter = $core->splitter)
        @php($outputs = $splitter?->outputs->keyBy('nomor_output') ?? collect())
        @php($splitterFormOpen = old('core_id') == $core->fo_core && old('splitter_form_open'))
        <div id="editCoreModal{{ $core->fo_core }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
            <div class="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" style="max-height: calc(100vh - 3rem);">
                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h2 class="font-semibold text-gray-900">Edit Core</h2>
                    <button type="button" onclick="closeModal('editCoreModal{{ $core->fo_core }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
                </div>
                <form method="POST" action="{{ route('fiber.closures.cores.update', [$closure, $core]) }}" class="flex min-h-0 flex-1 flex-col">
                    @csrf
                    @method('PATCH')
                    <input type="hidden" name="form_mode" value="core_edit">
                    <input type="hidden" name="core_id" value="{{ $core->fo_core }}">
                    <input type="hidden" name="splitter_form_open" value="{{ $splitterFormOpen ? 1 : 0 }}" data-splitter-form-open="{{ $core->fo_core }}">
                    <div class="space-y-4 overflow-y-auto px-5 py-5" style="height: 430px; max-height: calc(100vh - 13rem);">
                    <div data-core-edit-fields="{{ $core->fo_core }}" class="{{ $splitterFormOpen ? 'hidden' : 'space-y-4' }}">
                    <div>
                        <label class="block text-sm font-medium mb-1">Nama kabel</label>
                        <input value="{{ $cable->nama_kabel }}" disabled class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Core</label>
                        <input value="Core {{ $core->nomer_core }}" disabled class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Redaman</label>
                        <input name="redaman" value="{{ old('core_id') == $core->fo_core ? old('redaman') : $core->redaman }}" type="number" step="0.001" class="w-full px-4 py-2 border rounded-lg">
                        @if(old('core_id') == $core->fo_core) @error('redaman')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                    </div>
                    <div data-direct-target-fields="{{ $core->fo_core }}" class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-sm font-medium mb-1">Target CL</label>
                            <select name="target_closure" data-target-closure-select class="w-full px-4 py-2 border rounded-lg">
                                <option value="">Target CL kosong</option>
                                @foreach($closures->where('fo_closure', '!=', $closure->fo_closure) as $item)
                                    <option value="{{ $item->fo_closure }}" @selected((string)(old('core_id') == $core->fo_core ? old('target_closure', $core->target_closure) : $core->target_closure) === (string)$item->fo_closure)>{{ $item->nama_cl }}</option>
                                @endforeach
                            </select>
                            @if(old('core_id') == $core->fo_core) @error('target_closure')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Target Core</label>
                            <select name="target_core" data-target-core-select class="w-full px-4 py-2 border rounded-lg">
                                <option value="">Target Core kosong</option>
                                @foreach($targetCoreOptions as $targetEndpoint)
                                    @php($directTargetCore = $targetEndpoint->fiberCore)
                                    @if($directTargetCore)
                                        <option value="{{ $directTargetCore->fo_core }}" data-target-closure="{{ $targetEndpoint->fo_closure }}" @selected((string)(old('core_id') == $core->fo_core ? old('target_core', $core->target_core) : $core->target_core) === (string)$directTargetCore->fo_core)>
                                            {{ $targetEndpoint->closure?->nama_cl }} - {{ $directTargetCore->cable?->nama_kabel }} Core {{ $directTargetCore->nomer_core }}
                                        </option>
                                    @endif
                                @endforeach
                            </select>
                            @if(old('core_id') == $core->fo_core) @error('target_core')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Catatan</label>
                        <textarea name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('core_id') == $core->fo_core ? old('catatan', $core->catatan) : $core->catatan }}</textarea>
                    </div>
                    </div>
                    <div data-splitter-fields="{{ $core->fo_core }}" class="{{ $splitterFormOpen ? '' : 'hidden' }} space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Status splitter</label>
                            <select name="splitter_status" data-splitter-status="{{ $core->fo_core }}" class="w-full px-4 py-2 border rounded-lg">
                                @php($selectedStatus = old('core_id') == $core->fo_core ? old('splitter_status', $splitter ? 'active' : 'inactive') : ($splitter ? 'active' : 'inactive'))
                                <option value="active" @selected($selectedStatus === 'active')>Aktif</option>
                                <option value="inactive" @selected($selectedStatus === 'inactive')>Non Aktif</option>
                            </select>
                            @if(old('core_id') == $core->fo_core) @error('splitter_status')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                            @if(old('core_id') == $core->fo_core) @error('redaman')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                        </div>
                        <div data-active-splitter-fields="{{ $core->fo_core }}" class="{{ $selectedStatus === 'active' ? '' : 'hidden' }} space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Split</label>
                            <select name="rasio_split" data-ratio-select="{{ $core->fo_core }}" class="w-full px-4 py-2 border rounded-lg">
                                @foreach(\App\Models\FoSplitter::RATIOS as $ratio)
                                    <option value="{{ $ratio }}" @selected((old('core_id') == $core->fo_core ? old('rasio_split', $splitter?->rasio_split) : $splitter?->rasio_split) === $ratio)>{{ $ratio }}</option>
                                @endforeach
                            </select>
                            @if(old('core_id') == $core->fo_core) @error('rasio_split')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            @for($i = 1; $i <= 8; $i++)
                                @php($output = $outputs->get($i))
                                <div data-output-row="{{ $core->fo_core }}" data-output-number="{{ $i }}" class="border rounded-lg p-3 space-y-2 {{ $i > (int) str_replace('1:', '', $splitter?->rasio_split ?? old('rasio_split', '1:4')) ? 'hidden' : '' }}">
                                    <div class="font-medium text-sm">Split {{ $i }}</div>
                                    <input name="outputs[{{ $i }}][redaman]" value="{{ old('core_id') == $core->fo_core ? old('outputs.'.$i.'.redaman', $output?->redaman) : $output?->redaman }}" type="number" step="0.001" placeholder="Redaman" class="w-full px-3 py-2 border rounded-lg text-sm">
                                    <select name="outputs[{{ $i }}][target_closure]" data-target-closure-select class="w-full px-3 py-2 border rounded-lg text-sm">
                                        <option value="">Target CL kosong</option>
                                        @foreach($closures->where('fo_closure', '!=', $closure->fo_closure) as $item)
                                            <option value="{{ $item->fo_closure }}" @selected((string)(old('core_id') == $core->fo_core ? old('outputs.'.$i.'.target_closure', $output?->target_closure) : $output?->target_closure) === (string)$item->fo_closure)>{{ $item->nama_cl }}</option>
                                        @endforeach
                                    </select>
                                    <select name="outputs[{{ $i }}][target_core]" data-target-core-select class="w-full px-3 py-2 border rounded-lg text-sm">
                                        <option value="">Target Core kosong</option>
                                        @foreach($targetCoreOptions as $targetEndpoint)
                                            @php($targetCore = $targetEndpoint->fiberCore)
                                            @if($targetCore)
                                                <option value="{{ $targetCore->fo_core }}" data-target-closure="{{ $targetEndpoint->fo_closure }}" @selected((string)(old('core_id') == $core->fo_core ? old('outputs.'.$i.'.target_core', $output?->target_core) : $output?->target_core) === (string)$targetCore->fo_core)>
                                                    {{ $targetEndpoint->closure?->nama_cl }} - {{ $targetCore->cable?->nama_kabel }} Core {{ $targetCore->nomer_core }}
                                                </option>
                                            @endif
                                        @endforeach
                                    </select>
                                    @if(old('core_id') == $core->fo_core) @error('outputs.'.$i.'.target_core')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
                                </div>
                            @endfor
                        </div>
                        </div>
                    </div>
                    </div>
                    <div class="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div data-footer-left-spacer="{{ $core->fo_core }}" class="{{ $splitterFormOpen ? '' : 'hidden' }} h-10 w-[103px]" style="width: 103px;" aria-hidden="true"></div>
                        <button type="button" data-splitter-button="{{ $core->fo_core }}" onclick="openSplitterForm('{{ $core->fo_core }}')" class="{{ $splitterFormOpen ? 'hidden' : '' }} px-4 py-2 bg-green-600 text-white rounded-lg" style="cursor: pointer;">Splitter</button>
                        <div class="flex gap-2 justify-end">
                            <button type="button" onclick="closeModal('editCoreModal{{ $core->fo_core }}')" class="px-4 py-2 border rounded-lg" style="cursor: pointer;">Batal</button>
                            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg" style="cursor: pointer;">Simpan</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        @if($splitter)
            <div id="detailCoreModal{{ $core->fo_core }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
                <div class="w-full max-w-xl bg-white rounded-lg shadow-xl">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                        <h2 class="font-semibold text-gray-900">Detail Split Core {{ $core->nomer_core }}</h2>
                        <button type="button" onclick="closeModal('detailCoreModal{{ $core->fo_core }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
                    </div>
                    <div class="p-5 overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-gray-600">
                                <tr>
                                    <th class="text-left px-3 py-2">Split</th>
                                    <th class="text-left px-3 py-2">Target CL</th>
                                    <th class="text-left px-3 py-2">Target Core</th>
                                    <th class="text-left px-3 py-2">Redaman Awal</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($splitter->outputs as $output)
                                    <tr class="border-t">
                                        <td class="px-3 py-2">Split {{ $output->nomor_output }}</td>
                                        <td class="px-3 py-2">{{ $output->targetClosure?->nama_cl ?? '-' }}</td>
                                        <td class="px-3 py-2">
                                            {{ $output->targetCore ? (($output->targetCore->cable?->nama_kabel ?? 'Kabel').' Core '.$output->targetCore->nomer_core) : '-' }}
                                        </td>
                                        <td class="px-3 py-2">{{ $output->redaman !== null ? $output->redaman.' dB' : '-' }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    <div class="px-5 py-4 border-t flex justify-end">
                        <button type="button" onclick="closeModal('detailCoreModal{{ $core->fo_core }}')" class="px-4 py-2 border rounded-lg" style="cursor: pointer;">Batal</button>
                    </div>
                </div>
            </div>
        @endif
    @endforeach
@endforeach

<div id="coreModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-lg bg-white rounded-lg shadow-xl">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 class="font-semibold text-gray-900">Tambah Core</h2>
            <button type="button" onclick="closeModal('coreModal')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form method="POST" action="{{ route('fiber.closures.cores.store', $closure) }}" class="p-5 space-y-4">
            @csrf
            <input type="hidden" name="form_mode" value="core_create">
            <div>
                <label class="block text-sm font-medium mb-1">Nama kabel</label>
                <select name="fo_kabel" required class="w-full px-4 py-2 border rounded-lg">
                    @foreach($cables as $cable)
                        <option value="{{ $cable->fo_kabel }}" @selected((string)old('fo_kabel') === (string)$cable->fo_kabel)>{{ $cable->nama_kabel }}</option>
                    @endforeach
                </select>
                @if(old('form_mode') === 'core_create') @error('fo_kabel')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Jumlah core</label>
                <input name="jumlah_core" value="{{ old('form_mode') === 'core_create' ? old('jumlah_core', 1) : 1 }}" type="number" min="1" required class="w-full px-4 py-2 border rounded-lg">
                @if(old('form_mode') === 'core_create') @error('jumlah_core')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="closeModal('coreModal')" class="px-4 py-2 border rounded-lg" style="cursor: pointer;">Batal</button>
                <button class="px-4 py-2 bg-blue-600 text-white rounded-lg" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>

<div id="cableModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-white rounded-lg shadow-xl">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 class="font-semibold text-gray-900">Tambah Kabel FO</h2>
            <button type="button" onclick="closeModal('cableModal')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form method="POST" action="{{ route('fiber.cables.store') }}" class="p-5 space-y-4">
            @csrf
            <input type="hidden" name="redirect_to" value="fiber.closures.show">
            <input type="hidden" name="redirect_closure_id" value="{{ $closure->fo_closure }}">
            <input type="hidden" name="form_mode" value="cable_create">
            <input type="hidden" name="source_closure_id" value="{{ $closure->fo_closure }}">
            <div>
                <label class="block text-sm font-medium mb-1">Nama kabel</label>
                <input name="nama_kabel" value="{{ old('form_mode') === 'cable_create' ? old('nama_kabel') : '' }}" required class="w-full px-4 py-2 border rounded-lg">
                @if(old('form_mode') === 'cable_create') @error('nama_kabel')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Closure tujuan</label>
                <select name="destination_closure_id" class="w-full px-4 py-2 border rounded-lg">
                    <option value="">Kosong</option>
                    @foreach($closures->where('fo_closure', '!=', $closure->fo_closure) as $item)
                        <option value="{{ $item->fo_closure }}" @selected((string)old('destination_closure_id') === (string)$item->fo_closure)>{{ $item->nama_cl }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Jumlah core</label>
                <input name="jumlah_core" value="{{ old('form_mode') === 'cable_create' ? old('jumlah_core', 1) : 1 }}" type="number" min="1" required class="w-full px-4 py-2 border rounded-lg">
                @if(old('form_mode') === 'cable_create') @error('jumlah_core')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror @endif
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Catatan</label>
                <textarea name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('form_mode') === 'cable_create' ? old('catatan') : '' }}</textarea>
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="closeModal('cableModal')" class="px-4 py-2 border rounded-lg" style="cursor: pointer;">Batal</button>
                <button class="px-4 py-2 bg-blue-600 text-white rounded-lg" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>

<script>
    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        adjustModalPosition(modal);
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        resetModalState(modal);
    }

    function adjustModalPosition(modal) {
        const content = modal.firstElementChild;
        if (!content) return;

        requestAnimationFrame(() => {
            const needsScroll = content.offsetHeight + 48 > window.innerHeight;
            modal.classList.toggle('items-start', needsScroll);
            modal.classList.toggle('items-center', !needsScroll);
        });
    }

    function resetModalState(modal) {
        modal.querySelectorAll('[data-core-edit-fields]').forEach((fields) => {
            fields.classList.remove('hidden');
            fields.classList.add('space-y-4');
        });
        modal.querySelectorAll('[data-direct-target-fields]').forEach((fields) => fields.classList.remove('hidden'));
        modal.querySelectorAll('[data-splitter-fields]').forEach((fields) => fields.classList.add('hidden'));
        modal.querySelectorAll('[data-footer-left-spacer]').forEach((spacer) => spacer.classList.add('hidden'));
        modal.querySelectorAll('[data-splitter-button]').forEach((button) => button.classList.remove('hidden'));
        modal.querySelectorAll('[data-splitter-form-open]').forEach((input) => {
            input.value = '0';
        });
    }

    function outputCount(ratio) {
        return Number(String(ratio || '1:4').replace('1:', '')) || 4;
    }

    function refreshSplitterRows(coreId) {
        const select = document.querySelector(`[data-ratio-select="${coreId}"]`);
        const count = outputCount(select?.value);
        document.querySelectorAll(`[data-output-row="${coreId}"]`).forEach((row) => {
            row.classList.toggle('hidden', Number(row.dataset.outputNumber) > count);
        });
    }

    function refreshSplitterStatus(coreId) {
        const status = document.querySelector(`[data-splitter-status="${coreId}"]`);
        const activeFields = document.querySelector(`[data-active-splitter-fields="${coreId}"]`);
        const isActive = status?.value === 'active';
        activeFields?.classList.toggle('hidden', !isActive);
        document.querySelector(`[data-direct-target-fields="${coreId}"]`)?.classList.toggle('hidden', isActive);

        if (!isActive) {
            document.querySelector(`[data-core-edit-fields="${coreId}"]`)?.classList.remove('hidden');
        }

        refreshSplitterRows(coreId);
        const modal = status?.closest('[id^="editCoreModal"]');
        if (modal) adjustModalPosition(modal);
    }

    function openSplitterForm(coreId) {
        document.querySelector(`[data-core-edit-fields="${coreId}"]`)?.classList.add('hidden');
        document.querySelector(`[data-direct-target-fields="${coreId}"]`)?.classList.add('hidden');
        document.querySelector(`[data-splitter-fields="${coreId}"]`)?.classList.remove('hidden');
        document.querySelector(`[data-footer-left-spacer="${coreId}"]`)?.classList.remove('hidden');
        document.querySelector(`[data-splitter-button="${coreId}"]`)?.classList.add('hidden');
        const input = document.querySelector(`[data-splitter-form-open="${coreId}"]`);
        if (input) input.value = '1';
        refreshSplitterStatus(coreId);
        const modal = input?.closest('[id^="editCoreModal"]');
        if (modal) adjustModalPosition(modal);
    }

    document.querySelectorAll('[data-splitter-status]').forEach((status) => {
        status.addEventListener('change', () => refreshSplitterStatus(status.dataset.splitterStatus));
        refreshSplitterStatus(status.dataset.splitterStatus);
    });

    document.querySelectorAll('[data-splitter-form-open]').forEach((input) => {
        if (input.value === '1') {
            openSplitterForm(input.dataset.splitterFormOpen);
        }
    });

    document.querySelectorAll('[data-ratio-select]').forEach((select) => {
        select.addEventListener('change', () => refreshSplitterRows(select.dataset.ratioSelect));
    });

    function refreshTargetCoreOptions(closureSelect) {
        const wrapper = closureSelect.closest('[data-output-row]') || closureSelect.closest('[data-direct-target-fields]');
        const coreSelect = wrapper?.querySelector('[data-target-core-select]');
        if (!coreSelect) return;

        const selectedClosure = closureSelect.value;
        let selectedCoreStillVisible = false;

        coreSelect.querySelectorAll('option').forEach((option) => {
            if (!option.value) {
                option.hidden = false;
                return;
            }

            const visible = selectedClosure && option.dataset.targetClosure === selectedClosure;
            option.hidden = !visible;
            if (visible && option.selected) {
                selectedCoreStillVisible = true;
            }
        });

        if (!selectedCoreStillVisible) {
            coreSelect.value = '';
        }
    }

    document.querySelectorAll('[data-target-closure-select]').forEach((select) => {
        select.addEventListener('change', () => refreshTargetCoreOptions(select));
        refreshTargetCoreOptions(select);
    });

    @if ($errors->any() && old('form_mode') === 'cable_create')
        openModal('cableModal');
    @endif

    @if ($errors->any() && old('form_mode') === 'core_create')
        openModal('coreModal');
    @endif

    @if ($errors->any() && old('form_mode') === 'core_edit' && old('core_id'))
        openModal('editCoreModal{{ old('core_id') }}');
    @endif
</script>
@endsection
