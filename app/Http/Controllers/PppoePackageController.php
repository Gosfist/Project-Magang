<?php

namespace App\Http\Controllers;

use App\Models\PppoePackage;
use App\Services\RadiusAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PppoePackageController extends Controller
{
    public function index(Request $request)
    {
        $packages = PppoePackage::query()
            ->withCount('accounts')
            ->when($request->filled('search'), fn ($query) => $query
                ->where('name', 'like', '%'.$request->string('search')->trim().'%'))
            ->orderBy('name')
            ->paginate(5)
            ->withQueryString();

        return view('dashboard.pppoe.daftar_paket', compact('packages'));
    }

    public function store(Request $request, RadiusAccountService $radius)
    {
        $data = $this->validated($request);
        $data['is_active'] = true;

        DB::transaction(function () use ($data, $radius) {
            $package = PppoePackage::create($data);
            $package->accounts->each(fn ($account) => $radius->sync($account));
        });

        return to_route('pppoe.packages.index')->with('success', 'Paket PPPoE berhasil ditambahkan.');
    }

    public function update(Request $request, PppoePackage $package, RadiusAccountService $radius)
    {
        $data = $this->validated($request, $package);

        DB::transaction(function () use ($package, $data, $radius) {
            $package->update($data);
            $package->load('accounts');
            $package->accounts->each(fn ($account) => $radius->sync($account));
        });

        return to_route('pppoe.packages.index')->with('success', 'Paket PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.');
    }

    public function toggleStatus(PppoePackage $package, RadiusAccountService $radius)
    {
        DB::transaction(function () use ($package, $radius) {
            $package->update(['is_active' => ! $package->is_active]);
            $package->load('accounts');
            $package->accounts->each(fn ($account) => $radius->sync($account));
        });

        $status = $package->is_active ? 'diaktifkan' : 'dinonaktifkan';

        return to_route('pppoe.packages.index')->with('success', "Paket PPPoE berhasil {$status}.");
    }

    public function destroy(PppoePackage $package)
    {
        if ($package->accounts()->exists()) {
            return back()->with('error', 'Paket masih digunakan akun PPPoE dan tidak dapat dihapus.');
        }

        $package->delete();

        return to_route('pppoe.packages.index')->with('success', 'Paket PPPoE berhasil dihapus.');
    }

    private function validated(Request $request, ?PppoePackage $package = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('pppoe_packages')->ignore($package)],
            'download_mbps' => ['required', 'integer', 'min:1', 'max:100000'],
            'upload_mbps' => ['required', 'integer', 'min:1', 'max:100000'],
            'price' => ['required', 'integer', 'min:0'],
            'address_pool' => ['nullable', 'string', 'max:100'],
        ], [
            'name.required' => 'Nama paket wajib diisi.',
            'name.unique' => 'Nama paket sudah digunakan.',
            'download_mbps.required' => 'Kecepatan download wajib diisi.',
            'upload_mbps.required' => 'Kecepatan upload wajib diisi.',
            'price.required' => 'Harga paket wajib diisi.',
        ]);

        $data['address_pool'] = filled($data['address_pool'] ?? null) ? trim($data['address_pool']) : null;

        return $data;
    }
}
