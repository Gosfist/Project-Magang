<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Dashboard') - Unzanet</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="font-sans antialiased bg-gray-50 min-h-screen">
    <div class="flex min-h-screen">
        {{-- Sidebar --}}
        <aside id="sidebar"
            class="fixed inset-y-0 left-0 z-50 w-64 bg-blue-800 text-white transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out">
            {{-- Logo --}}
            <div class="flex items-center gap-3 border-b border-blue-700/50 bg-blue-900 px-6" style="height: 53px;">
                <div class="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <div>
                    <span class="text-lg font-bold">Unzanet</span>

                </div>
            </div>

            {{-- Navigation --}}
            <nav class="mt-4 px-3 space-y-1 overflow-y-auto" style="max-height: calc(100vh - 180px);">
                <a href="{{ route('dashboard') }}"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('dashboard') ? 'bg-white/15 text-white shadow-sm' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Dashboard
                </a>

                @if (auth()->user()->isAdmin())
                    <a href="{{ route('users.index') }}"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('users.*') ? 'bg-white/15 text-white shadow-sm' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Data Petugas
                    </a>
                @endif

                <div class="pt-3 pb-1 px-3">
                    <p class="text-xs font-semibold uppercase tracking-wider text-blue-400/70">Data Jaringan</p>
                </div>

                <div>
                    <button type="button" onclick="toggleMainCoreMenu()"
                        class="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 {{ request()->routeIs('fiber.*') ? 'text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 3v18m0-18a4 4 0 00-4 4v2a4 4 0 004 4m0-10a4 4 0 014 4v2a4 4 0 01-4 4m-7 4h14" />
                        </svg>
                        <span class="flex-1 text-left">Main Core</span>
                        <span id="mainCoreChevron" class="text-xs {{ request()->routeIs('fiber.*') ? '' : '-rotate-90' }}">v</span>
                    </button>
                    <div id="mainCoreMenu" class="mt-1 space-y-1 pl-11 pr-2 {{ request()->routeIs('fiber.*') ? '' : 'hidden' }}">
                        <a href="{{ route('fiber.server') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.server') || request()->routeIs('fiber.dashboard') ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                            Server
                        </a>
                        <a href="{{ route('fiber.rasio') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.rasio') ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                            Rasio
                        </a>
                        <a href="{{ route('fiber.odc') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.odc') ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                            ODC
                        </a>
                        <a href="{{ route('fiber.odp') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.odp') ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                            ODP
                        </a>
                        <a href="{{ route('fiber.topology') }}"
                            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors {{ request()->routeIs('fiber.topology') ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white' }}">
                            Peta Topologi
                        </a>
                    </div>
                </div>

            </nav>

            {{-- User Info --}}
            <div class="absolute bottom-0 left-0 right-0 p-3 border-t border-blue-700/50">
                <div class="flex items-center gap-3 px-3 py-2">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {{ strtoupper(substr(auth()->user()->name, 0, 1)) }}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">{{ auth()->user()->name }}</p>
                        <p class="text-xs text-blue-300 capitalize">{{ auth()->user()->role }}</p>
                    </div>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit"
                            class="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
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
        <div id="sidebarOverlay" class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden" onclick="toggleSidebar()">
        </div>

        {{-- Main Content --}}
        <div class="min-w-0 flex-1 lg:ml-64">
            {{-- Top Bar --}}
            <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
                <div class="flex min-w-0 items-center justify-between px-4 sm:px-6 py-3">
                    <div class="flex items-center gap-3">
                        <button onclick="toggleSidebar()"
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
                            class="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
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
                    <button onclick="document.getElementById('global-flash')?.remove()"
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
                    <button onclick="document.getElementById('global-flash')?.remove()"
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

    <script>
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        }

        function toggleMainCoreMenu() {
            document.getElementById('mainCoreMenu')?.classList.toggle('hidden');
            document.getElementById('mainCoreChevron')?.classList.toggle('-rotate-90');
        }

        setTimeout(() => {
            document.getElementById('global-flash')?.remove();
        }, 5000);
    </script>

    @stack('scripts')
</body>

</html>
