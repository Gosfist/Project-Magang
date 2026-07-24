<div>
    @if(old('form_mode') === $mode) @error('nama_odp')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
    <label class="mb-1 block text-sm font-medium">Nama ODP</label>
    <input name="nama_odp" value="{{ old('form_mode') === $mode ? old('nama_odp', $odp?->nama_odp) : $odp?->nama_odp }}" required class="w-full rounded-lg border px-4 py-2">
</div>
<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
        <label class="mb-1 block text-sm font-medium">Rasio</label>
        <select name="rasio_split" required class="w-full rounded-lg border px-4 py-2">
            @foreach(\App\Models\MainOdp::RATIOS as $ratio)
                <option value="{{ $ratio }}" @selected((old('form_mode') === $mode ? old('rasio_split', $odp?->rasio_split) : $odp?->rasio_split) === $ratio)>{{ str_replace(':', ' : ', $ratio) }}</option>
            @endforeach
        </select>
    </div>
    <div>
        <label class="mb-1 block text-sm font-medium">Redaman</label>
        <input name="redaman" value="{{ old('form_mode') === $mode ? old('redaman', $odp?->redaman) : $odp?->redaman }}" type="number" step="0.001" class="w-full rounded-lg border px-4 py-2">
    </div>
</div>
<div>
    <label class="mb-1 block text-sm font-medium">Tanggal</label>
    <input name="tanggal" value="{{ old('form_mode') === $mode ? old('tanggal', $odp?->tanggal) : $odp?->tanggal }}" type="date" class="w-full rounded-lg border px-4 py-2">
</div>
<div>
    <label class="mb-1 block text-sm font-medium">Catatan</label>
    <textarea name="catatan" rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('form_mode') === $mode ? old('catatan', $odp?->catatan) : $odp?->catatan }}</textarea>
</div>
<div class="flex justify-end gap-2">
    <button type="button" onclick="closeModal(this.closest('[id]').id)" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
    <button class="rounded-lg bg-blue-600 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
</div>
