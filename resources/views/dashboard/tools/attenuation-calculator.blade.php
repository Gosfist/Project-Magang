@extends('layouts.dashboard')

@section('title', 'Kalkulator Redaman')
@section('page-title', 'Kalkulator Redaman')

@section('content')
    <div data-attenuation-calculator class="mx-auto max-w-5xl space-y-5">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div class="mb-5">
                <h2 class="text-lg font-semibold text-slate-900">Kalkulator Redaman</h2>
                <p class="mt-1 text-sm text-slate-500">Perhitungan dilakukan langsung di halaman ini dan tidak disimpan ke database.</p>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
                <div>
                    <label class="mb-1 block text-sm font-medium">Redaman Sumber (dBm)</label>
                    <input data-source-redaman type="number" step="0.01" placeholder="Contoh: 5"
                        class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Jarak Kabel (meter)</label>
                    <input data-distance type="number" min="0" step="0.01" placeholder="Contoh: 500"
                        class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Jenis Splitter/Rasio</label>
                    <select data-splitter
                        class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                        <option value="1:2">1:2</option>
                        <option value="1:4">1:4</option>
                        <option value="1:8">1:8</option>
                        <option value="70:30">70:30</option>
                        <option value="80:20">80:20</option>
                        <option value="90:10">90:10</option>
                    </select>
                </div>

                <div data-ratio-field class="hidden">
                    <label class="mb-1 block text-sm font-medium">Jalur Rasio</label>
                    <select data-ratio-path disabled
                        class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"></select>
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Jumlah Connector</label>
                    <input data-connector-count type="number" min="0" step="1" value="2"
                        class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Loss per Connector (dB)</label>
                    <input data-connector-loss type="number" min="0" step="0.01" value="0.5"
                        class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Loss Kabel per km (dB)</label>
                    <input data-cable-loss type="number" min="0" step="0.01" value="0.35"
                        class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 class="mb-4 text-lg font-semibold text-slate-900">Hasil Perhitungan</h2>
            <div class="grid gap-3 sm:grid-cols-3">
                <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p class="text-sm text-slate-500">Loss Splitter/Rasio</p>
                    <p class="mt-1 text-xl font-semibold"><span data-result-splitter>-</span> dB</p>
                </div>
                <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p class="text-sm text-slate-500">Loss Kabel</p>
                    <p class="mt-1 text-xl font-semibold"><span data-result-cable>-</span> dB</p>
                </div>
                <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p class="text-sm text-slate-500">Loss Connector</p>
                    <p class="mt-1 text-xl font-semibold"><span data-result-connector>-</span> dB</p>
                </div>
            </div>
            <div class="mt-4 rounded-xl border border-slate-950 bg-slate-950 p-5 text-white">
                <p class="text-sm text-slate-300">Hasil Redaman</p>
                <p class="mt-1 text-3xl font-bold"><span data-result-redaman>-</span> dBm</p>
            </div>
        </div>
    </div>
@endsection
