@extends('layouts.public')
@section('title', 'Tentang Kami - PT. Unzanet')
@section('content')
<section class="bg-blue-700 text-white py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl font-bold mb-4">Tentang Kami</h1>
        <p class="text-blue-100 max-w-2xl mx-auto">Mengenal lebih dekat PT. Unzanet sebagai penyedia layanan internet RT/RW Net terpercaya.</p>
    </div>
</section>
<section class="py-16 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-3xl mx-auto">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Profil Perusahaan</h2>
            <p class="text-gray-600 leading-relaxed mb-6">PT. Unzanet adalah perusahaan penyedia layanan internet RT/RW Net yang berdedikasi untuk menghadirkan koneksi internet fiber optik berkualitas tinggi dengan harga terjangkau bagi masyarakat. Kami berkomitmen untuk memperluas jangkauan internet di berbagai wilayah, terutama di area yang belum terjangkau oleh provider besar.</p>
            <p class="text-gray-600 leading-relaxed mb-10">Dengan infrastruktur jaringan fiber optik yang modern dan tim teknis yang berpengalaman, kami mampu memberikan layanan internet stabil dengan kecepatan tinggi untuk kebutuhan rumahan maupun usaha.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div class="bg-blue-50 rounded-lg p-8 border border-blue-100">
                <h3 class="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Visi
                </h3>
                <p class="text-gray-600 leading-relaxed">Menjadi penyedia layanan internet RT/RW Net terdepan yang menghadirkan koneksi berkualitas tinggi dan terjangkau bagi seluruh masyarakat.</p>
            </div>
            <div class="bg-blue-50 rounded-lg p-8 border border-blue-100">
                <h3 class="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    Misi
                </h3>
                <ul class="text-gray-600 space-y-2 text-sm">
                    <li class="flex items-start gap-2"><span class="text-blue-500 mt-1">•</span> Menyediakan infrastruktur jaringan fiber optik yang handal</li>
                    <li class="flex items-start gap-2"><span class="text-blue-500 mt-1">•</span> Memberikan layanan internet dengan harga terjangkau</li>
                    <li class="flex items-start gap-2"><span class="text-blue-500 mt-1">•</span> Memperluas jangkauan internet ke berbagai wilayah</li>
                    <li class="flex items-start gap-2"><span class="text-blue-500 mt-1">•</span> Memberikan dukungan teknis yang responsif dan profesional</li>
                </ul>
            </div>
        </div>
    </div>
</section>
<section class="py-16 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Keunggulan Kami</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            @foreach([
                ['title' => 'Jaringan Fiber Optik', 'desc' => 'Infrastruktur modern dengan kabel fiber optik untuk kecepatan maksimal'],
                ['title' => 'Harga Bersahabat', 'desc' => 'Paket internet terjangkau tanpa mengorbankan kualitas'],
                ['title' => 'Support 24/7', 'desc' => 'Tim teknis siap membantu Anda kapan saja'],
                ['title' => 'Cakupan Luas', 'desc' => 'Melayani berbagai area perumahan dan kawasan usaha'],
            ] as $item)
            <div class="bg-white p-6 rounded-lg border border-gray-200 text-center">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 class="font-bold text-gray-900 mb-1">{{ $item['title'] }}</h3>
                <p class="text-sm text-gray-500">{{ $item['desc'] }}</p>
            </div>
            @endforeach
        </div>
    </div>
</section>
@endsection
