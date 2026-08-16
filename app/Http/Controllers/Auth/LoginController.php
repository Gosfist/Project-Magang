<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    /**
     * Show login form.
     */
    public function showLogin()
    {
        if (Auth::check()) {
            return redirect()->route('dashboard');
        }

        return view('auth.login');
    }

    /**
     * Handle login attempt.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ]);

        $credentials = $request->only('email', 'password');

        if (Auth::attempt($credentials)) {
            $user = Auth::user();

            // Check if user is active
            if (! $user->isActive()) {
                Auth::logout();

                return back()->withErrors([
                    'email' => 'Akun Anda tidak aktif. Hubungi administrator.',
                ])->withInput($request->only('email'));
            }

            $request->session()->regenerate();

            return redirect()->intended(route('dashboard'));
        }

        return back()->withErrors([
            'email' => 'Email atau password salah.',
        ])->withInput($request->only('email'));
    }

    /**
     * Authenticate a same-origin API request using the Laravel session.
     */
    public function apiLogin(Request $request, JwtService $jwt): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => 'Email atau password salah.',
            ]);
        }

        $user = $request->user();

        if (! $user->isActive()) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'Akun Anda tidak aktif. Hubungi administrator.',
            ]);
        }

        $request->session()->regenerate();
        $token = $jwt->issue($user);

        return response()->json([
            'message' => 'Login berhasil.',
            'user' => $user,
            'access_token' => $token['access_token'],
            'token_type' => 'Bearer',
            'expires_at' => $token['expires_at'],
            'expires_in' => $token['expires_in'],
            'redirect_url' => route('dashboard'),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    /**
     * Handle logout.
     */
    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
