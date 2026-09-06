<?php

namespace Tests\Feature;

use App\Models\PppoeAccount;
use App\Models\PppoePackage;
use App\Models\User;
use App\Services\RadiusAccountService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PppoeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_open_package_and_account_pages(): void
    {
        $user = $this->user();

        $this->actingAs($user)->get('/dashboard/pppoe/packages')
            ->assertOk()
            ->assertSee('Daftar Paket PPPoE')
            ->assertSee('Tambah Paket')
            ->assertDontSee('Shared User')
            ->assertDontSeeHtml('name="is_active"');

        $this->actingAs($user)->get('/dashboard/pppoe/accounts')
            ->assertOk()
            ->assertSee('Daftar Akun PPPoE')
            ->assertSee('Tambahkan paket PPPoE terlebih dahulu')
            ->assertDontSeeHtml('name="expires_at"')
            ->assertDontSeeHtml('name="is_active"')
            ->assertDontSeeHtml('name="notes"');
    }

    public function test_account_crud_is_synchronized_to_freeradius_tables(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/dashboard/pppoe/packages', [
            'name' => 'Home 20 Mbps',
            'download_mbps' => 20,
            'upload_mbps' => 10,
            'price' => 200000,
            'address_pool' => 'pool-home',
        ])->assertRedirect('/dashboard/pppoe/packages');

        $package = PppoePackage::firstOrFail();
        $this->assertTrue($package->is_active);

        $this->actingAs($user)->post('/dashboard/pppoe/accounts', [
            'pppoe_package_id' => $package->id,
            'customer_name' => 'Budi Santoso',
            'username' => 'budi.pppoe',
            'password' => 'rahasia123',
            'phone' => '08123456789',
        ])->assertRedirect('/dashboard/pppoe/accounts');

        $account = PppoeAccount::firstOrFail();
        $this->assertTrue($account->is_active);
        $this->assertNull($account->expires_at);
        $this->assertNull($account->notes);
        $this->assertSame('rahasia123', $account->password);
        $this->assertNotSame('rahasia123', $account->getRawOriginal('password'));

        $this->actingAs($user)->get('/dashboard/pppoe/accounts')
            ->assertOk()
            ->assertSee('Nomor Telepon')
            ->assertSee('08123456789')
            ->assertDontSee('Masa Aktif');

        $this->assertDatabaseHas('radcheck', [
            'username' => 'budi.pppoe',
            'attribute' => 'Cleartext-Password',
            'op' => ':=',
            'value' => 'rahasia123',
        ]);
        $this->assertDatabaseHas('radcheck', [
            'username' => 'budi.pppoe',
            'attribute' => 'Simultaneous-Use',
            'value' => '1',
        ]);
        $this->assertDatabaseHas('radreply', [
            'username' => 'budi.pppoe',
            'attribute' => 'Mikrotik-Rate-Limit',
            'value' => '10M/20M',
        ]);
        $this->assertDatabaseHas('radreply', [
            'username' => 'budi.pppoe',
            'attribute' => 'Framed-Pool',
            'value' => 'pool-home',
        ]);

        $this->actingAs($user)->put("/dashboard/pppoe/accounts/{$account->id}", [
            'pppoe_package_id' => $package->id,
            'customer_name' => 'Budi Santoso',
            'username' => 'budi-baru',
            'password' => '',
            'is_active' => 1,
        ])->assertRedirect('/dashboard/pppoe/accounts');

        $this->assertDatabaseMissing('radcheck', ['username' => 'budi.pppoe']);
        $this->assertDatabaseHas('radcheck', [
            'username' => 'budi-baru',
            'attribute' => 'Cleartext-Password',
            'value' => 'rahasia123',
        ]);

        $this->actingAs($user)->delete("/dashboard/pppoe/accounts/{$account->id}")
            ->assertRedirect('/dashboard/pppoe/accounts');

        $this->assertDatabaseMissing('pppoe_accounts', ['id' => $account->id]);
        $this->assertDatabaseMissing('radcheck', ['username' => 'budi-baru']);
        $this->assertDatabaseMissing('radreply', ['username' => 'budi-baru']);
    }

    public function test_package_changes_resync_accounts_and_used_package_cannot_be_deleted(): void
    {
        $user = $this->user();
        $package = PppoePackage::create([
            'name' => 'Bisnis',
            'download_mbps' => 50,
            'upload_mbps' => 25,
            'price' => 500000,
            'is_active' => true,
        ]);
        $account = PppoeAccount::create([
            'pppoe_package_id' => $package->id,
            'customer_name' => 'Toko Maju',
            'username' => 'toko-maju',
            'password' => 'password123',
            'is_active' => true,
        ]);
        app(RadiusAccountService::class)->sync($account);

        $this->actingAs($user)->put("/dashboard/pppoe/packages/{$package->id}", [
            'name' => 'Bisnis',
            'download_mbps' => 100,
            'upload_mbps' => 50,
            'price' => 750000,
            'address_pool' => '',
        ])->assertRedirect('/dashboard/pppoe/packages');

        $this->assertDatabaseHas('radreply', [
            'username' => 'toko-maju',
            'attribute' => 'Mikrotik-Rate-Limit',
            'value' => '50M/100M',
        ]);

        $this->actingAs($user)->patch("/dashboard/pppoe/packages/{$package->id}/status")
            ->assertRedirect('/dashboard/pppoe/packages');

        $this->assertFalse($package->fresh()->is_active);
        $this->assertDatabaseMissing('radcheck', ['username' => 'toko-maju']);
        $this->assertDatabaseMissing('radreply', ['username' => 'toko-maju']);

        $this->actingAs($user)->delete("/dashboard/pppoe/packages/{$package->id}")
            ->assertSessionHas('error', 'Paket masih digunakan akun PPPoE dan tidak dapat dihapus.');
        $this->assertDatabaseHas('pppoe_packages', ['id' => $package->id]);
    }

    private function user(): User
    {
        return User::create([
            'name' => 'Admin',
            'email' => uniqid('admin').'@example.test',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }
}
