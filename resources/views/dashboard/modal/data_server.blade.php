<div id="{{ $modalId }}" class="fixed inset-0 hidden items-center justify-center overflow-y-auto px-4 py-6" style="z-index: 10000;">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">{{ $title }}</h2>
            <button type="button" onclick="closeModal('{{ $modalId }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form data-ajax-form
            data-current-id="{{ $node?->id ?? 0 }}"
            data-existing-names='@json($existingNames)'
            data-unique-message="{{ $nameLabel }} sudah digunakan!"
            method="POST"
            action="{{ $action }}"
            class="space-y-4 p-5">
            @csrf
            @if($method !== 'POST')
                @method($method)
            @endif
            <input type="hidden" name="form_mode" value="{{ $mode }}">

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

            <div class="flex justify-end gap-2">
                <button type="button" onclick="closeModal('{{ $modalId }}')" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                <button type="submit" class="rounded-lg bg-blue-600 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>
