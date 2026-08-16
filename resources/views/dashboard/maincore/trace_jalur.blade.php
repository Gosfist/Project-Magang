@extends('layouts.dashboard')
@section('page-title', 'Trace Jalur')

@section('content')
    @php
        $selectedCategory = old('category', request('category'));
        $selectedNodeId = (string) old('node_id', request('node_id'));
        $selectedNodeName = $selectedNode?->nama_titik ?? '';
        $formatRedaman = fn ($value) => $value === null
            ? '-'
            : rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' dBm';
    @endphp

    <div class="space-y-5">
        <section class="rounded-lg border border-gray-200 bg-white p-5">
            <div class="mb-5">
                <h2 class="font-semibold text-gray-900">Cari Jalur Jaringan</h2>
                <p class="mt-1 text-sm text-gray-500">Pilih kategori dan nama titik untuk melihat jalur menuju sumber/Core.</p>
            </div>

            <form method="GET" action="{{ route('fiber.trace') }}" id="traceForm" class="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <div>
                    <label for="traceCategory" class="mb-1 block text-sm font-medium text-gray-700">Kategori</label>
                    <select id="traceCategory" name="category" required class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                        <option value="">Pilih kategori</option>
                        @foreach ($traceCategories as $value => $label)
                            <option value="{{ $value }}" @selected($selectedCategory === $value)>{{ $label }}</option>
                        @endforeach
                    </select>
                    @error('category')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="relative" id="traceNameField">
                    <label for="traceNodeSearch" class="mb-1 block text-sm font-medium text-gray-700">Nama</label>
                    <input id="traceNodeSearch" type="search" value="{{ $selectedNodeName }}" autocomplete="off"
                        placeholder="Pilih kategori terlebih dahulu" disabled
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400">
                    <input id="traceNodeId" type="hidden" name="node_id" value="{{ $selectedNodeId }}">
                    <button id="traceDropdownButton" type="button" aria-label="Buka daftar nama" disabled
                        class="absolute bottom-0 right-0 flex h-[42px] w-10 items-center justify-center text-gray-400 disabled:text-gray-300">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="traceNodeOptions" class="absolute z-20 mt-1 hidden max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"></div>
                    @error('node_id')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <button type="submit" class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700" style="cursor: pointer;">
                    Trace Jalur
                </button>
            </form>
        </section>

        @if ($selectedNode)
            <section class="rounded-lg border border-gray-200 bg-white p-5">
                <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 class="font-semibold text-gray-900">Hasil Trace Jalur</h2>
                    </div>
                    <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{{ $traceNodeCount }} titik</span>
                </div>

                <div class="space-y-4">
                    @foreach ($tracePaths as $path)
                        @if ($tracePaths->count() > 1)
                            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Cabang {{ $loop->iteration }}</p>
                        @endif
                        <div class="overflow-x-auto pb-2">
                            <div class="flex min-w-max items-stretch">
                                @foreach ($path as $node)
                                    <article class="w-52 rounded-lg border {{ $node->is($selectedNode) ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white' }} p-4">
                                        <span class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase text-gray-600">{{ $labels[$node->tipe_titik] }}</span>
                                        <h3 class="mt-3 font-semibold text-gray-900">{{ $node->nama_titik }}</h3>
                                        <dl class="mt-3 space-y-1 text-xs text-gray-500">
                                            @if ($node->parent_port_out)
                                                <div class="flex justify-between gap-3">
                                                    <dt>Port sumber</dt>
                                                    <dd class="font-medium text-gray-700">Port {{ $node->parent_port_out }}</dd>
                                                </div>
                                            @endif
                                            <div class="flex justify-between gap-3">
                                                <dt>Redaman In</dt>
                                                <dd class="font-medium text-gray-700">{{ $formatRedaman($node->redaman_in) }}</dd>
                                            </div>
                                        </dl>
                                    </article>

                                    @unless ($loop->last)
                                        <div class="flex w-12 shrink-0 items-center justify-center text-blue-500" aria-hidden="true">
                                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    @endunless
                                @endforeach
                            </div>
                        </div>
                    @endforeach
                </div>
            </section>
        @endif
    </div>
@endsection

@push('scripts')
    <script>
        const traceNodes = @json($nodesByCategory);
        const traceCategory = document.getElementById('traceCategory');
        const traceSearch = document.getElementById('traceNodeSearch');
        const traceNodeId = document.getElementById('traceNodeId');
        const traceOptions = document.getElementById('traceNodeOptions');
        const traceDropdownButton = document.getElementById('traceDropdownButton');
        const traceNameField = document.getElementById('traceNameField');
        const traceForm = document.getElementById('traceForm');

        function categoryNodes() {
            return traceNodes[traceCategory.value] || [];
        }

        function renderTraceOptions() {
            const keyword = traceSearch.value.trim().toLowerCase();
            const nodes = categoryNodes().filter((node) => node.nama_titik.toLowerCase().includes(keyword));

            traceOptions.innerHTML = '';

            if (nodes.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'px-3 py-2 text-sm text-gray-400';
                empty.textContent = keyword ? 'Nama tidak ditemukan.' : 'Belum ada data pada kategori ini.';
                traceOptions.appendChild(empty);
            } else {
                nodes.forEach((node) => {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700';
                    option.textContent = node.nama_titik;
                    option.addEventListener('click', () => selectTraceNode(node));
                    traceOptions.appendChild(option);
                });
            }

            traceOptions.classList.remove('hidden');
        }

        function selectTraceNode(node) {
            traceSearch.value = node.nama_titik;
            traceNodeId.value = node.id;
            traceSearch.setCustomValidity('');
            traceOptions.classList.add('hidden');
        }

        function syncTraceCategory(resetSelection = false) {
            const enabled = Boolean(traceCategory.value);
            traceSearch.disabled = !enabled;
            traceDropdownButton.disabled = !enabled;
            traceSearch.placeholder = enabled ? 'Cari atau pilih nama...' : 'Pilih kategori terlebih dahulu';

            if (resetSelection) {
                traceSearch.value = '';
                traceNodeId.value = '';
            }

            traceOptions.classList.add('hidden');
        }

        traceCategory.addEventListener('change', () => {
            syncTraceCategory(true);
            if (!traceSearch.disabled) {
                traceSearch.focus();
                renderTraceOptions();
            }
        });

        traceSearch.addEventListener('focus', renderTraceOptions);
        traceSearch.addEventListener('click', renderTraceOptions);
        traceSearch.addEventListener('input', () => {
            traceNodeId.value = '';
            traceSearch.setCustomValidity('');
            renderTraceOptions();
        });
        traceDropdownButton.addEventListener('click', () => {
            traceSearch.focus();
            renderTraceOptions();
        });

        traceForm.addEventListener('submit', (event) => {
            if (!traceNodeId.value) {
                event.preventDefault();
                traceSearch.setCustomValidity('Pilih nama dari daftar yang tersedia.');
                traceSearch.reportValidity();
            }
        });

        document.addEventListener('click', (event) => {
            if (!traceNameField.contains(event.target)) {
                traceOptions.classList.add('hidden');
            }
        });

        syncTraceCategory(false);
    </script>
@endpush
