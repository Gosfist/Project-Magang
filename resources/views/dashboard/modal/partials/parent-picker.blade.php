@php
    $selectedParent = $parents->first(
        fn ($parent) => (string) $parent->id === (string) $selectedParentId,
    );
    $selectedParentCategory = $selectedParent?->tipe_titik;
@endphp

<div class="grid gap-4 sm:grid-cols-2">
    <div>
        <label class="mb-1 block text-sm font-medium">Kategori</label>
        <select data-parent-category required
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="">Pilih kategori</option>
            @foreach ($labels as $value => $label)
                <option value="{{ $value }}" @selected($selectedParentCategory === $value)>{{ $label }}</option>
            @endforeach
        </select>
    </div>

    <div class="relative" data-parent-combobox>
        @if (old('form_mode') === $mode)
            @error('parent_id')
                <p class="mb-1 text-xs text-red-600">{{ $message }}</p>
            @enderror
        @endif
        <label class="mb-1 block text-sm font-medium">Sumber Jalur</label>
        <div class="relative">
            <input type="search" data-parent-search autocomplete="off" required
                value="{{ $selectedParent?->nama_titik }}"
                placeholder="{{ $selectedParentCategory ? 'Cari atau pilih sumber jalur...' : 'Pilih kategori terlebih dahulu' }}"
                @disabled(! $selectedParentCategory)
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400">
            <input type="hidden" name="parent_id" value="{{ $selectedParentId }}" data-parent-id
                data-current-parent="{{ $node?->parent_id }}">
            <button type="button" data-parent-dropdown-button aria-label="Buka daftar sumber jalur"
                @disabled(! $selectedParentCategory)
                class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 disabled:text-gray-300">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>

        <div data-parent-options
            class="absolute z-30 mt-1 hidden max-h-52 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            @foreach ($parents as $parent)
                @php
                    $usedPorts = $parent->children
                        ->reject(fn ($child) => $node && $child->id === $node->id)
                        ->pluck('parent_port_out')
                        ->filter()
                        ->values();
                @endphp
                <button type="button" data-parent-option data-parent-id-value="{{ $parent->id }}"
                    data-parent-name="{{ $parent->nama_titik }}"
                    data-parent-type="{{ $parent->tipe_titik }}"
                    data-output-count="{{ $parent->jumlah_output ?? 0 }}"
                    data-used-ports="{{ json_encode($usedPorts) }}"
                    class="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                    {{ $parent->nama_titik }}
                </button>
            @endforeach
            <p data-parent-empty class="hidden px-3 py-2 text-sm text-gray-400">Sumber jalur tidak ditemukan.</p>
        </div>
    </div>
</div>
