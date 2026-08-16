<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $users = $query->orderBy('name')->paginate(15)->withQueryString();

        return view('dashboard.useer.index', compact('users'));
    }

    public function create()
    {
        return view('dashboard.useer.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => 'required|in:admin,petugas',
            'status' => 'required|in:active,inactive',
        ], [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal 6 karakter.',
            'role.required' => 'Role wajib dipilih.',
            'role.in' => 'Role hanya boleh admin atau petugas.',
            'status.required' => 'Status wajib dipilih.',
            'status.in' => 'Status hanya boleh active atau inactive.',
        ]);

        User::create($request->only(['name', 'email', 'password', 'role', 'status']));

        return redirect()->route('users.index')->with('success', 'Petugas berhasil ditambahkan.');
    }

    public function edit(User $user)
    {
        return view('dashboard.useer.edit', compact('user'));
    }

    public function update(Request $request, User $user)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'role' => 'required|in:admin,petugas',
            'status' => 'required|in:active,inactive',
        ];

        if ($request->filled('password')) {
            $rules['password'] = 'string|min:6';
        }

        $request->validate($rules, [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah digunakan.',
            'password.min' => 'Password minimal 6 karakter.',
            'role.required' => 'Role wajib dipilih.',
            'role.in' => 'Role hanya boleh admin atau petugas.',
            'status.required' => 'Status wajib dipilih.',
            'status.in' => 'Status hanya boleh active atau inactive.',
        ]);

        $data = $request->only(['name', 'email', 'role', 'status']);

        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }

        $user->update($data);

        return redirect()->route('users.index')->with('success', 'Data petugas berhasil diperbarui.');
    }

    public function destroy(User $user)
    {
        // Prevent deleting own account
        if ($user->id === auth()->id()) {
            return back()->with('error', 'Anda tidak bisa menghapus akun sendiri.');
        }

        $user->delete();

        return redirect()->route('users.index')->with('success', 'Petugas berhasil dihapus.');
    }
}
