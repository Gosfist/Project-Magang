<?php

namespace Tests\Feature;

use App\Models\FiberCore;
use App\Models\FiberCoreEndpoint;
use App\Models\FoCable;
use App\Models\FoClosure;
use App\Models\FoSplice;
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

    public function test_closure_name_must_be_unique(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Sama', 'alamat_cl' => 'A']);

        $this->actingAs($user)->post('/api/closures', [
            'nama_cl' => 'Closure Sama',
            'alamat_cl' => 'B',
        ])->assertUnprocessable()
            ->assertInvalid(['nama_cl'])
            ->assertJsonValidationErrors(['nama_cl']);

        $this->actingAs($user)->put("/api/closures/{$closure->fo_closure}", [
            'nama_cl' => 'Closure Sama',
            'alamat_cl' => 'A edit',
        ])->assertOk();

        $this->assertDatabaseHas('fo_closure', [
            'fo_closure' => $closure->fo_closure,
            'nama_cl' => 'Closure Sama',
            'alamat_cl' => 'A edit',
        ]);
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

    public function test_destination_cable_is_created_as_local_reverse_cable(): void
    {
        $user = $this->user();
        $server = FoClosure::create(['nama_cl' => 'server']);
        $closure = FoClosure::create(['nama_cl' => 'cl 1']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'to server',
            'jumlah_core' => 2,
            'source_closure_id' => $closure->fo_closure,
            'destination_closure_id' => $server->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $sourceCable = FoCable::where('fo_closure', $closure->fo_closure)->where('nama_kabel', 'to server')->firstOrFail();
        $reverseCable = FoCable::where('fo_closure', $server->fo_closure)->where('nama_kabel', 'to cl 1')->firstOrFail();

        $this->assertSame($server->fo_closure, $sourceCable->target_closure);
        $this->assertSame($closure->fo_closure, $reverseCable->target_closure);
        $this->assertSame($reverseCable->fo_kabel, $sourceCable->paired_cable);
        $this->assertSame(2, $sourceCable->cores()->count());
        $this->assertSame(2, $reverseCable->cores()->count());
        $this->assertNotNull($sourceCable->cores()->where('nomer_core', 1)->firstOrFail()->paired_core);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$server->fo_closure}")
            ->assertOk()
            ->assertSee('to cl 1')
            ->assertSee('cl 1');
    }

    public function test_closure_detail_can_update_and_delete_local_cable(): void
    {
        $user = $this->user();
        $closureA = FoClosure::create(['nama_cl' => 'Closure Cable A']);
        $closureB = FoClosure::create(['nama_cl' => 'Closure Cable B']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'to Closure Cable B',
            'jumlah_core' => 1,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $closureB->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $cable = FoCable::where('fo_closure', $closureA->fo_closure)
            ->where('nama_kabel', 'to Closure Cable B')
            ->firstOrFail();
        $pairedCableId = $cable->paired_cable;

        $this->actingAs($user)->put("/dashboard/fiber/cables/{$cable->fo_kabel}", [
            'nama_kabel' => $cable->nama_kabel,
            'catatan' => 'catatan kabel edit',
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->assertDatabaseHas('fo_kabel', [
            'fo_kabel' => $cable->fo_kabel,
            'catatan' => 'catatan kabel edit',
        ]);

        $this->actingAs($user)->delete("/dashboard/fiber/cables/{$cable->fo_kabel}", [
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->assertDatabaseMissing('fo_kabel', ['fo_kabel' => $cable->fo_kabel]);
        $this->assertDatabaseMissing('fo_kabel', ['fo_kabel' => $pairedCableId]);
    }

    public function test_splice_links_two_local_cores_and_reads_second_redaman_from_remote_pair(): void
    {
        $user = $this->user();
        $server = FoClosure::create(['nama_cl' => 'server']);
        $closureA = FoClosure::create(['nama_cl' => 'cl 1']);
        $closureB = FoClosure::create(['nama_cl' => 'cl 2']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'to server',
            'jumlah_core' => 4,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $server->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'to cl 2',
            'jumlah_core' => 4,
            'source_closure_id' => $closureA->fo_closure,
            'destination_closure_id' => $closureB->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closureA->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $incomingCore = FoCable::where('fo_closure', $closureA->fo_closure)->where('nama_kabel', 'to server')->firstOrFail()
            ->cores()->where('nomer_core', 3)->firstOrFail();
        $outgoingCore = FoCable::where('fo_closure', $closureA->fo_closure)->where('nama_kabel', 'to cl 2')->firstOrFail()
            ->cores()->where('nomer_core', 4)->firstOrFail();

        $outgoingCore->pairedCore()->firstOrFail()->update(['redaman' => 9.9]);

        $this->actingAs($user)->post("/dashboard/fiber/closures/{$closureA->fo_closure}/splices", [
            'core_a' => $incomingCore->fo_core,
            'core_b' => $outgoingCore->fo_core,
            'redaman_core_a' => 1.25,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->assertDatabaseHas('fo_splice', [
            'fo_closure' => $closureA->fo_closure,
            'core_a' => $incomingCore->fo_core,
            'core_b' => $outgoingCore->fo_core,
        ]);
        $this->assertSame('1.250', $incomingCore->fresh()->redaman);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$closureA->fo_closure}")
            ->assertOk()
            ->assertSee('to server')
            ->assertSee('to cl 2')
            ->assertSee('Core 3 (Hijau)')
            ->assertSee('Core 4 (Coklat)')
            ->assertSee('1.250 dB')
            ->assertSee('9.900 dB');
    }

    public function test_splice_rejects_cores_from_same_cable(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Same Cable Splice']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'kabel 1',
            'jumlah_core' => 2,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $cable = FoCable::where('nama_kabel', 'kabel 1')->firstOrFail();
        $coreOne = $cable->cores()->where('nomer_core', 1)->firstOrFail();
        $coreTwo = $cable->cores()->where('nomer_core', 2)->firstOrFail();

        $this->actingAs($user)->post("/dashboard/fiber/closures/{$closure->fo_closure}/splices", [
            'core_a' => $coreOne->fo_core,
            'core_b' => $coreTwo->fo_core,
            'redaman_core_a' => 1,
        ])->assertSessionHasErrors(['core_b']);

        $this->assertDatabaseMissing('fo_splice', [
            'fo_closure' => $closure->fo_closure,
            'core_a' => $coreOne->fo_core,
            'core_b' => $coreTwo->fo_core,
        ]);
    }

    public function test_splice_can_be_updated_and_deleted(): void
    {
        $user = $this->user();
        $closure = FoClosure::create(['nama_cl' => 'Closure Edit Splice']);

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'kabel 1',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'kabel 2',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->actingAs($user)->post('/dashboard/fiber/cables', [
            'nama_kabel' => 'kabel 3',
            'jumlah_core' => 1,
            'source_closure_id' => $closure->fo_closure,
            'redirect_to' => 'fiber.closures.show',
            'redirect_closure_id' => $closure->fo_closure,
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $coreOne = FoCable::where('nama_kabel', 'kabel 1')->firstOrFail()->cores()->firstOrFail();
        $coreTwo = FoCable::where('nama_kabel', 'kabel 2')->firstOrFail()->cores()->firstOrFail();
        $coreThree = FoCable::where('nama_kabel', 'kabel 3')->firstOrFail()->cores()->firstOrFail();

        $splice = FoSplice::create([
            'fo_closure' => $closure->fo_closure,
            'core_a' => $coreOne->fo_core,
            'core_b' => $coreTwo->fo_core,
        ]);

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closure->fo_closure}/splices/{$splice->fo_splice}", [
            'core_a' => $coreOne->fo_core,
            'core_b' => $coreThree->fo_core,
            'redaman_core_a' => 7.5,
            'catatan' => 'pindah kabel 3',
        ])->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseHas('fo_splice', [
            'fo_splice' => $splice->fo_splice,
            'core_b' => $coreThree->fo_core,
            'catatan' => 'pindah kabel 3',
        ]);
        $this->assertSame('7.500', $coreOne->fresh()->redaman);

        $this->actingAs($user)->delete("/dashboard/fiber/closures/{$closure->fo_closure}/splices/{$splice->fo_splice}")
            ->assertRedirect("/dashboard/fiber/closures/{$closure->fo_closure}");

        $this->assertDatabaseMissing('fo_splice', ['fo_splice' => $splice->fo_splice]);
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
            ->assertSee('List Kabel')
            ->assertSee('Splice');

        $this->assertSame('22.200', $targetCoreB->fresh()->redaman);
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
            ->assertSee('List Kabel')
            ->assertSee('Splice');

        $this->assertSame('3.300', $sourceCore->fresh()->direct_redaman_awal);
        $this->assertSame('4.400', $targetCore->fresh()->redaman);
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

        $sourceCore = FiberCore::whereHas('endpoints', fn ($query) => $query->where('fo_closure', $closureA->fo_closure))->firstOrFail();
        $targetCore = $sourceCore->pairedCore()->firstOrFail();

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureA->fo_closure}/cores/{$sourceCore->fo_core}", [
            'redaman' => 2,
            'target_closure' => $closureB->fo_closure,
            'target_core' => $targetCore->fo_core,
        ])->assertRedirect("/dashboard/fiber/closures/{$closureA->fo_closure}");

        $this->actingAs($user)->patch("/dashboard/fiber/closures/{$closureB->fo_closure}/cores/{$targetCore->fo_core}", [
            'redaman' => 6,
            'target_closure' => '',
            'target_core' => '',
        ])->assertRedirect("/dashboard/fiber/closures/{$closureB->fo_closure}");

        $sourceCore->refresh();
        $targetCore->refresh();

        $this->assertSame('2.000', $sourceCore->direct_redaman_awal);
        $this->assertSame('6.000', $targetCore->redaman);

        $this->actingAs($user)->get("/dashboard/fiber/closures/{$closureB->fo_closure}")
            ->assertOk()
            ->assertSee('List Kabel')
            ->assertSee('Splice');
    }

    public function test_removed_pages_are_not_registered(): void
    {
        $user = $this->user();

        $this->actingAs($user)->get('/dashboard/fiber/measurements')->assertNotFound();
        $this->actingAs($user)->get('/dashboard/fiber/connections?closure_id=4')->assertNotFound();
        $this->actingAs($user)->get('/dashboard/fiber/trace')->assertNotFound();
        $this->actingAs($user)->post('/dashboard/fiber/closures/1/cores')->assertNotFound();
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
