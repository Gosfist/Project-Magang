@extends('layouts.public')

@section('title', 'PT UNZANET - Internet Fiber Optik')

@section('content')
    <section id="beranda" class="relative isolate flex min-h-[620px] items-center overflow-hidden bg-slate-950 text-white scroll-mt-16">
        <img src="{{ asset('img/landing-background.jpeg') }}" alt="Jaringan fiber optik PT UNZANET"
            class="absolute inset-0 -z-20 h-full w-full object-fill">
        <div class="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/20"></div>

        <div class="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
            <div class="max-w-3xl">
                <p class="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Internet Fiber Optik Terpercaya</p>
                <h1 class="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    Koneksi Internet Cepat & Stabil untuk Lingkungan Anda
                </h1>
                <p class="mb-9 max-w-2xl text-lg leading-relaxed text-slate-200 sm:text-xl">
                    PT UNZANET menyediakan layanan internet fiber optik berkualitas dengan harga terjangkau untuk
                    kebutuhan rumah, komunitas, dan usaha Anda.
                </p>
                <div class="flex flex-wrap gap-4">
                    <a href="#layanan"
                        class="rounded-lg bg-cyan-400 px-7 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300">
                        Lihat Paket
                    </a>
                    <a href="#kontak"
                        class="rounded-lg border border-white/50 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
                        Hubungi Kami
                    </a>
                </div>
            </div>
        </div>
    </section>

    <section id="tentang-kami" class="scroll-mt-16 bg-white py-20">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                    <p class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Tentang Kami</p>
                    <h2 class="mb-5 text-3xl font-bold text-slate-900 sm:text-4xl">Internet berkualitas untuk koneksi tanpa batas</h2>
                    <p class="leading-relaxed text-slate-600">
                        PT UNZANET menghadirkan jaringan fiber optik yang cepat, stabil, dan terjangkau. Infrastruktur
                        modern serta dukungan teknis profesional kami siap menunjang aktivitas digital sehari-hari.
                    </p>
                </div>
                <div class="grid gap-5 sm:grid-cols-3">
                    @foreach ([
                        ['title' => 'Cepat', 'desc' => 'Bandwidth stabil untuk bekerja, belajar, streaming, dan bermain game.'],
                        ['title' => 'Aman', 'desc' => 'Jaringan terkelola dengan pemantauan dan perawatan rutin.'],
                        ['title' => 'Responsif', 'desc' => 'Tim teknis siap membantu saat Anda membutuhkan dukungan.'],
                    ] as $advantage)
                        <article class="rounded-2xl border border-blue-100 bg-blue-50/70 p-6">
                            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 class="mb-2 text-lg font-bold text-slate-900">{{ $advantage['title'] }}</h3>
                            <p class="text-sm leading-relaxed text-slate-600">{{ $advantage['desc'] }}</p>
                        </article>
                    @endforeach
                </div>
            </div>
        </div>
    </section>

    <section id="layanan" class="scroll-mt-16 bg-blue-50 py-20">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="mx-auto mb-14 max-w-2xl text-center">
                <p class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Layanan</p>
                <h2 class="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">Paket transparan, tanpa biaya tersembunyi</h2>
                <p class="text-slate-600">Pilih paket internet bulanan yang sesuai dengan kebutuhan Anda.</p>
            </div>

            <div class="mx-auto grid max-w-5xl gap-7 md:grid-cols-3 md:items-stretch">
                @foreach ([
                    ['name' => 'Fiber Pemula', 'price' => '50.000', 'speed' => '10 Mbps', 'desc' => 'Untuk browsing, belajar, dan penggunaan harian.', 'popular' => false],
                    ['name' => 'Fiber Keluarga', 'price' => '100.000', 'speed' => '20 Mbps', 'desc' => 'Nyaman untuk streaming, bekerja, dan banyak perangkat.', 'popular' => true],
                    ['name' => 'Fiber Usaha', 'price' => '150.000', 'speed' => '30 Mbps', 'desc' => 'Koneksi andal untuk usaha dan kebutuhan lebih intensif.', 'popular' => false],
                ] as $package)
                    <article class="relative flex flex-col rounded-2xl border bg-white p-7 shadow-sm {{ $package['popular'] ? 'border-blue-600 ring-2 ring-blue-600/10' : 'border-slate-200' }}">
                        @if ($package['popular'])
                            <span class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-700 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                                Paling Populer
                            </span>
                        @endif
                        <h3 class="text-xl font-bold text-slate-900">{{ $package['name'] }}</h3>
                        <p class="mt-2 min-h-12 text-sm leading-relaxed text-slate-500">{{ $package['desc'] }}</p>
                        <div class="my-7 flex items-end gap-1 text-slate-900">
                            <span class="mb-1 text-sm font-semibold">Rp</span>
                            <span class="text-4xl font-extrabold tracking-tight">{{ $package['price'] }}</span>
                            <span class="mb-1 text-sm text-slate-500">/bulan</span>
                        </div>
                        <dl class="mb-7 divide-y divide-slate-100 text-sm">
                            <div class="flex justify-between gap-4 py-3">
                                <dt class="text-slate-500">Kecepatan</dt>
                                <dd class="font-semibold text-slate-900">{{ $package['speed'] }}</dd>
                            </div>
                            <div class="flex justify-between gap-4 py-3">
                                <dt class="text-slate-500">Batas data</dt>
                                <dd class="font-semibold text-slate-900">Tanpa batas</dd>
                            </div>
                            <div class="flex justify-between gap-4 py-3">
                                <dt class="text-slate-500">Dukungan</dt>
                                <dd class="font-semibold text-slate-900">Teknis responsif</dd>
                            </div>
                        </dl>
                        <a href="#kontak"
                            class="mt-auto rounded-lg px-5 py-3 text-center text-sm font-semibold transition {{ $package['popular'] ? 'bg-blue-700 text-white hover:bg-blue-800' : 'border border-slate-300 text-slate-800 hover:border-blue-600 hover:text-blue-700' }}">
                            Pilih Paket
                        </a>
                    </article>
                @endforeach
            </div>
        </div>
    </section>

    <section id="kontak" class="scroll-mt-16 bg-slate-950 py-20 text-white">
        <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
                <p class="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Kontak Kami</p>
                <h2 class="mb-4 text-3xl font-bold sm:text-4xl">Siap menikmati internet yang lebih stabil?</h2>
                <p class="max-w-2xl leading-relaxed text-slate-300">
                    Hubungi tim PT UNZANET untuk mengecek jangkauan, berkonsultasi, atau memilih paket yang paling sesuai.
                </p>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer"
                    class="rounded-lg bg-cyan-400 px-7 py-3.5 text-center font-semibold text-slate-950 transition hover:bg-cyan-300">
                    Chat WhatsApp
                </a>
                <a href="mailto:info@unzanet.com"
                    class="rounded-lg border border-slate-600 px-7 py-3.5 text-center font-semibold text-white transition hover:border-slate-400 hover:bg-white/5">
                    Kirim Email
                </a>
            </div>
        </div>
    </section>
@endsection
