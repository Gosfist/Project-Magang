<?php

namespace Tests\Feature;

use App\Models\MainCore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiberTopologyTest extends TestCase
{
    use RefreshDatabase;

    public function test_main_core_dashboard_can_create_all_prd_node_types(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/dashboard/fiber/server', [
            'nama_titik' => 'Server Pusat',
            'alamat' => 'Ruang server',
        ])->assertRedirect('/dashboard/fiber/server');

        $server = MainCore::type('server')->firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/rasio', [
            'parent_id' => $server->id,
            'nama_titik' => 'Rasio 01',
            'redaman_in' => -1.25,
            'alamat' => 'Jalur utama',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ])->assertRedirect('/dashboard/fiber/rasio');

        $rasio = MainCore::type('rasio')->firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $rasio->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODC 01',
            'redaman_in' => -3.5,
            'alamat' => 'Balai Desa',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertRedirect('/dashboard/fiber/odc');

        $odc = MainCore::type('odc')->firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/odp', [
            'parent_id' => $odc->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODP 01',
            'redaman_in' => -6.2,
            'alamat' => 'Gang Melati',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ])->assertRedirect('/dashboard/fiber/odp');

        $this->assertDatabaseHas('main_core', [
            'nama_titik' => 'ODP 01',
            'tipe_titik' => 'odp',
            'parent_id' => $odc->id,
            'parent_port_out' => 1,
        ]);

        $this->assertSame(2, $rasio->jumlah_output);
        $this->assertSame(4, $odc->jumlah_output);
        $this->assertSame(8, MainCore::type('odp')->firstOrFail()->jumlah_output);

        $this->actingAs($user)->get('/dashboard/fiber')
            ->assertRedirect('/dashboard/fiber/server');

        $this->actingAs($user)->get('/dashboard/fiber/server')
            ->assertOk()
            ->assertSee('Server Pusat');

        $this->actingAs($user)->get('/dashboard/fiber/rasio')
            ->assertOk()
            ->assertSee('Rasio 01')
            ->assertSee('1:2');

        $this->actingAs($user)->get('/dashboard/fiber/odc')
            ->assertOk()
            ->assertSee('ODC 01')
            ->assertSee('Rasio 01');

        $this->actingAs($user)->get('/dashboard/fiber/odp')
            ->assertOk()
            ->assertSee('ODP 01')
            ->assertSee('1:8')
            ->assertSee('8');
    }

    public function test_json_ajax_create_returns_node_payload(): void
    {
        $user = $this->user();
        $server = MainCore::create([
            'nama_titik' => 'Server Pusat',
            'tipe_titik' => 'server',
        ]);

        $this->actingAs($user)->postJson('/dashboard/fiber/odc', [
            'parent_id' => $server->id,
            'nama_titik' => 'ODC AJAX',
            'redaman_in' => -3.25,
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertOk()
            ->assertJsonPath('message', 'ODC berhasil ditambahkan.')
            ->assertJsonPath('node.nama_titik', 'ODC AJAX');
    }

    public function test_splitter_and_odp_specific_validation_follow_prd(): void
    {
        $user = $this->user();
        $server = MainCore::create([
            'nama_titik' => 'Server Pusat',
            'tipe_titik' => 'server',
        ]);

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $server->id,
            'nama_titik' => 'ODC invalid',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ])->assertSessionHasErrors('spesifikasi.jenis_splitter');

        $this->actingAs($user)->post('/dashboard/fiber/odp', [
            'parent_id' => $server->id,
            'nama_titik' => 'ODP valid 1:8',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ])->assertRedirect('/dashboard/fiber/odp');

        $this->assertSame(8, MainCore::type('odp')->firstOrFail()->jumlah_output);
    }

    public function test_connected_parent_is_hidden_and_cannot_be_reused(): void
    {
        $user = $this->user();
        $coreOne = MainCore::create(['nama_titik' => 'Core 1', 'tipe_titik' => 'server']);
        $coreTwo = MainCore::create(['nama_titik' => 'Core 2', 'tipe_titik' => 'server']);
        MainCore::create([
            'parent_id' => $coreOne->id,
            'nama_titik' => 'Rasio 1',
            'tipe_titik' => 'rasio',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ]);

        $this->actingAs($user)->get('/dashboard/fiber/odc')
            ->assertOk()
            ->assertDontSee('SERVER - Core 1')
            ->assertSee('SERVER - Core 2')
            ->assertSee('RASIO - Rasio 1');

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $coreOne->id,
            'nama_titik' => 'ODC salah',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertSessionHasErrors('parent_id');
    }

    public function test_splitter_parent_ports_cannot_be_reused(): void
    {
        $user = $this->user();
        $server = MainCore::create(['nama_titik' => 'Core 1', 'tipe_titik' => 'server']);
        $rasio = MainCore::create([
            'parent_id' => $server->id,
            'nama_titik' => 'Rasio 1',
            'tipe_titik' => 'rasio',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ]);

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $rasio->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODC port 1',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertRedirect('/dashboard/fiber/odc');

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $rasio->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODC port duplicate',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertSessionHasErrors('parent_port_out');

        $this->actingAs($user)->post('/dashboard/fiber/odc', [
            'parent_id' => $rasio->id,
            'parent_port_out' => 2,
            'nama_titik' => 'ODC port 2',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ])->assertRedirect('/dashboard/fiber/odc');

        $this->assertDatabaseHas('main_core', [
            'nama_titik' => 'ODC port 1',
            'parent_port_out' => 1,
        ]);
        $this->assertDatabaseHas('main_core', [
            'nama_titik' => 'ODC port 2',
            'parent_port_out' => 2,
        ]);
    }

    public function test_node_name_must_be_unique_with_type_specific_message(): void
    {
        $user = $this->user();
        $server = MainCore::create(['nama_titik' => 'Core 1', 'tipe_titik' => 'server']);
        MainCore::create([
            'parent_id' => $server->id,
            'nama_titik' => 'ODC 1',
            'tipe_titik' => 'odc',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ]);

        $odc = MainCore::type('odc')->firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/odp', [
            'parent_id' => $odc->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODP 2',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ])->assertRedirect('/dashboard/fiber/odp');

        $this->actingAs($user)->post('/dashboard/fiber/odp', [
            'parent_id' => $odc->id,
            'parent_port_out' => 2,
            'nama_titik' => 'ODP 2',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ])->assertSessionHasErrors([
            'nama_titik' => 'Nama ODP sudah digunakan!',
        ]);
    }

    public function test_topology_page_renders_recursive_tree_from_parent_id(): void
    {
        $user = $this->user();
        $server = MainCore::create(['nama_titik' => 'Server Pusat', 'tipe_titik' => 'server']);
        $odc = MainCore::create([
            'parent_id' => $server->id,
            'nama_titik' => 'ODC Cabang',
            'tipe_titik' => 'odc',
            'redaman_in' => -2.5,
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ]);
        MainCore::create([
            'parent_id' => $odc->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODP Ujung',
            'tipe_titik' => 'odp',
            'redaman_in' => -5.75,
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ]);

        $this->actingAs($user)->get('/dashboard/fiber/topologi')
            ->assertOk()
            ->assertSee('Peta Topologi Main Core')
            ->assertSee('Server Pusat')
            ->assertSee('ODC Cabang')
            ->assertSee('ODP Ujung');
    }

    public function test_node_delete_removes_row_from_database(): void
    {
        $user = $this->user();
        $server = MainCore::create(['nama_titik' => 'Server Hapus', 'tipe_titik' => 'server']);

        $this->actingAs($user)->delete("/dashboard/fiber/server/{$server->id}")
            ->assertRedirect('/dashboard/fiber/server');

        $this->assertDatabaseMissing('main_core', ['id' => $server->id]);
    }

    public function test_parent_node_cannot_be_deleted_before_children(): void
    {
        $user = $this->user();
        $server = MainCore::create(['nama_titik' => 'Core 1', 'tipe_titik' => 'server']);
        $rasio = MainCore::create([
            'parent_id' => $server->id,
            'nama_titik' => 'Rasio 1',
            'tipe_titik' => 'rasio',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ]);
        $odc = MainCore::create([
            'parent_id' => $rasio->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODC 1',
            'tipe_titik' => 'odc',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ]);

        $this->actingAs($user)->delete("/dashboard/fiber/server/{$server->id}")
            ->assertRedirect('/dashboard/fiber/server')
            ->assertSessionHas('error');

        $this->assertDatabaseHas('main_core', ['id' => $server->id]);

        $this->actingAs($user)->delete("/dashboard/fiber/odc/{$odc->id}")
            ->assertRedirect('/dashboard/fiber/odc');
        $this->actingAs($user)->delete("/dashboard/fiber/rasio/{$rasio->id}")
            ->assertRedirect('/dashboard/fiber/rasio');
        $this->actingAs($user)->delete("/dashboard/fiber/server/{$server->id}")
            ->assertRedirect('/dashboard/fiber/server');

        $this->assertDatabaseMissing('main_core', ['id' => $odc->id]);
        $this->assertDatabaseMissing('main_core', ['id' => $rasio->id]);
        $this->assertDatabaseMissing('main_core', ['id' => $server->id]);
    }

    public function test_old_fiber_detail_routes_are_removed(): void
    {
        $user = $this->user();

        $this->actingAs($user)->get('/dashboard/fiber/odcs/1')->assertNotFound();
        $this->actingAs($user)->get('/dashboard/fiber/odps/1')->assertNotFound();
        $this->actingAs($user)->post('/dashboard/fiber/cables')->assertNotFound();
    }

    private function user(): User
    {
        return User::create([
            'name' => 'Admin',
            'email' => uniqid('admin') . '@example.test',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }
}
