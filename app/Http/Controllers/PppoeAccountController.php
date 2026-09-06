<?php

namespace App\Http\Controllers;

use App\Models\PppoeAccount;
use App\Models\PppoePackage;
use App\Services\RadiusAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PppoeAccountController extends Controller
{
    public function index(Request $request)
    {
        $accounts = PppoeAccount::query()
            ->with('package')
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim();
                $query->where(fn ($inner) => $inner
                    ->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%"));
            })
            ->orderBy('customer_name')
            ->paginate(5)
            ->withQueryString();

        $packages = PppoePackage::query()->orderBy('name')->get();

        return view('dashboard.pppoe.akun_pppoe', compact('accounts', 'packages'));
    }

    public function store(Request $request, RadiusAccountService $radius)
    {
        $data = $this->validated($request);
        unset($data['expires_at'], $data['notes']);
        $data['is_active'] = true;

        DB::transaction(function () use ($data, $radius) {
            $account = PppoeAccount::create($data);
            $radius->sync($account);
        });

        return to_route('pppoe.accounts.index')->with('success', 'Akun PPPoE berhasil ditambahkan dan disinkronkan ke RADIUS.');
    }

    public function update(Request $request, PppoeAccount $account, RadiusAccountService $radius)
    {
        $data = $this->validated($request, $account);
        $oldUsername = $account->username;

        if (! filled($data['password'] ?? null)) {
            unset($data['password']);
        }

        DB::transaction(function () use ($account, $data, $oldUsername, $radius) {
            $account->update($data);
            $radius->sync($account, $oldUsername);
        });

        return to_route('pppoe.accounts.index')->with('success', 'Akun PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.');
    }

    public function destroy(PppoeAccount $account, RadiusAccountService $radius)
    {
        DB::transaction(function () use ($account, $radius) {
            $radius->remove($account->username);
            $account->delete();
        });

        return to_route('pppoe.accounts.index')->with('success', 'Akun PPPoE dan data RADIUS berhasil dihapus.');
    }

    private function validated(Request $request, ?PppoeAccount $account = null): array
    {
        $passwordRules = $account
            ? ['nullable', 'string', 'min:6', 'max:64']
            : ['required', 'string', 'min:6', 'max:64'];

        $data = $request->validate([
            'pppoe_package_id' => ['required', 'integer', Rule::exists('pppoe_packages', 'id')],
            'customer_name' => ['required', 'string', 'max:150'],
            'username' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9._@-]+$/',
                Rule::unique('pppoe_accounts')->ignore($account),
            ],
            'password' => $passwordRules,
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'expires_at' => ['nullable', 'date'],
            'is_active' => $account ? ['required', 'boolean'] : ['nullable'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'pppoe_package_id.required' => 'Paket wajib dipilih.',
            'customer_name.required' => 'Nama pelanggan wajib diisi.',
            'username.required' => 'Username PPPoE wajib diisi.',
            'username.regex' => 'Username hanya boleh berisi huruf, angka, titik, garis bawah, @, dan tanda hubung.',
            'username.unique' => 'Username PPPoE sudah digunakan.',
            'password.required' => 'Password PPPoE wajib diisi.',
            'password.min' => 'Password PPPoE minimal 6 karakter.',
        ]);

        if ($account) {
            $data['is_active'] = $request->boolean('is_active');
        }

        return $data;
    }
}
