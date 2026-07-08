@extends('layouts.public')
@section('title', 'Layanan - PT. Unzanet')
@section('content')
<section class="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl font-bold mb-4">Layanan Kami</h1>
        <p class="text-blue-100 max-w-2xl mx-auto">Berbagai layanan internet dan jaringan fiber optik untuk memenuhi kebutuhan Anda.</p>
    </div>
</section>
<section class="py-16 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            @foreach([
                ['title' => 'Internet Rumahan', 'desc' => 'Paket internet fiber optik untuk kebutuhan keluarga. Cocok untuk streaming, gaming, dan browsing sehari-hari.', 'icon' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
                ['title' => 'Internet Usaha', 'desc' => 'Koneksi dedicated dengan bandwidth tinggi untuk kebutuhan bisnis, kantor, dan usaha kecil menengah.', 'icon' => 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'],
                ['title' => 'Instalasi Jaringan', 'desc' => 'Jasa pemasangan infrastruktur jaringan fiber optik dari awal hingga selesai, termasuk penarikan kabel dan konfigurasi.', 'icon' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
                ['title' => 'Maintenance Jaringan', 'desc' => 'Layanan perawatan dan pemeliharaan berkala jaringan fiber optik untuk menjaga performa optimal.', 'icon' => 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'],
                ['title' => 'Layanan RT/RW Net', 'desc' => 'Solusi internet komunitas dengan sistem pembagian bandwidth yang adil untuk lingkungan perumahan.', 'icon' => 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'],
                ['title' => 'Penarikan Kabel Fiber', 'desc' => 'Jasa penarikan dan instalasi kabel fiber optik dengan teknisi berpengalaman dan peralatan lengkap.', 'icon' => 'M13 10V3L4 14h7v7l9-11h-7z'],
                ['title' => 'Perawatan ODC & ODP', 'desc' => 'Perawatan rutin dan perbaikan perangkat distribusi optik ODC, ODP, dan closure.', 'icon' => 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'],
            ] as $service)
            <div class="group bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
                <div class="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mb-5 group-hover:from-blue-500 group-hover:to-blue-700 transition-all duration-300">
                    <svg class="w-7 h-7 text-blue-600 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{{ $service['icon'] }}"/></svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ $service['title'] }}</h3>
                <p class="text-gray-500 text-sm leading-relaxed">{{ $service['desc'] }}</p>
            </div>
            @endforeach
        </div>
    </div>
</section>
@endsection
