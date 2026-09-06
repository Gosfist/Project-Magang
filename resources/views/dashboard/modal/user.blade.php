<div id="{{ $modalId }}" data-modal @if($errors->any() && old('form_mode') === $mode) data-modal-open-on-load @endif class="fixed inset-0 hidden items-center justify-center overflow-y-auto px-4 py-6" style="z-index: 10000;">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">{{ $title }}</h2>
            <button type="button" data-close-modal="{{ $modalId }}" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>

        <form method="POST" action="{{ $action }}" class="space-y-4 p-5">
            @csrf
            @if ($method !== 'POST')
                @method($method)
            @endif
            <input type="hidden" name="form_mode" value="{{ $mode }}">

            <div>
                <label class="mb-1 block text-sm font-medium">Nama <span class="text-red-500">*</span></label>
                <input name="name" value="{{ old('form_mode') === $mode ? old('name', $user?->name) : $user?->name }}" required class="w-full rounded-lg border px-4 py-2">
                @if (old('form_mode') === $mode) @error('name')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
            </div>

            <div>
                <label class="mb-1 block text-sm font-medium">Email <span class="text-red-500">*</span></label>
                <input type="email" name="email" value="{{ old('form_mode') === $mode ? old('email', $user?->email) : $user?->email }}" required class="w-full rounded-lg border px-4 py-2">
                @if (old('form_mode') === $mode) @error('email')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
            </div>

            <div>
                <label class="mb-1 block text-sm font-medium">Password
                    @if ($user)<span class="text-xs font-normal text-gray-400">(kosongkan jika tidak diubah)</span>@else<span class="text-red-500">*</span>@endif
                </label>
                <input type="password" name="password" @required(!$user) class="w-full rounded-lg border px-4 py-2">
                @if (old('form_mode') === $mode) @error('password')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
                <div>
                    <label class="mb-1 block text-sm font-medium">Role <span class="text-red-500">*</span></label>
                    <select name="role" required class="w-full rounded-lg border px-4 py-2">
                        @php($selectedRole = old('form_mode') === $mode ? old('role', $user?->role) : $user?->role)
                        <option value="">Pilih role</option>
                        <option value="admin" @selected($selectedRole === 'admin')>Admin</option>
                        <option value="petugas" @selected($selectedRole === 'petugas')>Petugas</option>
                    </select>
                    @if (old('form_mode') === $mode) @error('role')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Status <span class="text-red-500">*</span></label>
                    @php($selectedStatus = old('form_mode') === $mode ? old('status', $user?->status ?? 'active') : ($user?->status ?? 'active'))
                    <select name="status" required class="w-full rounded-lg border px-4 py-2">
                        <option value="active" @selected($selectedStatus === 'active')>Active</option>
                        <option value="inactive" @selected($selectedStatus === 'inactive')>Inactive</option>
                    </select>
                    @if (old('form_mode') === $mode) @error('status')<p class="mt-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                </div>
            </div>

            <div class="flex justify-end gap-2">
                <button type="button" data-close-modal="{{ $modalId }}" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                <button type="submit" class="rounded-lg bg-slate-950 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>
