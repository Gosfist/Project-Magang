<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Dashboard') - Unzanet</title>
    <link rel="icon" type="image/png" href="{{ asset('img/logo.png') }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body data-dashboard data-me-url="{{ route('api.me') }}" data-login-url="{{ route('login') }}"
    class="min-h-screen bg-slate-100 font-sans antialiased text-slate-900">
    <div class="flex min-h-screen">
        {{-- Sidebar --}}
        <aside id="sidebar"
            class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-slate-950 text-white transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out">
            {{-- Logo --}}
            <div class="flex h-16 shrink-0 items-center gap-3 overflow-hidden border-b border-slate-800 bg-slate-950 px-4">
                <img src="{{ asset('img/logo.png') }}" alt="Unzanet" class="block shrink-0 object-contain"
                    style="width: auto; height: 36px;">
                <span class="truncate text-sm font-bold tracking-wide text-white">PT UNZANET</span>
            </div>

            {{-- Navigation --}}
            <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
                <a href="{{ route('dashboard') }}"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('dashboard') ? 'bg-white/15 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                </a>

                @if (auth()->user()->isAdmin())
                    <a href="{{ route('users.index') }}"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('users.*') ? 'bg-white/15 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Data Petugas
                    </a>
                @endif

                <div class="pt-3 pb-1 px-3">
                    <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Data Jaringan</p>
                </div>

                <div>
                    <button type="button" data-toggle-maincore-menu
                        class="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('fiber.*') ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 3v18m0-18a4 4 0 00-4 4v2a4 4 0 004 4m0-10a4 4 0 014 4v2a4 4 0 01-4 4m-7 4h14" />
                        </svg>
                        <span class="flex-1 text-left">Main Core</span>
                        <svg id="mainCoreChevron"
                            class="h-4 w-4 shrink-0 transition-transform {{ request()->routeIs('fiber.*') ? '' : '-rotate-90' }}"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="mainCoreMenu" class="mt-1 space-y-1 pl-11 pr-2 {{ request()->routeIs('fiber.*') ? '' : 'hidden' }}">
                        <a href="{{ route('fiber.trace') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.trace') ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                            Trace Jalur
                        </a>
                        {{-- Navigasi Main Core memakai perpindahan halaman Laravel biasa, bukan SPA. --}}
                        <a href="{{ route('fiber.server') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.server') || request()->routeIs('fiber.dashboard') ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                            Server
                        </a>
                        <a href="{{ route('fiber.rasio') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.rasio') ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                            Rasio
                        </a>
                        <a href="{{ route('fiber.odc') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.odc') ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                            ODC
                        </a>
                        <a href="{{ route('fiber.odp') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.odp') ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white' }}">
                            ODP
                        </a>
                    </div>
                </div>

            </nav>

            {{-- User Info --}}
            <div class="shrink-0 border-t border-slate-800 bg-slate-950 p-3">
                <div class="flex items-center gap-3 px-3 py-2">
                    <div id="current-user-initial" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950">
                        {{ strtoupper(substr(auth()->user()->name, 0, 1)) }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p id="current-user-name" class="text-sm font-medium truncate">{{ auth()->user()->name }}</p>
                        <p id="current-user-role" class="text-xs text-slate-400 capitalize">{{ auth()->user()->role }}</p>
                    </div>
                    <form id="logout-form" data-logout-form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Logout">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        {{-- Sidebar overlay for mobile --}}
        <div id="sidebarOverlay" data-toggle-sidebar class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden">
        </div>

        {{-- Main Content --}}
        <div class="min-w-0 flex-1 lg:ml-64">
            {{-- Top Bar --}}
            <header class="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
                <div class="flex min-w-0 items-center justify-between px-4 sm:px-6 py-3">
                    <div class="flex items-center gap-3">
                        <button type="button" data-toggle-sidebar
                            class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 class="text-lg font-semibold text-gray-800">@yield('page-title', 'Dashboard')</h1>
                    </div>
                    <div class="flex items-center gap-3">
                        <a href="{{ route('home') }}" target="_blank"
                            class="text-sm text-slate-900 hover:text-black transition-colors flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Web Profile
                        </a>
                    </div>
                </div>
            </header>

            {{-- Page Content --}}
            <main class="p-4 sm:p-6">
                @yield('content')
            </main>
        </div>
    </div>

    @if (session('success') || session('error'))
        <div id="global-flash" class="fixed bottom-4 right-4 z-[80] w-[calc(100%-2rem)] max-w-sm">
            @if (session('success'))
                <div
                    class="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg shadow-sm flex items-start gap-3">
                    <svg class="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm leading-5">{{ session('success') }}</span>
                    <button type="button" data-dismiss="global-flash"
                        class="ml-auto text-green-500 hover:text-green-700">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            @endif

            @if (session('error'))
                <div
                    class="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg shadow-sm flex items-start gap-3">
                    <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-sm leading-5">{{ session('error') }}</span>
                    <button type="button" data-dismiss="global-flash"
                        class="ml-auto text-red-500 hover:text-red-700">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            @endif
        </div>
    @endif

    @stack('scripts')
</body>

</html>
