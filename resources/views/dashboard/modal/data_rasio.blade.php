<div id="{{ $modalId }}" data-modal @if($errors->any() && old('form_mode') === $mode) data-modal-open-on-load @endif class="fixed inset-0 hidden items-center justify-center overflow-y-auto px-4 py-6" style="z-index: 10000;">
    <div class="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">{{ $title }}</h2>
            <button type="button" data-close-modal="{{ $modalId }}" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form data-maincore-form data-node-type="{{ $section }}"
            method="POST"
            action="{{ $action }}"
            class="space-y-4 p-5">
            @csrf
            @if($method !== 'POST')
                @method($method)
            @endif
            <input type="hidden" name="form_mode" value="{{ $mode }}">

            @php
                    $selectedPort = old('form_mode') === $mode ? old('parent_port_out', $node?->parent_port_out) : $node?->parent_port_out;
            @endphp
            <div class="grid gap-4 md:grid-cols-3">
                @include('dashboard.modal.partials.parent-picker', ['parentPickerInline' => true])
                <div>
                    @if(old('form_mode') === $mode) @error('parent_port_out')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Pilih Port</label>
                    <select name="parent_port_out" data-port-select data-selected-port="{{ $selectedPort }}" disabled class="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100 disabled:text-gray-500">
                        <option value="">Pilih sumber jalur terlebih dahulu</option>
                    </select>
                </div>
            </div>
            <p data-field-error="nama_titik" class="hidden text-xs text-red-600"></p>
            <div class="grid gap-4 md:grid-cols-3">
                <div>
                    @if(old('form_mode') === $mode) @error('nama_titik')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">{{ $nameLabel }}</label>
                    <input name="nama_titik" value="{{ old('form_mode') === $mode ? old('nama_titik', $node?->nama_titik) : $node?->nama_titik }}" required class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    @if(old('form_mode') === $mode) @error('jarak_kabel')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Jarak Kabel (meter)</label>
                    <input name="jarak_kabel" value="{{ old('form_mode') === $mode ? old('jarak_kabel', $node?->jarak_kabel) : $node?->jarak_kabel }}" type="number" min="0" step="0.01" data-cable-distance class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    @if(old('form_mode') === $mode) @error('redaman_in')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Redaman In (dBm)</label>
                    <input name="redaman_in" value="{{ old('form_mode') === $mode ? old('redaman_in', $node?->redaman_in) : $node?->redaman_in }}" type="number" step="0.01" data-attenuation-input class="w-full rounded-lg border px-4 py-2">
                </div>
            </div>

            @php
                        $savedRasioPorts = $node?->rasio_redaman_ports ?? [];
                        $rasioPorts = old('form_mode') === $mode
                            ? old('spesifikasi.rasio_redaman_ports', $savedRasioPorts)
                            : $savedRasioPorts;
                        $rasioPorts = array_replace([1 => '10%', 2 => '90%'], is_array($rasioPorts) ? $rasioPorts : []);
            @endphp
            <div>
                <h3 class="mb-2 text-sm font-medium">Hasil Rasio</h3>
                <div class="grid gap-4 sm:grid-cols-2">
                        @for($port = 1; $port <= 2; $port++)
                            <div>
                                @if(old('form_mode') === $mode) @error('spesifikasi.rasio_redaman_ports.'.$port)<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                                <label for="rasioPort{{ $modalId }}-{{ $port }}" class="flex overflow-hidden rounded-lg border bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200">
                                    <span class="flex shrink-0 items-center border-r border-gray-900 bg-gray-100 px-4 text-sm font-semibold text-gray-900">Port {{ $port }}</span>
                                    <input id="rasioPort{{ $modalId }}-{{ $port }}" name="spesifikasi[rasio_redaman_ports][{{ $port }}]" value="{{ $rasioPorts[$port] ?? '' }}" placeholder="{{ $port === 1 ? '10%' : '90%' }}" class="min-w-0 flex-1 border-0 bg-transparent px-4 py-2.5 text-gray-900 outline-none ring-0 placeholder:text-gray-900">
                                </label>
                            </div>
                        @endfor
                </div>
            </div>

            <div>
                @if(old('form_mode') === $mode) @error('alamat')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                <label class="mb-1 block text-sm font-medium">Alamat</label>
                <textarea name="alamat" required rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('form_mode') === $mode ? old('alamat', $node?->alamat) : $node?->alamat }}</textarea>
            </div>

            <div class="flex justify-end gap-2">
                <button type="button" data-close-modal="{{ $modalId }}" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                <button type="submit" class="rounded-lg bg-slate-950 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>
