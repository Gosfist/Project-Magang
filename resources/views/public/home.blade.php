@extends('layouts.public')

@section('title', 'PT. Unzanet')

@section('content')
    {{-- Hero Section --}}
    <section class="bg-blue-700 text-white border-b border-blue-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-28">
            <div class="max-w-3xl">
                <span class="inline-block px-4 py-1.5 bg-white/10 rounded-lg text-sm font-medium mb-6 border border-white/20">Internet RT/RW Net Terpercaya</span>
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                    Koneksi Internet Cepat & Stabil untuk Lingkungan Anda
                </h1>
                <p class="text-lg sm:text-xl text-blue-100 mb-8 leading-relaxed">
                    PT. Unzanet menyediakan layanan internet fiber optik berkualitas tinggi dengan harga terjangkau untuk
                    kebutuhan rumahan dan usaha Anda.
                </p>
                <div class="flex flex-wrap gap-4">
                    <a href="{{ route('contact') }}"
                        class="px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-sm">
                        Hubungi Kami
                    </a>
                    <a href="{{ route('services') }}"
                        class="px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all duration-200">
                        Lihat Layanan
                    </a>
                </div>
            </div>
        </div>
    </section>

    {{-- Features Section --}}
    <section class="py-20 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-14">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Mengapa Memilih <span
                        class="text-blue-600">Unzanet</span>?</h2>
                <p class="text-gray-500 max-w-2xl mx-auto">Kami berkomitmen memberikan layanan internet terbaik dengan
                    infrastruktur modern dan dukungan teknis profesional.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                {{-- Feature 1 --}}
                <div
                    class="group p-8 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all duration-300">
                    <div
                        class="w-14 h-14 bg-blue-700 rounded-lg flex items-center justify-center mb-5">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">Kecepatan Tinggi</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">Jaringan fiber optik dengan kecepatan up to 100 Mbps
                        untuk pengalaman internet tanpa gangguan.</p>
                </div>
                {{-- Feature 2 --}}
                <div
                    class="group p-8 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all duration-300">
                    <div
                        class="w-14 h-14 bg-blue-700 rounded-lg flex items-center justify-center mb-5">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">Stabil & Aman</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">Koneksi stabil 24/7 dengan uptime tinggi dan keamanan
                        jaringan terjamin.</p>
                </div>
                {{-- Feature 3 --}}
                <div
                    class="group p-8 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all duration-300">
                    <div
                        class="w-14 h-14 bg-blue-700 rounded-lg flex items-center justify-center mb-5">
                        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">Harga Terjangkau</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">Paket internet dengan harga bersahabat yang cocok untuk
                        kebutuhan rumahan dan usaha kecil.</p>
                </div>
            </div>
        </div>
    </section>

    {{-- Services Summary --}}
    <section class="py-20 bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-14">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Layanan Kami</h2>
                <p class="text-gray-500 max-w-2xl mx-auto">Berbagai layanan internet dan jaringan untuk memenuhi kebutuhan
                    Anda.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                @foreach ([
            ['title' => 'Internet Rumahan', 'desc' => 'Paket internet untuk kebutuhan keluarga', 'icon' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
            ['title' => 'Internet Usaha', 'desc' => 'Koneksi dedicated untuk bisnis Anda', 'icon' => 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'],
            ['title' => 'Instalasi Jaringan', 'desc' => 'Pemasangan infrastruktur fiber optik', 'icon' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
            ['title' => 'Maintenance', 'desc' => 'Perawatan berkala jaringan Anda', 'icon' => 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'],
        ] as $service)
                    <div
                        class="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-300">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="{{ $service['icon'] }}" />
                            </svg>
                        </div>
                        <h3 class="font-bold text-gray-900 mb-1">{{ $service['title'] }}</h3>
                        <p class="text-sm text-gray-500">{{ $service['desc'] }}</p>
                    </div>
                @endforeach
            </div>
            <div class="text-center mt-10">
                <a href="{{ route('services') }}"
                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all">
                    Lihat Semua Layanan
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </a>
            </div>
        </div>
    </section>

    {{-- CTA Section --}}
    <section class="py-20 bg-blue-700 text-white">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 class="text-3xl sm:text-4xl font-bold mb-4">Siap Terhubung dengan Internet Cepat?</h2>
            <p class="text-blue-100 text-lg mb-8">Hubungi kami sekarang dan nikmati koneksi internet fiber optik berkualitas
                tinggi.</p>
            <a href="{{ route('contact') }}"
                class="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-all shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Hubungi Kami
            </a>
        </div>
    </section>
@endsection
