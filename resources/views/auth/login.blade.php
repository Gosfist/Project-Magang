<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Login - Unzanet</title>
    <link rel="icon" type="image/png" href="{{ asset('img/logo.png') }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="font-sans antialiased bg-blue-50 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">

        <div class="bg-white rounded-lg shadow-sm border border-blue-100 p-8">
            {{-- Logo --}}
            <div class="text-center mb-8">
                <a href="{{ route('home') }}" class="inline-flex items-center gap-2">
                    <img src="{{ asset('img/logo.png') }}" alt="Unzanet" class="h-24 w-auto object-contain">
                </a>
            </div>

            {{-- Login Card --}}
            <h2 class="text-xl font-bold text-gray-900 mb-6">Login</h2>

            @if ($errors->any())
                <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    @foreach ($errors->all() as $error)
                        <p class="text-sm text-red-600">{{ $error }}</p>
                    @endforeach
                </div>
            @endif

            <div id="login-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"></div>

            <form id="login-form" method="POST" action="{{ route('api.login') }}" class="space-y-5">
                @csrf
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input type="email" name="email" id="email" value="{{ old('email') }}" required autofocus
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="email@unzanet.com">
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <input type="password" name="password" id="password" required
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="••••••••">
                </div>
                <button type="submit"
                    class="w-full px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 transition-all shadow-sm">
                    Masuk
                </button>
            </form>
        </div>

        <p class="text-center text-gray-400 text-sm mt-6">
            <a href="{{ route('home') }}" class="text-blue-600 hover:underline">Kembali ke Beranda</a>
        </p>
    </div>

    <script>
        localStorage.removeItem('unzanet_jwt');
        localStorage.removeItem('unzanet_jwt_expires_at');

        document.getElementById('login-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const form = event.currentTarget;
            const errorBox = document.getElementById('login-error');
            const submit = form.querySelector('[type="submit"]');

            errorBox.classList.add('hidden');
            errorBox.textContent = '';
            submit.disabled = true;

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: new FormData(form),
                });
                const payload = await response.json();

                if (!response.ok) {
                    const messages = Object.values(payload.errors || {}).flat();
                    throw new Error(messages.join(' ') || payload.message || 'Login gagal.');
                }

                localStorage.setItem('unzanet_jwt', payload.access_token);
                localStorage.setItem('unzanet_jwt_expires_at', payload.expires_at);
                window.location.href = payload.redirect_url;
            } catch (error) {
                errorBox.textContent = error.message || 'Login gagal.';
                errorBox.classList.remove('hidden');
            } finally {
                submit.disabled = false;
            }
        });
    </script>
</body>

</html>
