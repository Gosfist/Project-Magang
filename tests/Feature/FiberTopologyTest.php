<?php

namespace Tests\Feature;

use App\Models\FiberCore;
use App\Models\FiberCoreEndpoint;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Models\FoSplitter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiberTopologyTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_cable_creates_cores_and_endpoints_in_simple_schema(): void
    {
        $user = $this->user();
        $a = FoClosure::create(['nama_cl' => 'Closure Pusat', 'alamat_cl' => 'Pusat']);
        $b = FoClosure::create(['nama_cl' => 'Closure Barat', 'alamat_cl' => 'Barat']);

        $this->actingAs($user)->post('/api/cables', [
            'nama_kabel' => 'Kabel CL01 CL02',
            'jumlah_core' => 4,
            'source_closure_id' => $a->fo_closure,
            'destination_closure_id' => $b->fo_closure,
            'catatan' => 'Distribusi',
        ])->assertCreated();

        $cable = FoCable::where('nama_kabel', 'Kabel CL01 CL02')->first();
        $this->assertSame(4, $cable->cores()->count());
        $this->assertSame(8, FiberCoreEndpoint::count());
    }

    public function test_closure_requires_nama_cl(): void
    {
        $this->actingAs($this->user())->post('/api/closures', [
            'alamat_cl' => 'Tanpa nama',
        ])->assertUnprocessable()
            ->assertInvalid(['nama_cl']);
    }

    public function test_dashboard_delete_closure_keeps_users_table_available(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Hapus']);

        $this->actingAs($user)->delete("/dashboard/fiber/closures/{$closure->fo_closure}", [
            'redirect_to' => 'fiber.dashboard',
        ])->assertRedirect('/dashboard/fiber');

        $this->assertDatabaseMissing('fo_closure', ['fo_closure' => $closure->fo_closure]);
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    public function test_closure_detail_can_update_core_redaman(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Web']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Web',
            'jumlah_core' => 2,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $core = FiberCore::first();
        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$core->fo_core}", [
            'redaman' => 12.5,
            'catatan' => 'OK',
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseHas('fo_core', [
            'fo_core' => $core->fo_core,
            'redaman' => 12.5,
            'catatan' => 'OK',
        ]);
    }

    public function test_cable_name_must_be_unique_only_inside_same_closure(): void
    {
        $user = $this->user();
        $closureA = FoClosure::create(['nama_cl' => 'Closure Unique A']);
        $closureB = FoClosure::create(['nama_cl' => 'Closure Unique B']);

        $payload = [
            'nama_kabel' => 'Kabel Unique',
            'jumlah_core' => 1,
            'source_closure_id' => $closureA->fo_closure,
        ];

        $this->actingAs($user)->post('/api/cables', $payload)->assertCreated();

        $this->actingAs($user)->post('/api/cables', [
            ...$payload,
            'source_closure_id' => $closureB->fo_closure,
        ])->assertCreated();

        $this->actingAs($user)->post('/api/cables', $payload)
            ->assertUnprocessable()
            ->assertInvalid(['nama_kabel']);
    }

    public function test_closure_detail_can_add_core_to_existing_cable(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Add Core']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Add Core',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $cable = FoCable::where('nama_kabel', 'Kabel Add Core')->firstOrFail();

        $this->actingAs($user)->post("/dashboard/fiber/closures/{$closure->fo_closure}/cores", [
            'fo_kabel' => $cable->fo_kabel,
            'jumlah_core' => 1,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertSame(2, $cable->fresh()->jumlah_core);
        $this->assertDatabaseHas('fo_core', [
            'fo_kabel' => $cable->fo_kabel,
            'nomer_core' => 2,
            'warna_core' => 'Orange',
        ]);

        $newCore = FiberCore::where('fo_kabel', $cable->fo_kabel)->where('nomer_core', 2)->firstOrFail();
        $this->assertDatabaseHas('fo_core_endpoint', [
            'fo_core' => $newCore->fo_core,
            'fo_closure' => $closure->fo_closure,
            'endpoint_side' => 'A',
        ]);
    }

    public function test_deleting_last_core_also_deletes_cable_record(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Delete Cable']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Delete Last Core',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $cable = FoCable::where('nama_kabel', 'Kabel Delete Last Core')->firstOrFail();
        $core = $cable->cores()->firstOrFail();

        $this->actingAs($user)->delete("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$core->fo_core}")
            ->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseMissing('fo_core', ['fo_core' => $core->fo_core]);
        $this->assertDatabaseMissing('fo_kabel', ['fo_kabel' => $cable->fo_kabel]);
    }

    public function test_core_delete_must_start_from_last_core_number(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Delete Ordered']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Delete Ordered',
            'jumlah_core' => 3,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $cable = FoCable::where('nama_kabel', 'Kabel Delete Ordered')->firstOrFail();
        $coreOne = $cable->cores()->where('nomer_core', 1)->firstOrFail();
        $coreThree = $cable->cores()->where('nomer_core', 3)->firstOrFail();

        $this->actingAs($user)->delete("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$coreOne->fo_core}")
            ->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}")
            ->assertSessionHasErrors(['core']);

        $this->assertDatabaseHas('fo_core', ['fo_core' => $coreOne->fo_core]);
        $this->assertSame(3, $cable->fresh()->jumlah_core);

        $this->actingAs($user)->delete("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$coreThree->fo_core}")
            ->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseMissing('fo_core', ['fo_core' => $coreThree->fo_core]);
        $this->assertSame(2, $cable->fresh()->jumlah_core);
    }

    public function test_core_edit_can_activate_and_deactivate_splitter(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Splitter']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Splitter',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $core = FiberCore::firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$core->fo_core}", [
            'redaman' => 10,
            'splitter_form_open' => 1,
            'splitter_status' => 'active',
            'rasio_split' => '1:2',
            'outputs' => [
                1 => ['redaman' => 1.1],
                2 => ['redaman' => 1.2],
            ],
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $splitter = FoSplitter::where('fo_core', $core->fo_core)->firstOrFail();
        $this->assertSame('1:2', $splitter->rasio_split);
        $this->assertSame(2, $splitter->outputs()->count());

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$core->fo_core}", [
            'redaman' => 10,
            'splitter_form_open' => 1,
            'splitter_status' => 'inactive',
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseMissing('fo_splitter', ['fo_splitter' => $splitter->fo_splitter]);
        $this->assertDatabaseMissing('fo_splitter_output', ['fo_splitter' => $splitter->fo_splitter]);
    }

    public function test_splitter_activation_requires_core_redaman(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Splitter Redaman']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Splitter Redaman',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $core = FiberCore::firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closure->fo_closure}/cores/{$core->fo_core}", [
            'splitter_form_open' => 1,
            'splitter_status' => 'active',
            'rasio_split' => '1:2',
        ])->assertSessionHasErrors(['redaman']);

        $this->assertDatabaseMissing('fo_splitter', ['fo_core' => $core->fo_core]);
    }

    public function test_splitter_outputs_can_target_different_closures_and_cores(): void
    {
        $user = $this->user();
        $closureA = FoClosure::create(['nama_cl' => 'Closure A']);
        $closureB = FoClosure::create(['nama_cl' => 'Closure B']);
        $closureC = FoClosure::create(['nama_cl' => 'Closure C']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel A B',
            'jumlah_core' => 2,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $closureB->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel C',
            'jumlah_core' => 1,
            'source_closure_id' => $closureC->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureC->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureC->fo_closure}");

        $splitterCore = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureA->fo_closure))
            ->where('nomer_core', 1)
            ->firstOrFail();
        $targetCoreB = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureB->fo_closure))
            ->where('nomer_core', 2)
            ->firstOrFail();
        $targetCoreC = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureC->fo_closure))
            ->firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureA->fo_closure}/cores/{$splitterCore->fo_core}", [
            'redaman' => 10,
            'splitter_form_open' => 1,
            'splitter_status' => 'active',
            'rasio_split' => '1:2',
            'outputs' => [
                1 => [
                    'redaman' => 1.1,
                    'target_closure' => $closureB->fo_closure,
                    'target_core' => $targetCoreB->fo_core,
                ],
                2 => [
                    'redaman' => 1.2,
                    'target_closure' => $closureC->fo_closure,
                    'target_core' => $targetCoreC->fo_core,
                ],
            ],
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $splitter = FoSplitter::where('fo_core', $splitterCore->fo_core)->firstOrFail();

        $this->assertDatabaseHas('fo_splitter_output', [
            'fo_splitter' => $splitter->fo_splitter,
            'nomor_output' => 1,
            'target_closure' => $closureB->fo_closure,
            'target_core' => $targetCoreB->fo_core,
        ]);
        $this->assertDatabaseHas('fo_splitter_output', [
            'fo_splitter' => $splitter->fo_splitter,
            'nomor_output' => 2,
            'target_closure' => $closureC->fo_closure,
            'target_core' => $targetCoreC->fo_core,
        ]);

        $targetCoreB->update(['redaman' => 22.2]);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$closureB->fo_closure}")
            ->assertOk()
            ->assertSee('Redaman Awal')
            ->assertSee('Redaman Akhir')
            ->assertSee('1.100 dB')
            ->assertSee('22.200 dB');
    }

    public function test_direct_core_target_supplies_initial_redaman_when_no_splitter_output_exists(): void
    {
        $user = $this->user();
        $closureA = FoClosure::create(['nama_cl' => 'Closure Direct A']);
        $closureB = FoClosure::create(['nama_cl' => 'Closure Direct B']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Direct',
            'jumlah_core' => 1,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $closureB->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $sourceCore = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureA->fo_closure))->firstOrFail();
        $targetCore = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureB->fo_closure))->firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureA->fo_closure}/cores/{$sourceCore->fo_core}", [
            'redaman' => 3.3,
            'target_closure' => $closureB->fo_closure,
            'target_core' => $targetCore->fo_core,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $targetCore->update(['redaman' => 4.4]);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$closureB->fo_closure}")
            ->assertOk()
            ->assertSee('3.300 dB')
            ->assertSee('4.400 dB');
    }

    public function test_editing_destination_redaman_keeps_direct_initial_redaman(): void
    {
        $user = $this->user();
        $closureA = FoClosure::create(['nama_cl' => 'Closure Awal']);
        $closureB = FoClosure::create(['nama_cl' => 'Closure Akhir']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'Kabel Redaman Direct',
            'jumlah_core' => 1,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $closureB->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $core = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureA->fo_closure))
            ->whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureB->fo_closure))
            ->firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureA->fo_closure}/cores/{$core->fo_core}", [
            'redaman' => 2,
            'target_closure' => $closureB->fo_closure,
            'target_core' => $core->fo_core,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureB->fo_closure}/cores/{$core->fo_core}", [
            'redaman' => 6,
            'target_closure' => '',
            'target_core' => '',
        ])->assertRedirect("/dashboard/fiber/closures/{$closureB->fo_closure}");

        $core->refresh();

        $this->assertSame('2.000', $core->direct_redaman_awal);
        $this->assertSame('6.000', $core->redaman);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$closureB->fo_closure}")
            ->assertOk()
            ->assertSee('2.000 dB')
            ->assertSee('6.000 dB');
    }

    public function test_removed_pages_are_not_registered(): void
    {
        $user = $this->user();

        $this->actingAs($user)->get('/dashboard/fiber/measurements')->assertNotFound();
        $this->actingAs($user)->get('/dashboard/fiber/connections?closure_id=4')->assertNotFound();
        $this->actingAs($user)->get('/dashboard/fiber/trace')->assertNotFound();
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
