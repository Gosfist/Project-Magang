<?php

namespace Tests\Feature;

use App\Models\MainCore;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttenuationCalculatorTest extends TestCase
{
    use RefreshDatabase;

    public function test_calculator_requires_authentication(): void
    {
        $this->get('/dashboard/tools/kalkulator-redaman')->assertRedirect('/login');
    }

    public function test_calculator_is_separate_from_main_core_and_does_not_write_database(): void
    {
        $user = User::create([
            'name' => 'Petugas Tool',
            'email' => 'petugas-tool@example.test',
            'password' => 'password',
            'role' => 'petugas',
            'status' => 'active',
        ]);
        $before = MainCore::count();

        $this->actingAs($user)
            ->get('/dashboard/tools/kalkulator-redaman')
            ->assertOk()
            ->assertSee('Kalkulator Redaman')
            ->assertSee('data-attenuation-calculator', false)
            ->assertSee('value="1:2"', false)
            ->assertSee('value="1:4"', false)
            ->assertSee('value="1:8"', false)
            ->assertSee('value="70:30"', false)
            ->assertSee('value="80:20"', false)
            ->assertSee('value="90:10"', false)
            ->assertSee('value="0.5"', false)
            ->assertSee('value="0.35"', false)
            ->assertSee('tidak disimpan ke database');

        $this->assertSame($before, MainCore::count());
        $this->assertStringContainsString(
            'const safetyMarginDb = 1;',
            file_get_contents(resource_path('js/pages/attenuation-calculator.js')),
        );
        $this->assertStringContainsString(
            'lossConnector - safetyMarginDb',
            file_get_contents(resource_path('js/pages/attenuation-calculator.js')),
        );
    }
}
