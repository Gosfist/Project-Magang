<div id="{{ $modalId }}" data-modal @if ($errors->any() && old('form_mode') === $mode) data-modal-open-on-load @endif
    class="fixed inset-0 hidden items-center justify-center overflow-y-auto bg-black/40 px-4 py-6" style="z-index: 10000;">
    @php($isCurrentForm = old('form_mode') === $mode)
    <div class="w-full max-w-3xl rounded-lg bg-white shadow-xl">
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
                    <label class="mb-1 block text-sm font-medium">Nama Pelanggan <span class="text-red-500">*</span></label>
                    <input name="customer_name" required value="{{ $isCurrentForm ? old('customer_name', $account?->customer_name) : $account?->customer_name }}" class="w-full rounded-lg border px-4 py-2">
                    @if ($isCurrentForm) @error('customer_name')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Paket <span class="text-red-500">*</span></label>
                    @php($selectedPackage = (string) ($isCurrentForm ? old('pppoe_package_id', $account?->pppoe_package_id) : $account?->pppoe_package_id))
                    <select name="pppoe_package_id" required class="w-full rounded-lg border px-4 py-2">
                        <option value="">Pilih paket</option>
                        @foreach ($packages as $packageOption)
                            <option value="{{ $packageOption->id }}" @selected($selectedPackage === (string) $packageOption->id)>
                                {{ $packageOption->name }} - {{ $packageOption->download_mbps }}/{{ $packageOption->upload_mbps }} Mbps{{ $packageOption->is_active ? '' : ' (Nonaktif)' }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Username PPPoE <span class="text-red-500">*</span></label>
                    <input name="username" maxlength="64" required autocomplete="off" value="{{ $isCurrentForm ? old('username', $account?->username) : $account?->username }}" class="w-full rounded-lg border px-4 py-2 font-mono">
                    @if ($isCurrentForm) @error('username')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Password PPPoE
                        @if ($account)<span class="text-xs font-normal text-gray-400">(kosongkan jika tetap)</span>@else<span class="text-red-500">*</span>@endif
                    </label>
                    <input type="password" name="password" maxlength="64" @required(!$account) autocomplete="new-password" class="w-full rounded-lg border px-4 py-2">
                    @if ($isCurrentForm) @error('password')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
                <div @class(['sm:col-span-2' => ! $account])>
                    <label class="mb-1 block text-sm font-medium">Nomor Telepon</label>
                    <input name="phone" value="{{ $isCurrentForm ? old('phone', $account?->phone) : $account?->phone }}" class="w-full rounded-lg border px-4 py-2">
                </div>
                @if ($account)
                    <div>
                        <label class="mb-1 block text-sm font-medium">Berlaku Sampai</label>
                        <input type="date" name="expires_at" value="{{ $isCurrentForm ? old('expires_at', $account->expires_at?->format('Y-m-d')) : $account->expires_at?->format('Y-m-d') }}" class="w-full rounded-lg border px-4 py-2">
                    </div>
                @endif
            </div>

            <div>
                <label class="mb-1 block text-sm font-medium">Alamat</label>
                <textarea name="address" rows="2" class="w-full rounded-lg border px-4 py-2">{{ $isCurrentForm ? old('address', $account?->address) : $account?->address }}</textarea>
            </div>

            @if ($account)
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label class="mb-1 block text-sm font-medium">Status</label>
                        @php($active = (string) ($isCurrentForm ? old('is_active', (int) $account->is_active) : (int) $account->is_active))
                        <select name="is_active" class="w-full rounded-lg border px-4 py-2">
                            <option value="1" @selected($active === '1')>Aktif</option>
                            <option value="0" @selected($active === '0')>Nonaktif</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-sm font-medium">Catatan</label>
                        <input name="notes" value="{{ $isCurrentForm ? old('notes', $account->notes) : $account->notes }}" class="w-full rounded-lg border px-4 py-2">
                    </div>
                </div>
            @endif

            <div class="flex justify-end gap-2">
                <button type="button" data-close-modal="{{ $modalId }}" class="rounded-lg border px-4 py-2">Batal</button>
                <button type="submit" class="rounded-lg bg-slate-950 px-4 py-2 text-white">Simpan</button>
            </div>
        </form>
    </div>
</div>
