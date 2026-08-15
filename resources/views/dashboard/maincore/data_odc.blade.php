@extends('layouts.dashboard')
@section('page-title', 'Main Core')
@section('content')
    @php
        $section = 'odc';
        $label = 'ODC';
        $nameLabel = 'Nama ODC';
        $formatRedaman = fn($value) => $value === null
            ? '-'
            : rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' dBm';
        $formatTanggal = fn($value) => $value?->format('d-m-Y') ?? '-';
        $fieldValue = fn($node, $key) => old('form_mode') ===
        ($node ? $section . '_edit_' . $node->id : $section . '_create')
            ? old($key, data_get($node, $key))
            : data_get($node, $key);
        $ratioOptions = \App\Models\MainCore::SPLITTER_RATIOS;
    @endphp

    <div class="space-y-5">
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div>
                    <h2 class="font-semibold">Data {{ $label }}</h2>

                </div>
                <button type="button" onclick="openModal('createModal')"
                    class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" style="cursor: pointer;">Tambah Data</button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 text-gray-600">
                        <tr>
                            <th class="w-16 px-5 py-3 text-left">No</th>
                            <th class="px-5 py-3 text-left">Nama ODC</th>
                            <th class="px-5 py-3 text-left">Sumber Jalur</th>
                            <th class="px-5 py-3 text-left">Redaman In</th>
                            <th class="px-5 py-3 text-left">Tanggal</th>
                            <th class="px-5 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody id="nodeRows">
                        @forelse($nodes as $node)
                            <tr class="border-t border-gray-100" data-node-row="{{ $node->id }}">
                                <td class="px-5 py-3">{{ $loop->iteration }}</td>
                                <td class="px-5 py-3 font-medium">{{ $node->nama_titik }}</td>
                                <td class="px-5 py-3">{{ $node->parent?->nama_titik ?? '-' }}</td>
                                <td class="px-5 py-3">{{ $formatRedaman($node->redaman_in) }}</td>
                                <td class="px-5 py-3 whitespace-nowrap">{{ $formatTanggal($node->tanggal) }}</td>
                                <td class="px-5 py-3">
                                    <div class="flex justify-end gap-2 whitespace-nowrap">
                                        <button type="button" onclick="openModal('editModal{{ $node->id }}')"
                                            class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white"
                                            style="cursor: pointer;">Edit</button>
                                        <form data-ajax-form data-confirm="Yakin ingin menghapus data ini?" method="POST"
                                            action="{{ route('fiber.nodes.destroy', [$section, $node]) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="rounded-lg px-3 py-1.5 text-xs"
                                                style="background-color: #dc2626; color: #ffffff; border: 1px solid #dc2626; cursor: pointer;">Hapus</button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="px-5 py-8 text-center text-gray-400">Belum ada data ODC.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    @include('dashboard.modal.data_odc', [
        'modalId' => 'createModal',
        'title' => 'Tambah Data ' . $label,
        'action' => route('fiber.nodes.store', $section),
        'method' => 'POST',
        'node' => null,
        'mode' => $section . '_create',
        'existingNames' => $existingNames,
        'ratioOptions' => $ratioOptions,
    ])

    @foreach ($nodes as $node)
        @include('dashboard.modal.data_odc', [
            'modalId' => 'editModal' . $node->id,
            'title' => 'Edit Data ' . $label,
            'action' => route('fiber.nodes.update', [$section, $node]),
            'method' => 'PATCH',
            'node' => $node,
            'mode' => $section . '_edit_' . $node->id,
            'parents' => $allParents->filter(
                fn($parent) => $parent->id === $node->parent_id ||
                    ($parent->tipe_titik === 'server'
                        ? $parent->children_count === 0
                        : $parent->children_count < ($parent->jumlah_output ?? 0))),
            'existingNames' => $existingNames,
            'ratioOptions' => $ratioOptions,
        ])
    @endforeach

    <script>
        function openModal(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            openModalBackdrop();
            document.body.appendChild(modal);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            closeModalBackdrop();
            document.body.classList.remove('overflow-hidden');
        }

        function openModalBackdrop() {
            if (document.getElementById('modalBackdrop')) return;

            const backdrop = document.createElement('div');
            backdrop.id = 'modalBackdrop';
            backdrop.style.position = 'fixed';
            backdrop.style.inset = '0';
            backdrop.style.zIndex = '9999';
            backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.50)';
            backdrop.style.backdropFilter = 'blur(2px)';
            document.body.appendChild(backdrop);
        }

        function closeModalBackdrop() {
            if (document.querySelector('.fixed.flex[id$="Modal"], #createModal.flex')) return;
            document.getElementById('modalBackdrop')?.remove();
        }

        document.querySelectorAll('[data-parent-select]').forEach((parentSelect) => {
            syncPortSelect(parentSelect);
            parentSelect.addEventListener('change', () => syncPortSelect(parentSelect));
        });

        function syncPortSelect(parentSelect) {
            const form = parentSelect.closest('form');
            const portSelect = form?.querySelector('[data-port-select]');

            if (!portSelect) return;

            const option = parentSelect.selectedOptions[0];
            const parentType = option?.dataset.parentType || '';
            const outputCount = Number(option?.dataset.outputCount || 0);
            const currentParent = String(parentSelect.dataset.currentParent || '');
            const selectedParent = String(parentSelect.value || '');
            const selectedPort = Number(portSelect.dataset.selectedPort || 0);
            const currentPort = currentParent && selectedParent === currentParent ? selectedPort : 0;
            const usedPorts = parseJsonPorts(option?.dataset.usedPorts || '[]');

            portSelect.innerHTML = '';

            if (!selectedParent) {
                setSinglePortOption(portSelect, 'Pilih sumber jalur terlebih dahulu');
                return;
            }

            if (parentType === 'server') {
                setSinglePortOption(portSelect, 'Server/Core tidak memakai port');
                return;
            }

            const availablePorts = [];
            for (let port = 1; port <= outputCount; port++) {
                if (!usedPorts.includes(port) || port === currentPort) {
                    availablePorts.push(port);
                }
            }

            if (availablePorts.length === 0) {
                setSinglePortOption(portSelect, 'Semua port sudah digunakan');
                return;
            }

            portSelect.disabled = false;
            portSelect.required = true;
            portSelect.appendChild(new Option('Pilih port', ''));

            availablePorts.forEach((port) => {
                const item = new Option(`Port ${port}`, port);
                item.selected = port === selectedPort;
                portSelect.appendChild(item);
            });
        }

        function setSinglePortOption(portSelect, label) {
            portSelect.disabled = true;
            portSelect.required = false;
            portSelect.appendChild(new Option(label, ''));
        }

        function parseJsonPorts(value) {
            try {
                return JSON.parse(value).map(Number);
            } catch {
                return [];
            }
        }

        document.querySelectorAll('[data-ajax-form]').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                if (form.dataset.confirm && !confirm(form.dataset.confirm)) {
                    return;
                }

                const submit = form.querySelector('[type="submit"]');
                submit?.setAttribute('disabled', 'disabled');

                try {
                    if (!validateClientForm(form)) {
                        return;
                    }

                    const response = await fetch(form.action, {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json',
                        },
                        body: new FormData(form),
                    });

                    const payload = await parseResponsePayload(response);

                    if (!response.ok || response.redirected) {
                        showFormErrors(form, payload.errors || {});
                        showNotice(payload.message || Object.values(payload.errors || {}).flat().join(
                            ' ') || 'Data gagal disimpan.', 'error');
                        return;
                    }

                    showNotice(payload.message || 'Data berhasil disimpan.', 'success');
                    setTimeout(() => window.location.reload(), 700);
                } finally {
                    submit?.removeAttribute('disabled');
                }
            });
        });

        function validateClientForm(form) {
            clearFormErrors(form);

            const nameInput = form.querySelector('[name="nama_titik"]');
            const names = parseExistingNames(form.dataset.existingNames || '[]');
            const currentId = Number(form.dataset.currentId || 0);
            const currentName = (nameInput?.value || '').trim().toLowerCase();

            if (currentName && names.some((item) => item.id !== currentId && item.name === currentName)) {
                const message = form.dataset.uniqueMessage || 'Nama sudah digunakan!';
                showSingleFormError(form, 'nama_titik', message);
                return false;
            }

            return true;
        }

        function parseExistingNames(value) {
            try {
                return JSON.parse(value).map((item) => ({
                    id: Number(item.id),
                    name: String(item.nama_titik || '').trim().toLowerCase(),
                }));
            } catch {
                return [];
            }
        }

        async function parseResponsePayload(response) {
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                return response.json();
            }

            return {
                message: response.ok && !response.redirected ? 'Data berhasil disimpan.' :
                    'Data gagal disimpan. Periksa kembali isian form.',
                errors: {},
            };
        }

        function showFormErrors(form, errors) {
            clearFormErrors(form);

            Object.entries(errors).forEach(([field, messages]) => {
                showSingleFormError(form, field, Array.isArray(messages) ? messages[0] : messages);
            });
        }

        function showSingleFormError(form, field, message) {
            const error = form.querySelector(`[data-field-error="${field}"]`);
            if (!error) return;

            error.textContent = message;
            error.classList.remove('hidden');
        }

        function clearFormErrors(form) {
            form.querySelectorAll('[data-field-error]').forEach((item) => {
                item.textContent = '';
                item.classList.add('hidden');
            });
        }

        function showNotice(message, type) {
            const notice = document.createElement('div');
            notice.className =
                `fixed bottom-4 right-4 z-[90] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-sm ${type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`;
            notice.textContent = message;
            document.body.appendChild(notice);
            setTimeout(() => notice.remove(), 3500);
        }

        @if ($errors->any() && old('form_mode') === $section . '_create')
            openModal('createModal');
        @endif
        @foreach ($nodes as $node)
            @if ($errors->any() && old('form_mode') === $section . '_edit_' . $node->id)
                openModal('editModal{{ $node->id }}');
            @endif
        @endforeach
    </script>
@endsection
