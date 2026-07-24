@extends('layouts.dashboard')
@section('page-title', 'Main Core Fiber')
@section('content')
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
    <form method="GET" class="flex gap-2">
        <input name="search" value="{{ $search }}" class="w-72 max-w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Cari nama CL atau alamat...">
        <button class="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cari</button>
    </form>
    <div class="flex flex-wrap gap-2">
        <button type="button" onclick="openClosureModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Tambah Closure</button>
    </div>
</div>

<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 font-semibold">Closure</div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-500">
                    <tr><th class="text-left px-5 py-3 w-16">No</th><th class="text-left px-5 py-3">Nama CL</th><th class="text-left px-5 py-3">Alamat</th><th class="text-left px-5 py-3">Catatan</th><th class="text-right px-5 py-3 min-w-56">Aksi</th></tr>
                </thead>
                <tbody>
                    @forelse($closures as $closure)
                    <tr class="border-t border-gray-100">
                        <td class="px-5 py-3 text-gray-600">{{ $closures->firstItem() + $loop->index }}</td>
                        <td class="px-5 py-3 font-medium">{{ $closure->nama_cl }}</td>
                        <td class="px-5 py-3">{{ $closure->alamat_cl ?? '-' }}</td>
                        <td class="px-5 py-3">{{ $closure->catatan ?: '-' }}</td>
                        <td class="px-5 py-3">
                            <div class="flex justify-end gap-2 whitespace-nowrap">
                                <a class="shrink-0 cursor-pointer px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700" href="{{ route('fiber.closures.show', $closure) }}">Detail</a>
                                <button type="button"
                                    class="shrink-0 cursor-pointer px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                    style="cursor: pointer;"
                                    onclick="openClosureModal({
                                        id: @js($closure->id),
                                        url: @js(route('fiber.closures.update', $closure)),
                                        nama_cl: @js($closure->nama_cl),
                                        alamat_cl: @js($closure->alamat_cl),
                                        catatan: @js($closure->catatan)
                                    })">Edit</button>
                                <form class="shrink-0" method="POST" action="{{ route('fiber.closures.destroy', $closure) }}" onsubmit="return confirm('Yakin ingin menghapus closure ini?')">
                                    @csrf
                                    @method('DELETE')
                                    <input type="hidden" name="redirect_to" value="fiber.dashboard">
                                    <button type="submit" class="inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-xs font-medium" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                    @empty
                    <tr><td colspan="5" class="px-5 py-8 text-center text-gray-400">Belum ada closure FO.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <div class="px-5 py-3">{{ $closures->links() }}</div>
</div>

<div id="closureModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-white rounded-lg shadow-xl">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 id="closureModalTitle" class="font-semibold text-gray-900">Tambah Closure FO</h2>
            <button type="button" onclick="closeClosureModal()" class="text-gray-400 hover:text-gray-700">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <form id="closureForm" method="POST" action="{{ route('fiber.closures.store') }}" class="p-5 space-y-4">
            @csrf
            <input id="closureFormMethod" type="hidden" name="_method" value="PUT" disabled>
            <input type="hidden" name="redirect_to" value="fiber.dashboard">
            <input id="closureFormMode" type="hidden" name="form_mode" value="closure_create">
            <input id="closureId" type="hidden" name="closure_id" value="{{ old('closure_id') }}">
            <div>
                <label class="block text-sm font-medium mb-1">Nama CL</label>
                <input id="closureName" name="nama_cl" value="{{ old('nama_cl') }}" required class="w-full px-4 py-2 border rounded-lg">
                @error('nama_cl')<p class="text-red-600 text-xs mt-1">{{ $message }}</p>@enderror
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Alamat</label>
                <textarea id="closureAddress" name="alamat_cl" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('alamat_cl') }}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Catatan</label>
                <textarea id="closureNotes" name="catatan" rows="3" class="w-full px-4 py-2 border rounded-lg">{{ old('catatan') }}</textarea>
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" onclick="closeClosureModal()" class="px-4 py-2 border rounded-lg">Batal</button>
                <button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Simpan</button>
            </div>
        </form>
    </div>
</div>

<script>
    const closureStoreUrl = @js(route('fiber.closures.store'));

    function openClosureModal(closure = null) {
        const modal = document.getElementById('closureModal');
        const form = document.getElementById('closureForm');
        const method = document.getElementById('closureFormMethod');
        const mode = document.getElementById('closureFormMode');
        const id = document.getElementById('closureId');
        const title = document.getElementById('closureModalTitle');
        const name = document.getElementById('closureName');
        const address = document.getElementById('closureAddress');
        const notes = document.getElementById('closureNotes');

        if (closure) {
            form.action = closure.url;
            method.disabled = false;
            mode.value = 'closure_edit';
            id.value = closure.id;
            title.textContent = 'Edit Closure FO';
            name.value = closure.nama_cl ?? '';
            address.value = closure.alamat_cl ?? '';
            notes.value = closure.catatan ?? '';
        } else {
            form.action = closureStoreUrl;
            method.disabled = true;
            mode.value = 'closure_create';
            id.value = '';
            title.textContent = 'Tambah Closure FO';
            name.value = '';
            address.value = '';
            notes.value = '';
        }

        modal?.classList.remove('hidden');
        modal?.classList.add('flex');
    }

    function closeClosureModal() {
        document.getElementById('closureModal')?.classList.add('hidden');
        document.getElementById('closureModal')?.classList.remove('flex');
    }

    @if ($errors->any() && old('form_mode') === 'closure_create')
        openClosureModal();
        document.getElementById('closureName').value = @js(old('nama_cl'));
        document.getElementById('closureAddress').value = @js(old('alamat_cl'));
        document.getElementById('closureNotes').value = @js(old('catatan'));
    @elseif ($errors->any() && old('form_mode') === 'closure_edit' && old('closure_id'))
        openClosureModal({
            id: @js(old('closure_id')),
            url: @js(route('fiber.closures.update', old('closure_id'))),
            nama_cl: @js(old('nama_cl')),
            alamat_cl: @js(old('alamat_cl')),
            catatan: @js(old('catatan'))
        });
    @endif
</script>
@endsection
