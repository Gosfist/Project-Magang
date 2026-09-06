<!DOCTYPE html>
<html lang="id" class="scroll-smooth">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="PT UNZANET - Penyedia layanan internet fiber optik terpercaya">
    <title>@yield('title', 'PT UNZANET')</title>
    <link rel="icon" type="image/png" href="{{ asset('img/logo.png') }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="bg-white font-sans text-slate-800 antialiased">
    <nav class="fixed top-0 z-50 w-full border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur-md">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 items-center justify-between">
                <a href="{{ route('home') }}#beranda" class="flex items-center gap-3" aria-label="PT UNZANET - Beranda">
                    <img src="{{ asset('img/logo.png') }}" alt="Logo PT UNZANET" class="h-11 w-auto object-contain">
                    <span class="text-base font-extrabold tracking-wide text-slate-900 sm:text-lg">PT UNZANET</span>
                </a>

                <div class="hidden items-center gap-1 md:flex">
                    <a href="{{ route('home') }}#beranda" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">Beranda</a>
                    <a href="{{ route('home') }}#tentang-kami" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">Tentang Kami</a>
                    <a href="{{ route('home') }}#layanan" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">Layanan</a>
                    <a href="{{ route('home') }}#kontak" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">Kontak</a>
                </div>

                <button type="button" data-toggle-target="mobileMenu"
                    class="rounded-lg p-2 text-slate-600 hover:bg-blue-50 md:hidden" aria-label="Buka navigasi" aria-controls="mobileMenu" aria-expanded="false">
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
        </div>

        <div id="mobileMenu" class="hidden border-t border-blue-100 bg-white pb-4 md:hidden">
            <div class="space-y-1 px-4 pt-2">
                <a href="{{ route('home') }}#beranda" class="block rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">Beranda</a>
                <a href="{{ route('home') }}#tentang-kami" class="block rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">Tentang Kami</a>
                <a href="{{ route('home') }}#layanan" class="block rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">Layanan</a>
                <a href="{{ route('home') }}#kontak" class="block rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">Kontak</a>
            </div>
        </div>
    </nav>

    <main class="pt-16">
        @yield('content')
    </main>

    <footer class="border-t border-slate-800 bg-slate-950 text-white">
        <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-9 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div class="flex items-center gap-3">
                <img src="{{ asset('img/logo.png') }}" alt="Logo PT UNZANET" class="h-11 w-auto object-contain">
                <div>
                    <p class="font-bold">PT UNZANET</p>
                    <p class="text-sm text-slate-400">Internet fiber optik cepat dan stabil.</p>
                </div>
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                <a href="{{ route('home') }}#tentang-kami" class="transition hover:text-white">Tentang Kami</a>
                <a href="{{ route('home') }}#layanan" class="transition hover:text-white">Layanan</a>
                <a href="{{ route('home') }}#kontak" class="transition hover:text-white">Kontak</a>
            </div>
            <p class="text-sm text-slate-500">&copy; {{ date('Y') }} PT UNZANET.</p>
        </div>
    </footer>
</body>

</html>
