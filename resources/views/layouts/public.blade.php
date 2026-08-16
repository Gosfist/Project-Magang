<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="PT. Unzanet - Penyedia layanan internet RT/RW Net terpercaya">
    <title>@yield('title', 'PT. Unzanet')</title>
    <link rel="icon" type="image/png" href="{{ asset('img/logo.png') }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="font-sans antialiased bg-white text-gray-800">
    {{-- Navbar --}}
    <nav class="bg-white/95 backdrop-blur-md shadow-sm fixed w-full top-0 z-50 border-b border-blue-100">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                {{-- Logo --}}
                <a href="{{ route('home') }}" class="flex items-center gap-2">
                    <img src="{{ asset('img/logo.png') }}" alt="Unzanet" class="h-12 w-auto object-contain">
                </a>

                {{-- Desktop Nav --}}
                <div class="hidden md:flex items-center gap-1">
                    <a href="{{ route('home') }}"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('home') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' }}">Beranda</a>
                    <a href="{{ route('about') }}"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('about') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' }}">Tentang
                        Kami</a>
                    <a href="{{ route('services') }}"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('services') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' }}">Layanan</a>
                    <a href="{{ route('contact') }}"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('contact') ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' }}">Kontak</a>
                    <a href="{{ route('login') }}"
                        class="ml-3 px-5 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-all duration-200 shadow-sm">Login</a>
                </div>

                {{-- Mobile menu button --}}
                <button onclick="document.getElementById('mobileMenu').classList.toggle('hidden')"
                    class="md:hidden p-2 rounded-lg text-gray-600 hover:bg-blue-50">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
        </div>

        {{-- Mobile Nav --}}
        <div id="mobileMenu" class="hidden md:hidden bg-white border-t border-blue-100 pb-4">
            <div class="px-4 pt-2 space-y-1">
                <a href="{{ route('home') }}"
                    class="block px-4 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('home') ? 'text-blue-700 bg-blue-50' : 'text-gray-600' }}">Beranda</a>
                <a href="{{ route('about') }}"
                    class="block px-4 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('about') ? 'text-blue-700 bg-blue-50' : 'text-gray-600' }}">Tentang
                    Kami</a>
                <a href="{{ route('services') }}"
                    class="block px-4 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('services') ? 'text-blue-700 bg-blue-50' : 'text-gray-600' }}">Layanan</a>
                <a href="{{ route('contact') }}"
                    class="block px-4 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('contact') ? 'text-blue-700 bg-blue-50' : 'text-gray-600' }}">Kontak</a>
                <a href="{{ route('login') }}"
                    class="block px-4 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50">Login</a>
            </div>
        </div>
    </nav>

    {{-- Main Content --}}
    <main class="pt-16">
        @yield('content')
    </main>

    {{-- Footer --}}
    <footer class="bg-blue-900 text-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                {{-- Company Info --}}
                <div>
                    <div class="flex items-center gap-2 mb-4">
                        <img src="{{ asset('img/logo.png') }}" alt="PT. Unzanet" class="h-12 w-auto object-contain">
                    </div>
                    <p class="text-gray-400 text-sm leading-relaxed">Penyedia layanan internet RT/RW Net terpercaya
                        dengan jaringan fiber optik berkualitas tinggi.</p>
                </div>

                {{-- Quick Links --}}
                <div>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-blue-400 mb-4">Navigasi</h3>
                    <ul class="space-y-2">
                        <li><a href="{{ route('home') }}"
                                class="text-gray-400 hover:text-white text-sm transition-colors">Beranda</a></li>
                        <li><a href="{{ route('about') }}"
                                class="text-gray-400 hover:text-white text-sm transition-colors">Tentang Kami</a></li>
                        <li><a href="{{ route('services') }}"
                                class="text-gray-400 hover:text-white text-sm transition-colors">Layanan</a></li>
                        <li><a href="{{ route('contact') }}"
                                class="text-gray-400 hover:text-white text-sm transition-colors">Kontak</a></li>
                    </ul>
                </div>

                {{-- Contact --}}
                <div>
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-blue-400 mb-4">Kontak</h3>
                    <ul class="space-y-2 text-sm text-gray-400">
                        <li class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            info@unzanet.com
                        </li>
                        <li class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            +62 812-3456-7890
                        </li>
                        <li class="flex items-start gap-2">
                            <svg class="w-4 h-4 text-blue-400 mt-0.5" fill="none" stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Jl. Contoh No. 123, Kota
                        </li>
                    </ul>
                </div>
            </div>

            <div class="border-t border-gray-800 mt-8 pt-8 text-center">
                <p class="text-gray-500 text-sm">&copy; {{ date('Y') }} PT. Unzanet. All rights reserved.</p>
            </div>
        </div>
    </footer>
</body>

</html>
