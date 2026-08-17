@php
    // Saat Edit, hanya parent yang sedang dipakai yang disiapkan; kandidat lain dicari lewat API.
    $selectedParent = $node?->parent;
    $selectedParentCategory = $selectedParent?->tipe_titik;
    $selectedUsedPorts = $selectedParent
        ? $selectedParent->children
            ->reject(fn ($child) => $node && $child->id === $node->id)
            ->pluck('parent_port_out')
            ->filter()
            ->values()
        : collect();
@endphp

<div class="grid gap-4 sm:grid-cols-2">
    <div>
        <label class="mb-1 block text-sm font-medium">Kategori</label>
        <select data-parent-category required
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
            <option value="">Pilih kategori</option>
            @foreach ($labels as $value => $label)
                <option value="{{ $value }}" @selected($selectedParentCategory === $value)>{{ $label }}</option>
            @endforeach
        </select>
    </div>

    <div class="relative" data-parent-combobox
        data-parent-api-url="{{ route('api.maincore.parents', $section) }}"
        data-current-node-id="{{ $node?->id }}"
        data-current-parent-id="{{ $node?->parent_id }}">
        @if (old('form_mode') === $mode)
            @error('parent_id')
                <p class="mb-1 text-xs text-red-600">{{ $message }}</p>
            @enderror
        @endif
        <label class="mb-1 block text-sm font-medium">Sumber Jalur</label>
        <div class="relative">
            <input type="search" data-parent-search autocomplete="off" required
                value="{{ $selectedParent?->nama_titik }}"
                placeholder="{{ $selectedParentCategory ? 'Ketik minimal 2 karakter...' : 'Pilih kategori terlebih dahulu' }}"
                @disabled(! $selectedParentCategory)
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-gray-100 disabled:text-gray-400">
            <input type="hidden" name="parent_id" value="{{ $node?->parent_id }}" data-parent-id
                data-current-parent="{{ $node?->parent_id }}">
            <button type="button" data-parent-dropdown-button aria-label="Buka pencarian sumber jalur"
                @disabled(! $selectedParentCategory)
                class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 disabled:text-gray-300">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>

        <div data-parent-options
            class="absolute z-30 mt-1 hidden max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            @if ($selectedParent)
                {{-- Simpan satu pilihan aktif agar port Edit dapat disusun tanpa mengambil seluruh parent. --}}
                <button type="button" data-parent-option data-parent-id-value="{{ $selectedParent->id }}"
                    data-parent-name="{{ $selectedParent->nama_titik }}"
                    data-parent-type="{{ $selectedParent->tipe_titik }}"
                    data-output-count="{{ $selectedParent->jumlah_output ?? 0 }}"
                    data-used-ports="{{ json_encode($selectedUsedPorts) }}"
                    class="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-100 hover:text-slate-950">
                    {{ $selectedParent->nama_titik }}
                </button>
            @endif
            <p data-parent-empty class="hidden px-3 py-2 text-sm text-gray-400">Ketik minimal 2 karakter.</p>
        </div>
    </div>
</div>
