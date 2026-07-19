@extends('layouts.dashboard')
@section('page-title', 'Detail Splitter')
@section('content')
    <div class="mb-6">
        <a href="{{ route('splitters.index') }}" class="text-sm text-blue-600 hover:underline">← Kembali ke Daftar
            Splitter</a>
    </div>

    <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-900">{{ $splitter->splitter_name }}</h2>
            <span
                class="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">{{ $splitter->splitter_ratio }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span class="text-gray-500">Data Closure:</span> <span
                    class="font-medium text-gray-900 ml-1">{{ $splitter->mainCore->name ?? '-' }}</span></div>
            <div><span class="text-gray-500">Total Port:</span> <span
                    class="font-medium text-gray-900 ml-1">{{ $splitter->total_ports }} port</span></div>
            <div><span class="text-gray-500">Input:</span> <span
                    class="font-medium text-gray-900 ml-1">{{ $splitter->networkInput->source_name ?? '-' }}
                    ({{ $splitter->networkInput->input_attenuation ?? '-' }} dBm)</span></div>
            <div><span class="text-gray-500">Keterangan:</span> <span
                    class="text-gray-700 ml-1">{{ $splitter->description ?? '-' }}</span></div>
        </div>
    </div>

    <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-900 mb-4">Output Port</h3>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b">
                    <tr>
                        <th class="text-left px-4 py-2 text-gray-500 font-medium">Port</th>
                        <th class="text-left px-4 py-2 text-gray-500 font-medium">Tujuan Closure</th>
                        <th class="text-right px-4 py-2 text-gray-500 font-medium">Redaman Output</th>
                        <th class="text-right px-4 py-2 text-gray-500 font-medium">Selisih</th>
                        <th class="text-left px-4 py-2 text-gray-500 font-medium">Status</th>
                        <th class="text-left px-4 py-2 text-gray-500 font-medium">Keterangan</th>
                        <th class="text-right px-4 py-2 text-gray-500 font-medium">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($splitter->outputs as $output)
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium text-gray-900">Port {{ $output->port_number }}</td>
                            <td class="px-4 py-2 text-gray-600">
                                {{ $output->destinationMainCore->name ?? '-' }}
                            </td>
                            <td
                                class="px-4 py-2 text-right font-mono {{ $output->output_attenuation ? 'text-blue-600' : 'text-gray-400' }}">
                                {{ $output->output_attenuation ? $output->output_attenuation . ' dBm' : '-' }}</td>
                            <td
                                class="px-4 py-2 text-right font-mono {{ $output->attenuation_difference ? 'text-orange-600' : 'text-gray-400' }}">
                                {{ $output->attenuation_difference ? $output->attenuation_difference . ' dBm' : '-' }}</td>
                            <td class="px-4 py-2">
                                @php
                                    $colors = ['empty' => 'gray', 'active' => 'blue', 'damaged' => 'red'];
                                    $c = $colors[$output->status] ?? 'gray';
                                @endphp
                                <span
                                    class="px-2 py-1 text-xs font-medium rounded-full bg-{{ $c }}-100 text-{{ $c }}-700">{{ $output->status_label }}</span>
                            </td>
                            <td class="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{{ $output->description ?? '-' }}
                            </td>
                            <td class="px-4 py-2 text-right">
                                <button type="button" onclick="openModal('editOutputModal{{ $output->id }}')"
                                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-block" title="Edit"><svg
                                        class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg></button>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>

    @foreach ($splitter->outputs as $output)
        <div id="editOutputModal{{ $output->id }}"
            class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 px-4">
            <div class="w-full max-w-lg rounded-lg bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <div>
                        <h2 class="text-lg font-semibold text-gray-900">Edit Output Port</h2>
                        <p class="text-sm text-gray-500">{{ $splitter->splitter_name }} - Port {{ $output->port_number }}
                        </p>
                    </div>
                    <button type="button" onclick="closeModal('editOutputModal{{ $output->id }}')"
                        class="text-gray-400 hover:text-gray-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form method="POST" action="{{ route('splitter-outputs.update', $output) }}" class="space-y-5 px-6 py-5">
                    @csrf @method('PUT')
                    <input type="hidden" name="output_id" value="{{ $output->id }}">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Status <span
                                class="text-red-500">*</span></label><select name="status" id="status_{{ $output->id }}"
                            required
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onchange="toggleOutputFields('{{ $output->id }}')">
                            @foreach (\App\Models\SplitterOutput::STATUS_LABELS as $val => $label)
                                <option value="{{ $val }}"
                                    {{ old('status', $output->status) == $val ? 'selected' : '' }}>{{ $label }}
                                </option>
                            @endforeach
                        </select>
                        @error('status')
                            <p class="text-red-500 text-xs mt-1">{{ $message }}</p>
                        @enderror
                    </div>
                    <div id="active_fields_{{ $output->id }}" class="space-y-5">
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">Tujuan Closure <span
                                    class="text-red-500" id="closure_required_{{ $output->id }}">*</span></label><select
                                name="destination_main_core_id"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('destination_main_core_id') border-red-500 @enderror">
                                <option value="">Pilih Tujuan Closure</option>
                                @foreach ($mainCores as $core)
                                    <option value="{{ $core->id }}"
                                        {{ old('destination_main_core_id', $output->destination_main_core_id) == $core->id ? 'selected' : '' }}>
                                        {{ $core->name }}</option>
                                @endforeach
                            </select>
                            @error('destination_main_core_id')
                                <p class="text-red-500 text-xs mt-1">{{ $message }}</p>
                            @enderror
                        </div>
                        <div><label class="block text-sm font-medium text-gray-700 mb-1">Redaman Output (dBm) <span
                                    class="text-red-500"
                                    id="attenuation_required_{{ $output->id }}">*</span></label><input type="number"
                                step="0.01" name="output_attenuation"
                                value="{{ old('output_attenuation', $output->output_attenuation) }}"
                                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none @error('output_attenuation') border-red-500 @enderror"
                                placeholder="cth: -14">
                            @error('output_attenuation')
                                <p class="text-red-500 text-xs mt-1">{{ $message }}</p>
                            @enderror
                        </div>
                    </div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                        <textarea name="description" rows="3"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none">{{ old('description', $output->description) }}</textarea>
                    </div>
                    <div class="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onclick="closeModal('editOutputModal{{ $output->id }}')"
                            class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Batal</button>
                        <button type="submit"
                            class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Perbarui</button>
                    </div>
                </form>
            </div>
        </div>
    @endforeach
@endsection

@push('scripts')
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

        function toggleOutputFields(id) {
            const status = document.getElementById('status_' + id)?.value;
            const fields = document.getElementById('active_fields_' + id);
            const closureRequired = document.getElementById('closure_required_' + id);
            const attenuationRequired = document.getElementById('attenuation_required_' + id);
            const active = status === 'active';

            if (fields) fields.style.opacity = active ? '1' : '0.5';
            if (closureRequired) closureRequired.textContent = active ? '*' : '';
            if (attenuationRequired) attenuationRequired.textContent = active ? '*' : '';
        }

        document.addEventListener('DOMContentLoaded', () => {
            @foreach ($splitter->outputs as $output)
                toggleOutputFields('{{ $output->id }}');
            @endforeach
        });

        @if ($errors->any() && old('output_id'))
            openModal('editOutputModal{{ old('output_id') }}');
        @endif
    </script>
@endpush
