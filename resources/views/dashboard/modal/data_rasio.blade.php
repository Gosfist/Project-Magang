<div id="{{ $modalId }}" data-modal @if($errors->any() && old('form_mode') === $mode) data-modal-open-on-load @endif class="fixed inset-0 hidden items-center justify-center overflow-y-auto px-4 py-6" style="z-index: 10000;">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">{{ $title }}</h2>
            <button type="button" data-close-modal="{{ $modalId }}" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form data-maincore-form
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
                @include('dashboard.modal.partials.parent-picker')

                <div>
                    @if(old('form_mode') === $mode) @error('parent_port_out')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Pilih Port</label>
                    <select name="parent_port_out" data-port-select data-selected-port="{{ $selectedPort }}" disabled class="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100 disabled:text-gray-500">
                        <option value="">Pilih sumber jalur terlebih dahulu</option>
                    </select>
                </div>
            <p data-field-error="nama_titik" class="hidden text-xs text-red-600"></p>
            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    @if(old('form_mode') === $mode) @error('nama_titik')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">{{ $nameLabel }}</label>
                    <input name="nama_titik" value="{{ old('form_mode') === $mode ? old('nama_titik', $node?->nama_titik) : $node?->nama_titik }}" required class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    @if(old('form_mode') === $mode) @error('redaman_in')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Redaman In (dBm)</label>
                    <input name="redaman_in" value="{{ old('form_mode') === $mode ? old('redaman_in', $node?->redaman_in) : $node?->redaman_in }}" type="number" step="0.01" class="w-full rounded-lg border px-4 py-2">
                </div>
            </div>

            <div>
                    @if(old('form_mode') === $mode) @error('spesifikasi.jenis_splitter')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Jenis Splitter</label>
                    <select name="spesifikasi[jenis_splitter]" required data-splitter-select class="w-full rounded-lg border px-4 py-2">
                        <option value="">Pilih jenis splitter</option>
                        @foreach($ratioOptions as $ratio)
                            <option value="{{ $ratio }}" @selected((string)(old('form_mode') === $mode ? old('spesifikasi.jenis_splitter', $node?->jenis_splitter) : $node?->jenis_splitter) === $ratio)>{{ $ratio }}</option>
                        @endforeach
                    </select>
            </div>

            @php
                        $rasioPorts = old('form_mode') === $mode ? old('spesifikasi.rasio_redaman_ports', $node?->rasio_redaman_ports ?? []) : ($node?->rasio_redaman_ports ?? []);
            @endphp
            <div data-rasio-redaman-wrapper class="hidden">
                        <div class="grid gap-4 sm:grid-cols-2">
                            @for($port = 1; $port <= 4; $port++)
                                <div data-rasio-redaman-port="{{ $port }}" class="hidden">
                                    @if(old('form_mode') === $mode) @error('spesifikasi.rasio_redaman_ports.'.$port)<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                                    <label class="mb-1 block text-sm font-medium">Port {{ $port }}</label>
                                    <input name="spesifikasi[rasio_redaman_ports][{{ $port }}]" value="{{ $rasioPorts[$port] ?? '' }}" placeholder="{{ $port === 1 ? '10%' : ($port === 2 ? '90%' : '') }}" class="w-full rounded-lg border px-4 py-2">
                                </div>
                            @endfor
                        </div>
            </div>

            <div>
                    @if(old('form_mode') === $mode) @error('alamat')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Alamat</label>
                    <textarea name="alamat" rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('form_mode') === $mode ? old('alamat', $node?->alamat) : $node?->alamat }}</textarea>
            </div>

            <div class="flex justify-end gap-2">
                <button type="button" data-close-modal="{{ $modalId }}" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                <button type="submit" class="rounded-lg bg-slate-950 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>
