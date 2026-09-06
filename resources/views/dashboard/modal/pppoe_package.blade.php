<div id="{{ $modalId }}" data-modal @if ($errors->any() && old('form_mode') === $mode) data-modal-open-on-load @endif
    class="fixed inset-0 hidden items-center justify-center overflow-y-auto bg-black/40 px-4 py-6" style="z-index: 10000;">
    @php($isCurrentForm = old('form_mode') === $mode)
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b px-5 py-4">
            <h2 class="font-semibold">{{ $title }}</h2>
            <button type="button" data-close-modal="{{ $modalId }}" class="text-gray-500">X</button>
        </div>
        <form method="POST" action="{{ $action }}" class="space-y-4 p-5">
            @csrf
            @if ($method !== 'POST') @method($method) @endif
            <input type="hidden" name="form_mode" value="{{ $mode }}">

            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <label class="mb-1 block text-sm font-medium">Nama Paket <span class="text-red-500">*</span></label>
                    <input name="name" required value="{{ $isCurrentForm ? old('name', $package?->name) : $package?->name }}" class="w-full rounded-lg border px-4 py-2">
                    @if ($isCurrentForm) @error('name')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Harga Bulanan (Rp) <span class="text-red-500">*</span></label>
                    <input type="number" min="0" name="price" required value="{{ $isCurrentForm ? old('price', $package?->price ?? 0) : ($package?->price ?? 0) }}" class="w-full rounded-lg border px-4 py-2">
                    @if ($isCurrentForm) @error('price')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <label class="mb-1 block text-sm font-medium">Download (Mbps) <span class="text-red-500">*</span></label>
                    <input type="number" min="1" name="download_mbps" required value="{{ $isCurrentForm ? old('download_mbps', $package?->download_mbps) : $package?->download_mbps }}" class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Upload (Mbps) <span class="text-red-500">*</span></label>
                    <input type="number" min="1" name="upload_mbps" required value="{{ $isCurrentForm ? old('upload_mbps', $package?->upload_mbps) : $package?->upload_mbps }}" class="w-full rounded-lg border px-4 py-2">
                </div>
            </div>

            <div>
                <label class="mb-1 block text-sm font-medium">Nama IP Pool RouterOS</label>
                <input name="address_pool" placeholder="Contoh: pool-pppoe" value="{{ $isCurrentForm ? old('address_pool', $package?->address_pool) : $package?->address_pool }}" class="w-full rounded-lg border px-4 py-2">
                <p class="mt-1 text-xs text-gray-400">Harus sama dengan nama pool yang dibuat di CHR.</p>
            </div>

            <div class="flex justify-end gap-2">
                <button type="button" data-close-modal="{{ $modalId }}" class="rounded-lg border px-4 py-2">Batal</button>
                <button type="submit" class="rounded-lg bg-slate-950 px-4 py-2 text-white">Simpan</button>
            </div>
        </form>
    </div>
</div>
