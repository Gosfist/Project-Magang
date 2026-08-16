@extends('layouts.dashboard')
@section('page-title', 'Trace Jalur')

@section('content')
    @php
        $selectedCategory = old('category', request('category'));
        $selectedNodeId = (string) old('node_id', request('node_id'));
        $selectedNodeName = $selectedNode?->nama_titik ?? '';
        $formatRedaman = fn($value) => $value === null
            ? '-'
            : rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' dBm';
    @endphp

    <div class="space-y-5">
        <section class="rounded-lg border border-gray-200 bg-white p-5">
            <div class="mb-5">
                <h2 class="font-semibold text-gray-900">Cari Jalur Jaringan</h2>
            </div>

            <form method="GET" action="{{ route('fiber.trace') }}" id="traceForm" data-trace-form
                data-trace-nodes="{{ $nodesByCategory->toJson() }}"
                class="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <div>
                    <label for="traceCategory" class="mb-1 block text-sm font-medium text-gray-700">Kategori</label>
                    <select id="traceCategory" data-trace-category name="category" required
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                        <option value="">Pilih kategori</option>
                        @foreach ($traceCategories as $value => $label)
                            <option value="{{ $value }}" @selected($selectedCategory === $value)>{{ $label }}</option>
                        @endforeach
                    </select>
                    @error('category')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="relative" id="traceNameField" data-trace-name-field>
                    <label for="traceNodeSearch" class="mb-1 block text-sm font-medium text-gray-700">Nama</label>
                    <input id="traceNodeSearch" data-trace-search type="search" value="{{ $selectedNodeName }}" autocomplete="off"
                        placeholder="Pilih kategori terlebih dahulu" disabled
                        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-gray-100 disabled:text-gray-400">
                    <input id="traceNodeId" data-trace-node-id type="hidden" name="node_id" value="{{ $selectedNodeId }}">
                    <button id="traceDropdownButton" data-trace-dropdown type="button" aria-label="Buka daftar nama" disabled
                        class="absolute bottom-0 right-0 flex h-[42px] w-10 items-center justify-center text-gray-400 disabled:text-gray-300">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="traceNodeOptions" data-trace-options
                        class="absolute z-20 mt-1 hidden max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                    </div>
                    @error('node_id')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <button type="submit"
                    class="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black"
                    style="cursor: pointer;">
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
                    <span
                        class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900">{{ $traceNodeCount }} titik</span>
                </div>

                <div class="space-y-4">
                    @foreach ($tracePaths as $path)
                        @if ($tracePaths->count() > 1)
                            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Cabang
                                {{ $loop->iteration }}</p>
                        @endif
                        <div class="overflow-x-auto pb-2">
                            <div class="flex min-w-max items-stretch">
                                @foreach ($path as $node)
                                    <article
                                        class="w-52 rounded-lg border {{ $node->is($selectedNode) ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-300' : 'border-gray-200 bg-white' }} p-4">
                                        <span
                                            class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase text-gray-600">{{ $labels[$node->tipe_titik] }}</span>
                                        <h3 class="mt-3 font-semibold text-gray-900">{{ $node->nama_titik }}</h3>
                                        <dl class="mt-3 space-y-1 text-xs text-gray-500">
                                            @if ($node->parent_port_out)
                                                <div class="flex justify-between gap-3">
                                                    <dt>Port sumber</dt>
                                                    <dd class="font-medium text-gray-700">Port {{ $node->parent_port_out }}
                                                    </dd>
                                                </div>
                                            @endif
                                            <div class="flex justify-between gap-3">
                                                <dt>Redaman In</dt>
                                                <dd class="font-medium text-gray-700">
                                                    {{ $formatRedaman($node->redaman_in) }}</dd>
                                            </div>
                                        </dl>
                                    </article>

                                    @unless ($loop->last)
                                        <div class="flex w-12 shrink-0 items-center justify-center text-slate-700"
                                            aria-hidden="true">
                                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M9 5l7 7-7 7" />
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
