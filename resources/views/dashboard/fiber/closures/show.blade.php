@extends('layouts.dashboard')
@section('page-title', $closure->nama_cl)
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
                    <th class="text-left px-5 py-3">Core</th>
                    <th class="text-left px-5 py-3">Warna</th>
                    <th class="text-left px-5 py-3">Redaman</th>
                    <th class="text-right px-5 py-3">Action</th>
                </tr>
            </thead>
            <tbody>
                @forelse($cables as $cable)
                    @foreach($cable->cores as $core)
                        @php($splitter = $core->splitter)
                        <tr class="border-t align-top">
                            <td class="px-5 py-4">
                                <div class="font-medium text-gray-900">{{ $cable->nama_kabel }}</div>
                            </td>
                            <td class="px-5 py-4">Core {{ $core->nomer_core }}</td>
                            <td class="px-5 py-4">{{ $core->warna_core ?? '-' }}</td>
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
                    <tr><td colspan="5" class="px-5 py-8 text-center text-gray-400">Belum ada kabel pada closure ini.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

@foreach($cables as $cable)
    @foreach($cable->cores as $core)
        @php($splitter = $core->splitter)
        @php($outputs = $splitter?->outputs->keyBy('nomor_output') ?? collect())
        <div id="editCoreModal{{ $core->fo_core }}" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
            <div class="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h2 class="font-semibold text-gray-900">Edit Core</h2>
                    <button type="button" onclick="closeModal('editCoreModal{{ $core->fo_core }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
                </div>
                <form method="POST" action="{{ route('fiber.closures.cores.update', [$closure, $core]) }}" class="p-5 space-y-4">
                    @csrf
                    @method('PATCH')
                    <input type="hidden" name="form_mode" value="core_edit">
                    <input type="hidden" name="core_id" value="{{ $core->fo_core }}">
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
                    <div>
                        <label class="block text-sm font-medium mb-1">Catatan</label>
                        <textarea name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('core_id') == $core->fo_core ? old('catatan', $core->catatan) : $core->catatan }}</textarea>
                    </div>
                    <label class="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" name="add_splitter" value="1" data-splitter-toggle="{{ $core->fo_core }}" @checked($splitter || old('core_id') == $core->fo_core && old('add_splitter'))>
                        Add splitter
                    </label>
                    <div data-splitter-fields="{{ $core->fo_core }}" class="{{ $splitter || old('core_id') == $core->fo_core && old('add_splitter') ? '' : 'hidden' }} space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Split</label>
                            <select name="rasio_split" data-ratio-select="{{ $core->fo_core }}" class="w-full px-4 py-2 border rounded-lg">
                                @foreach(\App\Models\FoSplitter::RATIOS as $ratio)
                                    <option value="{{ $ratio }}" @selected((old('core_id') == $core->fo_core ? old('rasio_split', $splitter?->rasio_split) : $splitter?->rasio_split) === $ratio)>{{ $ratio }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            @for($i = 1; $i <= 64; $i++)
                                @php($output = $outputs->get($i))
                                <div data-output-row="{{ $core->fo_core }}" data-output-number="{{ $i }}" class="border rounded-lg p-3 space-y-2 {{ $i > (int) str_replace('1:', '', $splitter?->rasio_split ?? old('rasio_split', '1:4')) ? 'hidden' : '' }}">
                                    <div class="font-medium text-sm">Split {{ $i }}</div>
                                    <input name="outputs[{{ $i }}][redaman]" value="{{ old('core_id') == $core->fo_core ? old('outputs.'.$i.'.redaman', $output?->redaman) : $output?->redaman }}" type="number" step="0.001" placeholder="Redaman" class="w-full px-3 py-2 border rounded-lg text-sm">
                                    <select name="outputs[{{ $i }}][target_closure]" class="w-full px-3 py-2 border rounded-lg text-sm">
                                        <option value="">Target CL kosong</option>
                                        @foreach($closures as $item)
                                            <option value="{{ $item->fo_closure }}" @selected((string)(old('core_id') == $core->fo_core ? old('outputs.'.$i.'.target_closure', $output?->target_closure) : $output?->target_closure) === (string)$item->fo_closure)>{{ $item->nama_cl }}</option>
                                        @endforeach
                                    </select>
                                </div>
                            @endfor
                        </div>
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button type="button" onclick="closeModal('editCoreModal{{ $core->fo_core }}')" class="px-4 py-2 border rounded-lg" style="cursor: pointer;">Batal</button>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded-lg" style="cursor: pointer;">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
        @if($splitter)
            <div id="detailCoreModal{{ $core->fo_core }}" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
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
                                    <th class="text-left px-3 py-2">Redaman</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($splitter->outputs as $output)
                                    <tr class="border-t">
                                        <td class="px-3 py-2">Split {{ $output->nomor_output }}</td>
                                        <td class="px-3 py-2">{{ $output->targetClosure?->nama_cl ?? '-' }}</td>
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

<div id="coreModal" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
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

<div id="cableModal" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
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
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
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

    document.querySelectorAll('[data-splitter-toggle]').forEach((toggle) => {
        const coreId = toggle.dataset.splitterToggle;
        toggle.addEventListener('change', () => {
            document.querySelector(`[data-splitter-fields="${coreId}"]`)?.classList.toggle('hidden', !toggle.checked);
            refreshSplitterRows(coreId);
        });
        refreshSplitterRows(coreId);
    });

    document.querySelectorAll('[data-ratio-select]').forEach((select) => {
        select.addEventListener('change', () => refreshSplitterRows(select.dataset.ratioSelect));
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
