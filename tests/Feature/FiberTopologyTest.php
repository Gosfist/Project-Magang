<?php

namespace Tests\Feature;

use App\Models\MainOdc;
use App\Models\MainOdcOutput;
use App\Models\MainOdp;
use App\Models\MainOdpPort;
use App\Models\MainServerCore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiberTopologyTest extends TestCase
{
    use RefreshDatabase;

    public function test_main_core_dashboard_can_create_server_odc_and_odp(): void
    {
        $user = $this->user();

        $this->actingAs($user)->post('/dashboard/fiber/servers', [
            'core' => 1,
            'tanggal' => '2025-12-01',
        ])->assertRedirect('/dashboard/fiber/server');

        $server = MainServerCore::firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/odps', [
            'nama_odp' => 'odp 1',
            'rasio_split' => '1:8',
            'redaman' => 4,
            'tanggal' => '2025-12-01',
        ])->assertRedirect('/dashboard/fiber/odp');

        $odp = MainOdp::firstOrFail();

        $this->actingAs($user)->post('/dashboard/fiber/odcs', [
            'nama_odc' => 'odc 1',
            'main_server_core' => $server->main_server_core,
            'rasio_split' => '1:4',
            'redaman' => 2,
            'tanggal' => '2025-12-01',
        ])->assertRedirect('/dashboard/fiber/odc');

        $odc = MainOdc::firstOrFail();

        $this->assertSame(4, $odc->outputs()->count());
        $this->assertSame(8, $odp->ports()->count());

        $this->actingAs($user)->get('/dashboard/fiber')
            ->assertRedirect('/dashboard/fiber/server');

        $this->actingAs($user)->get('/dashboard/fiber/server')
            ->assertOk()
            ->assertSee('Server')
            ->assertSee('Core 1');

        $this->actingAs($user)->get('/dashboard/fiber/odc')
            ->assertOk()
            ->assertSee('ODC')
            ->assertSee('odc 1');

        $this->actingAs($user)->get('/dashboard/fiber/odp')
            ->assertOk()
            ->assertSee('ODP')
            ->assertSee('odp 1');
    }

    public function test_odc_detail_outputs_follow_ratio_and_can_target_odp(): void
    {
        $user = $this->user();
        $server = MainServerCore::create(['core' => 1, 'tanggal' => '2025-12-01']);
        $odp = MainOdp::create([
            'nama_odp' => 'odp 1',
            'rasio_split' => '1:8',
            'redaman' => 4,
            'tanggal' => '2025-12-01',
        ]);
        $odp->ports()->createMany(collect(range(1, 8))->map(fn ($port) => ['port_number' => $port])->all());

        $odc = MainOdc::create([
            'nama_odc' => 'odc 1',
            'main_server_core' => $server->main_server_core,
            'rasio_split' => '1:4',
            'redaman' => 2,
            'tanggal' => '2025-12-01',
        ]);
        $odc->outputs()->createMany(collect(range(1, 4))->map(fn ($output) => ['output_number' => $output])->all());
        $output = $odc->outputs()->where('output_number', 1)->firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/odcs/{$odc->main_odc}/outputs/{$output->main_odc_output}", [
            'main_odp' => $odp->main_odp,
            'redaman' => 4,
            'tanggal' => '2025-12-01',
        ])->assertRedirect("/dashboard/fiber/odcs/{$odc->main_odc}");

        $this->assertDatabaseHas('main_odc_output', [
            'main_odc_output' => $output->main_odc_output,
            'main_odp' => $odp->main_odp,
            'redaman' => 4,
        ]);

        $this->actingAs($user)->get("/dashboard/fiber/odcs/{$odc->main_odc}")
            ->assertOk()
            ->assertSee('odc 1')
            ->assertSee('odp 1')
            ->assertSee('4 dB')
            ->assertSee('01 Desember 2025');
    }

    public function test_updating_ratios_resizes_outputs_and_ports(): void
    {
        $user = $this->user();
        $server = MainServerCore::create(['core' => 1]);

        $this->actingAs($user)->post('/dashboard/fiber/odcs', [
            'nama_odc' => 'odc resize',
            'main_server_core' => $server->main_server_core,
            'rasio_split' => '1:2',
        ])->assertRedirect('/dashboard/fiber/odc');

        $odc = MainOdc::firstOrFail();
        $this->assertSame(2, $odc->outputs()->count());

        $this->actingAs($user)->patch("/dashboard/fiber/odcs/{$odc->main_odc}", [
            'nama_odc' => 'odc resize',
            'main_server_core' => $server->main_server_core,
            'rasio_split' => '1:8',
        ])->assertRedirect('/dashboard/fiber/odc');

        $this->assertSame(8, $odc->fresh()->outputs()->count());

        $this->actingAs($user)->post('/dashboard/fiber/odps', [
            'nama_odp' => 'odp resize',
            'rasio_split' => '1:2',
        ])->assertRedirect('/dashboard/fiber/odp');

        $odp = MainOdp::firstOrFail();
        $this->assertSame(2, $odp->ports()->count());

        $this->actingAs($user)->patch("/dashboard/fiber/odps/{$odp->main_odp}", [
            'nama_odp' => 'odp resize',
            'rasio_split' => '1:4',
        ])->assertRedirect('/dashboard/fiber/odp');

        $this->assertSame(4, $odp->fresh()->ports()->count());
    }

    public function test_odp_port_can_be_edited_and_cleared(): void
    {
        $user = $this->user();
        $odp = MainOdp::create([
            'nama_odp' => 'odp port',
            'rasio_split' => '1:8',
        ]);
        $port = MainOdpPort::create([
            'main_odp' => $odp->main_odp,
            'port_number' => 1,
        ]);

        $this->actingAs($user)->patch("/dashboard/fiber/odps/{$odp->main_odp}/ports/{$port->main_odp_port}", [
            'redaman' => 5,
            'tanggal' => '2025-12-01',
        ])->assertRedirect("/dashboard/fiber/odps/{$odp->main_odp}");

        $this->assertDatabaseHas('main_odp_port', [
            'main_odp_port' => $port->main_odp_port,
            'redaman' => 5,
            'tanggal' => '2025-12-01',
        ]);

        $this->actingAs($user)->delete("/dashboard/fiber/odps/{$odp->main_odp}/ports/{$port->main_odp_port}")
            ->assertRedirect("/dashboard/fiber/odps/{$odp->main_odp}");

        $this->assertNull($port->fresh()->redaman);
    }

    public function test_old_fiber_routes_are_removed(): void
    {
        $user = $this->user();

        $this->actingAs($user)->get('/dashboard/fiber/closures/1')->assertNotFound();
        $this->actingAs($user)->post('/dashboard/fiber/cables')->assertNotFound();
        $this->actingAs($user)->get('/api/closures')->assertNotFound();
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
