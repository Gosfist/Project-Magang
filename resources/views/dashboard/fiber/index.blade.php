@extends('layouts.dashboard')
@section('page-title', 'Main Core Fiber')
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

<div class="space-y-5">
    @if($section === 'server')
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">Server</h2>
            <button type="button" onclick="openModal('serverModal')" class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" style="cursor: pointer;">Add Server</button>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="w-16 px-5 py-3 text-left">No</th>
                        <th class="px-5 py-3 text-left">Core</th>
                        <th class="px-5 py-3 text-left">Tanggal</th>
                        <th class="px-5 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($serverCores as $server)
                        <tr class="border-t border-gray-100">
                            <td class="px-5 py-3">{{ $loop->iteration }}</td>
                            <td class="px-5 py-3">Core {{ $server->core }}</td>
                            <td class="px-5 py-3">{{ $formatDate($server->tanggal) }}</td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-2 whitespace-nowrap">
                                    <button type="button" onclick="openModal('editServerModal{{ $server->main_server_core }}')" class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white" style="cursor: pointer;">Edit</button>
                                    <form method="POST" action="{{ route('fiber.servers.destroy', $server) }}" onsubmit="return confirm('Yakin ingin menghapus server core ini?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="rounded-lg px-3 py-1.5 text-xs" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="px-5 py-8 text-center text-gray-400">Belum ada core server.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @endif

    @if($section === 'odc')
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">ODC</h2>
            <button type="button" onclick="openModal('odcModal')" @disabled($serverCores->isEmpty()) class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed" style="cursor: pointer;">Add ODC</button>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="w-16 px-5 py-3 text-left">No</th>
                        <th class="px-5 py-3 text-left">Nama ODC</th>
                        <th class="px-5 py-3 text-left">Core Server</th>
                        <th class="px-5 py-3 text-left">Rasio Split</th>
                        <th class="px-5 py-3 text-left">Redaman</th>
                        <th class="px-5 py-3 text-left">Tanggal</th>
                        <th class="px-5 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($odcs as $odc)
                        <tr class="border-t border-gray-100">
                            <td class="px-5 py-3">{{ $loop->iteration }}</td>
                            <td class="px-5 py-3 font-medium">{{ $odc->nama_odc }}</td>
                            <td class="px-5 py-3">Core {{ $odc->serverCore?->core ?? '-' }}</td>
                            <td class="px-5 py-3">{{ str_replace(':', ' : ', $odc->rasio_split) }}</td>
                            <td class="px-5 py-3">{{ $formatRedaman($odc->redaman) }}</td>
                            <td class="px-5 py-3">{{ $formatDate($odc->tanggal) }}</td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-2 whitespace-nowrap">
                                    <a href="{{ route('fiber.odcs.show', $odc) }}" class="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white">Detail</a>
                                    <button type="button" onclick="openModal('editOdcModal{{ $odc->main_odc }}')" class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white" style="cursor: pointer;">Edit</button>
                                    <form method="POST" action="{{ route('fiber.odcs.destroy', $odc) }}" onsubmit="return confirm('Yakin ingin menghapus ODC ini?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="rounded-lg px-3 py-1.5 text-xs" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="px-5 py-8 text-center text-gray-400">Belum ada ODC.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @endif

    @if($section === 'odp')
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">ODP</h2>
            <button type="button" onclick="openModal('odpModal')" class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" style="cursor: pointer;">Add ODP</button>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="w-16 px-5 py-3 text-left">No</th>
                        <th class="px-5 py-3 text-left">Nama ODP</th>
                        <th class="px-5 py-3 text-left">Rasio</th>
                        <th class="px-5 py-3 text-left">Redaman</th>
                        <th class="px-5 py-3 text-left">Tanggal</th>
                        <th class="px-5 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($odps as $odp)
                        <tr class="border-t border-gray-100">
                            <td class="px-5 py-3">{{ $loop->iteration }}</td>
                            <td class="px-5 py-3 font-medium">{{ $odp->nama_odp }}</td>
                            <td class="px-5 py-3">{{ str_replace(':', ' : ', $odp->rasio_split) }}</td>
                            <td class="px-5 py-3">{{ $formatRedaman($odp->redaman) }}</td>
                            <td class="px-5 py-3">{{ $formatDate($odp->tanggal) }}</td>
                            <td class="px-5 py-3">
                                <div class="flex justify-end gap-2 whitespace-nowrap">
                                    <a href="{{ route('fiber.odps.show', $odp) }}" class="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white">Detail</a>
                                    <button type="button" onclick="openModal('editOdpModal{{ $odp->main_odp }}')" class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white" style="cursor: pointer;">Edit</button>
                                    <form method="POST" action="{{ route('fiber.odps.destroy', $odp) }}" onsubmit="return confirm('Yakin ingin menghapus ODP ini?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="rounded-lg px-3 py-1.5 text-xs" style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="px-5 py-8 text-center text-gray-400">Belum ada ODP.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
    @endif
</div>

<div id="serverModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">Add Server</h2>
            <button type="button" onclick="closeModal('serverModal')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form method="POST" action="{{ route('fiber.servers.store') }}" class="space-y-4 p-5">
            @csrf
            <input type="hidden" name="form_mode" value="server_create">
            <div>
                @if(old('form_mode') === 'server_create') @error('core')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                <label class="mb-1 block text-sm font-medium">Core</label>
                <input name="core" value="{{ old('form_mode') === 'server_create' ? old('core') : '' }}" type="number" min="1" required class="w-full rounded-lg border px-4 py-2">
            </div>
            <div>
                <label class="mb-1 block text-sm font-medium">Tanggal</label>
                <input name="tanggal" value="{{ old('form_mode') === 'server_create' ? old('tanggal') : '' }}" type="date" class="w-full rounded-lg border px-4 py-2">
            </div>
            <div>
                <label class="mb-1 block text-sm font-medium">Catatan</label>
                <textarea name="catatan" rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('form_mode') === 'server_create' ? old('catatan') : '' }}</textarea>
            </div>
            <div class="flex justify-end gap-2">
                <button type="button" onclick="closeModal('serverModal')" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                <button class="rounded-lg bg-blue-600 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
            </div>
        </form>
    </div>
