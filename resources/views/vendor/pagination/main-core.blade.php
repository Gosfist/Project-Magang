@if ($paginator->hasPages())
    <nav role="navigation" aria-label="Pagination" class="flex justify-end">
        <div class="inline-flex overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            @if ($paginator->onFirstPage())
                <span class="flex h-9 w-9 items-center justify-center text-gray-300" aria-disabled="true">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </span>
            @else
                <a href="{{ $paginator->previousPageUrl() }}" rel="prev"
                    class="flex h-9 w-9 items-center justify-center text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Halaman sebelumnya">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </a>
            @endif

            @foreach ($elements as $element)
                @if (is_string($element))
                    <span class="flex h-9 min-w-9 items-center justify-center px-1.5 text-xs text-gray-300">{{ $element }}</span>
                @endif

                @if (is_array($element))
                    @foreach ($element as $page => $url)
                        @if ($page === $paginator->currentPage())
                            <span aria-current="page"
                                class="flex h-9 min-w-9 items-center justify-center bg-blue-50 px-1.5 text-xs font-semibold text-blue-600">
                                {{ $page }}
                            </span>
                        @else
                            <a href="{{ $url }}"
                                class="flex h-9 min-w-9 items-center justify-center px-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                aria-label="Halaman {{ $page }}">
                                {{ $page }}
                            </a>
                        @endif
                    @endforeach
                @endif
            @endforeach

            @if ($paginator->hasMorePages())
                <a href="{{ $paginator->nextPageUrl() }}" rel="next"
                    class="flex h-9 w-9 items-center justify-center text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Halaman berikutnya">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            @else
                <span class="flex h-9 w-9 items-center justify-center text-gray-300" aria-disabled="true">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </span>
            @endif
        </div>
    </nav>
@endif
