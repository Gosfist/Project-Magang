<?php

namespace Tests\Feature;

use App\Models\MainCore;
use App\Models\User;
use App\Services\JwtService;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MainCoreApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_and_me_use_the_api_session(): void
    {
        $user = $this->user();

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('message', 'Login berhasil.')
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonMissingPath('user.password')
            ->assertJsonMissingPath('user.remember_token')
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('expires_in', 604800)
            ->assertJsonPath('redirect_url', route('dashboard'));

        $this->withToken($loginResponse->json('access_token'))->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'admin');

        $this->get('/dashboard')->assertOk();
    }

    public function test_api_rejects_invalid_login_and_unauthenticated_requests(): void
    {
        $user = $this->user();

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'salah',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/maincore/server')->assertUnauthorized();
    }

    public function test_main_core_api_exposes_each_type_and_crud(): void
    {
        $user = $this->user();
        $token = $this->tokenFor($user);

        $createResponse = $this->withToken($token)->postJson('/api/maincore/server', [
            'nama_titik' => 'Server API',
            'redaman_in' => -1.25,
        ])->assertOk()
            ->assertJsonPath('message', 'Server berhasil ditambahkan.')
            ->assertJsonPath('node.tipe_titik', 'server');

        $serverId = $createResponse->json('node.id');

        foreach (MainCore::TYPES as $type) {
            $this->withToken($token)->getJson("/api/maincore/{$type}")
                ->assertOk()
                ->assertJsonStructure([
                    'data',
                    'meta' => ['current_page', 'last_page', 'per_page', 'total'],
                ]);
        }

        $fragmentResponse = $this->withToken($token)->getJson('/api/maincore/server?fragment=1&per_page=5')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 5)
            ->assertJsonMissingPath('data')
            ->assertJson(fn ($json) => $json
                ->whereType('fragment', 'string')
                ->where('fragment', fn (string $fragment) => str_contains($fragment, 'data-maincore-feature'))
                ->etc());

        $this->assertStringNotContainsString('<script', $fragmentResponse->json('fragment'));
        $this->assertStringNotContainsString('<link', $fragmentResponse->json('fragment'));
        $this->assertStringNotContainsString('data-existing-names', $fragmentResponse->json('fragment'));
        $this->assertStringContainsString('data-load-edit-modal', $fragmentResponse->json('fragment'));
        $this->assertStringNotContainsString('id="editModal', $fragmentResponse->json('fragment'));

        $this->withToken($token)->patchJson("/api/maincore/server/{$serverId}", [
            'nama_titik' => 'Server API Baru',
            'redaman_in' => -2,
        ])->assertOk()
            ->assertJsonPath('message', 'Server berhasil diperbarui.')
            ->assertJsonPath('node.nama_titik', 'Server API Baru');

        $this->withToken($token)->deleteJson("/api/maincore/server/{$serverId}")
            ->assertOk()
            ->assertJsonPath('message', 'Server berhasil dihapus.');

        $this->assertDatabaseMissing('main_core', ['id' => $serverId]);
    }

    public function test_parent_search_is_limited_and_edit_modal_is_loaded_on_demand(): void
    {
        $user = $this->user();
        $token = $this->tokenFor($user);

        // Buat lebih dari batas respons untuk membuktikan API hanya mengirim 20 kandidat.
        $parents = collect(range(1, 25))->map(fn (int $number) => MainCore::create([
            'nama_titik' => sprintf('ODC Parent %02d', $number),
            'tipe_titik' => 'odc',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ]));

        $parentResponse = $this->withToken($token)->getJson(
            '/api/maincore/odp/parents?category=odc&search=Parent',
        )->assertOk()
            ->assertJsonCount(20, 'data')
            ->assertJsonStructure([
                'data' => [['id', 'name', 'type', 'output_count', 'used_ports']],
            ]);

        $this->assertSame('ODC Parent 01', $parentResponse->json('data.0.name'));

        $odp = MainCore::create([
            'parent_id' => $parents->first()->id,
            'parent_port_out' => 1,
            'nama_titik' => 'ODP Edit API',
            'tipe_titik' => 'odp',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ]);

        $editResponse = $this->withToken($token)->getJson("/api/maincore/odp/{$odp->id}/edit")
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->whereType('fragment', 'string')
                ->where('fragment', fn (string $fragment) => str_contains($fragment, 'editModal'.$odp->id))
                ->etc());

        $this->assertStringContainsString('ODP Edit API', $editResponse->json('fragment'));
        $this->assertStringContainsString('ODC Parent 01', $editResponse->json('fragment'));
        $this->assertStringNotContainsString('<script', $editResponse->json('fragment'));
        $this->assertStringNotContainsString('<link', $editResponse->json('fragment'));
    }

    public function test_jwt_expires_after_seven_days(): void
    {
        $user = $this->user();
        $issuedAt = now()->timestamp;
        $token = app(JwtService::class)->issue($user)['access_token'];

        JWT::$timestamp = $issuedAt + 604801;

        try {
            $this->withToken($token)->getJson('/api/me')
                ->assertUnauthorized()
                ->assertJsonPath('code', 'token_expired');
        } finally {
            JWT::$timestamp = null;
        }
    }

    public function test_frontend_forms_target_the_api_routes(): void
    {
        $user = $this->user();

        $this->get('/login')
            ->assertOk()
            ->assertSee(route('api.login'), false)
            ->assertSee('data-login-form', false)
            ->assertDontSee('<script>', false);

        foreach (MainCore::TYPES as $type) {
            $this->actingAs($user)->get("/dashboard/fiber/{$type}")
                ->assertOk()
                ->assertSee(route('api.maincore.store', $type), false)
                ->assertSee(route('api.maincore.index', $type), false)
                ->assertSee(route("fiber.{$type}"), false)
                ->assertDontSee('data-maincore-link', false)
                ->assertSee('data-maincore-form', false)
                ->assertSee('data-open-modal', false)
                ->assertDontSee('<script>', false);
        }

        $this->assertFileExists(resource_path('js/services/api.js'));
        $this->assertFileExists(resource_path('js/services/main-core-service.js'));
        $this->assertStringContainsString(
            "headers.set('Authorization'",
            file_get_contents(resource_path('js/services/api.js')),
        );
        $this->assertStringNotContainsString(
            'window.location.reload()',
            file_get_contents(resource_path('js/pages/maincore.js')),
        );
        $this->assertStringNotContainsString(
            'navigateToFeature',
            file_get_contents(resource_path('js/pages/maincore.js')),
        );
        $this->assertStringContainsString(
            'loadMainCoreEditModal',
            file_get_contents(resource_path('js/pages/maincore.js')),
        );
        $this->assertStringNotContainsString(
            'validateUniqueName',
            file_get_contents(resource_path('js/pages/maincore.js')),
        );
        $this->assertStringContainsString(
            "import('./pages/maincore')",
            file_get_contents(resource_path('js/app.js')),
        );
    }

    private function user(): User
    {
        return User::create([
            'name' => 'Admin API',
            'email' => uniqid('api').'@example.test',
            'password' => 'password',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function tokenFor(User $user): string
    {
        return app(JwtService::class)->issue($user)['access_token'];
    }
}