</div>

<div id="odcModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">Add ODC</h2>
            <button type="button" onclick="closeModal('odcModal')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form method="POST" action="{{ route('fiber.odcs.store') }}" class="space-y-4 p-5">
            @csrf
            <input type="hidden" name="form_mode" value="odc_create">
            @include('dashboard.fiber.partials.odc-fields', ['odc' => null, 'serverCores' => $serverCores, 'mode' => 'odc_create'])
        </form>
    </div>
</div>

<div id="odpModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 class="font-semibold">Add ODP</h2>
            <button type="button" onclick="closeModal('odpModal')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
        </div>
        <form method="POST" action="{{ route('fiber.odps.store') }}" class="space-y-4 p-5">
            @csrf
            <input type="hidden" name="form_mode" value="odp_create">
            @include('dashboard.fiber.partials.odp-fields', ['odp' => null, 'mode' => 'odp_create'])
        </form>
    </div>
</div>

@foreach($serverCores as $server)
    <div id="editServerModal{{ $server->main_server_core }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div class="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 class="font-semibold">Edit Server</h2>
                <button type="button" onclick="closeModal('editServerModal{{ $server->main_server_core }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
            </div>
            <form method="POST" action="{{ route('fiber.servers.update', $server) }}" class="space-y-4 p-5">
                @csrf
                @method('PATCH')
                <input type="hidden" name="form_mode" value="server_edit_{{ $server->main_server_core }}">
                <div>
                    @if(old('form_mode') === 'server_edit_'.$server->main_server_core) @error('core')<p class="mb-1 text-xs text-red-600">{{ $message }}</p>@enderror @endif
                    <label class="mb-1 block text-sm font-medium">Core</label>
                    <input name="core" value="{{ old('form_mode') === 'server_edit_'.$server->main_server_core ? old('core', $server->core) : $server->core }}" type="number" min="1" required class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Tanggal</label>
                    <input name="tanggal" value="{{ old('form_mode') === 'server_edit_'.$server->main_server_core ? old('tanggal', $server->tanggal) : $server->tanggal }}" type="date" class="w-full rounded-lg border px-4 py-2">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Catatan</label>
                    <textarea name="catatan" rows="3" class="w-full rounded-lg border px-4 py-2">{{ old('form_mode') === 'server_edit_'.$server->main_server_core ? old('catatan', $server->catatan) : $server->catatan }}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeModal('editServerModal{{ $server->main_server_core }}')" class="rounded-lg border px-4 py-2" style="cursor: pointer;">Batal</button>
                    <button class="rounded-lg bg-blue-600 px-4 py-2 text-white" style="cursor: pointer;">Simpan</button>
                </div>
            </form>
        </div>
    </div>
@endforeach

@foreach($odcs as $odc)
    <div id="editOdcModal{{ $odc->main_odc }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 class="font-semibold">Edit ODC</h2>
                <button type="button" onclick="closeModal('editOdcModal{{ $odc->main_odc }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
            </div>
            <form method="POST" action="{{ route('fiber.odcs.update', $odc) }}" class="space-y-4 p-5">
                @csrf
                @method('PATCH')
                <input type="hidden" name="form_mode" value="odc_edit_{{ $odc->main_odc }}">
                @include('dashboard.fiber.partials.odc-fields', ['odc' => $odc, 'serverCores' => $serverCores, 'mode' => 'odc_edit_'.$odc->main_odc])
            </form>
        </div>
    </div>
@endforeach

@foreach($odps as $odp)
    <div id="editOdpModal{{ $odp->main_odp }}" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 class="font-semibold">Edit ODP</h2>
                <button type="button" onclick="closeModal('editOdpModal{{ $odp->main_odp }}')" class="text-gray-400 hover:text-gray-700" style="cursor: pointer;">X</button>
            </div>
            <form method="POST" action="{{ route('fiber.odps.update', $odp) }}" class="space-y-4 p-5">
                @csrf
                @method('PATCH')
                <input type="hidden" name="form_mode" value="odp_edit_{{ $odp->main_odp }}">
                @include('dashboard.fiber.partials.odp-fields', ['odp' => $odp, 'mode' => 'odp_edit_'.$odp->main_odp])
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

    @if($errors->any() && old('form_mode') === 'server_create') openModal('serverModal'); @endif
    @if($errors->any() && old('form_mode') === 'odc_create') openModal('odcModal'); @endif
    @if($errors->any() && old('form_mode') === 'odp_create') openModal('odpModal'); @endif
    @foreach($serverCores as $server)
        @if($errors->any() && old('form_mode') === 'server_edit_'.$server->main_server_core) openModal('editServerModal{{ $server->main_server_core }}'); @endif
    @endforeach
    @foreach($odcs as $odc)
        @if($errors->any() && old('form_mode') === 'odc_edit_'.$odc->main_odc) openModal('editOdcModal{{ $odc->main_odc }}'); @endif
    @endforeach
    @foreach($odps as $odp)
        @if($errors->any() && old('form_mode') === 'odp_edit_'.$odp->main_odp) openModal('editOdpModal{{ $odp->main_odp }}'); @endif
    @endforeach
</script>
@endsection
