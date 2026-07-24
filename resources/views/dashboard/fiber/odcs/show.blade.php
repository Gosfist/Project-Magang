@extends('layouts.dashboard')
@section('page-title')
    <a href="{{ route('fiber.dashboard') }}" class="text-gray-800 hover:text-blue-600">Kembali</a>
@endsection
@section('content')
@php
    $formatDate = function ($date) {
        if (! $date) return '-';
        $months = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        $value = \Carbon\Carbon::parse($date);
        return $value->format('d').' '.$months[(int) $value->format('n')].' '.$value->format('Y');
    };
    $formatRedaman = fn ($value) => $value === null ? '-' : rtrim(rtrim(number_format((float) $value, 3, '.', ''), '0'), '.').' dB';
@endphp

<div class="mb-5 rounded-lg border border-gray-200 bg-white p-6">
    <h2 class="text-xl font-semibold">{{ $odc->nama_odc }}</h2>
    <div class="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-4">
        <div>Core Server: Core {{ $odc->serverCore?->core ?? '-' }}</div>
        <div>Rasio: {{ str_replace(':', ' : ', $odc->rasio_split) }}</div>
        <div>Redaman: {{ $formatRedaman($odc->redaman) }}</div>
        <div>Tanggal: {{ $formatDate($odc->tanggal) }}</div>
    </div>
</div>

<div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
    <div class="border-b border-gray-200 px-5 py-4 font-semibold">Output ODC</div>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
                <tr>
                    <th class="w-16 px-5 py-3 text-left">No</th>
                    <th class="px-5 py-3 text-left">To ODP</th>
                    <th class="px-5 py-3 text-left">Redaman</th>
                    <th class="px-5 py-3 text-left">Tanggal</th>
                    <th class="px-5 py-3 text-right">Action</th>
                </tr>
            </thead>
            <tbody>
                @forelse($odc->outputs as $output)
                    <tr class="border-t border-gray-100">
                        <td class="px-5 py-3">{{ $output->output_number }}</td>
                        <td class="px-5 py-3">{{ $output->odp?->nama_odp ?? '-' }}</td>
                        <td class="px-5 py-3">{{ $formatRedaman($output->redaman) }}</td>
                        <td class="px-5 py-3">{{ $formatDate($output->tanggal) }}</td>
                        <td class="px-5 py-3">
                            <div class="flex justify-end gap-2 whitespace-nowrap">
                                <button type="button" onclick="openModal('editOutputModal{{ $output->main_odc_output }}')" class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white" style="cursor: pointer;">Edit</button>
                                <form method="POST" action="{{ route('fiber.odcs.outputs.destroy', [$odc, $output]) }}" onsubmit="return confirm('Yakin ingin mengosongkan output ini?')">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="rounded-lg px-3 py-1.5 text-xs" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="px-5 py-8 text-center text-gray-400">Belum ada output ODC.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

@foreach($odc->outputs as $output)
    <div id="editOutputModal{{ $output->main_odc_output }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div class="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 class="font-semibold">Edit Output {{ $output->output_number }}</h2>
                <button type="button" onclick="closeModal('editOutputModal{{ $output->main_odc_output }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
            </div>
            <form method="POST" action="{{ route('fiber.odcs.outputs.update', [$odc, $output]) }}" class="space-y-4 p-5">
                @csrf
                @method('PATCH')
                <div>
                    <label class="mb-1 block text-sm font-medium">To ODP</label>
                    <select name="main_odp" class="w-full rounded-lg border px-4 py-2">
                        <option value="">Kosong</option>
                        @foreach($odps as $odp)
                            <option value="{{ $odp->main_odp }}" @selected((string)old('main_odp', $output->main_odp) === (string)$odp->main_odp)>{{ $odp->nama_odp }}</option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Redaman</label>
                    <input name="redaman" value="{{ old('redaman', $output->redaman) }}" type="number" step="0.001" class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Tanggal</label>
                    <input name="tanggal" value="{{ old('tanggal', $output->tanggal) }}" type="date" class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Catatan</label>
                    <textarea name="catatan" rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('catatan', $output->catatan) }}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeModal('editOutputModal{{ $output->main_odc_output }}')" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                    <button class="rounded-lg bg-blue-600 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
                </div>
            </form>
        </div>
    </div>
@endforeach

<script>
    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
</script>
@endsection
