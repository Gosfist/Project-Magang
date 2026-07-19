<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('
            CREATE TABLE network_inputs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                network_point_id INTEGER NULL,
                main_core_id INTEGER NOT NULL,
                source_name VARCHAR NOT NULL,
                cable_color VARCHAR NULL,
                core_number INTEGER NULL,
                input_attenuation NUMERIC NOT NULL,
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(network_point_id) REFERENCES network_points(id) ON DELETE SET NULL,
                FOREIGN KEY(main_core_id) REFERENCES main_cores(id) ON DELETE CASCADE
            )
        ');
        DB::statement('
            INSERT INTO network_inputs_new (
                id, network_point_id, main_core_id, source_name, cable_color,
                core_number, input_attenuation, description, created_at, updated_at
            )
            SELECT
                id, network_point_id, COALESCE(main_core_id, (SELECT id FROM main_cores ORDER BY id LIMIT 1)),
                source_name, cable_color, core_number, input_attenuation, description, created_at, updated_at
            FROM network_inputs
            WHERE COALESCE(main_core_id, (SELECT id FROM main_cores ORDER BY id LIMIT 1)) IS NOT NULL
        ');
        DB::statement('DROP TABLE network_inputs');
        DB::statement('ALTER TABLE network_inputs_new RENAME TO network_inputs');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('
            CREATE TABLE network_inputs_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                network_point_id INTEGER NOT NULL,
                main_core_id INTEGER NULL,
                source_name VARCHAR NOT NULL,
                cable_color VARCHAR NULL,
                core_number INTEGER NULL,
                input_attenuation NUMERIC NOT NULL,
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(network_point_id) REFERENCES network_points(id) ON DELETE CASCADE,
                FOREIGN KEY(main_core_id) REFERENCES main_cores(id) ON DELETE SET NULL
            )
        ');
        DB::statement('
            INSERT INTO network_inputs_old (
                id, network_point_id, main_core_id, source_name, cable_color,
                core_number, input_attenuation, description, created_at, updated_at
            )
            SELECT
                id, COALESCE(network_point_id, (SELECT id FROM network_points ORDER BY id LIMIT 1)),
                main_core_id, source_name, cable_color, core_number, input_attenuation,
                description, created_at, updated_at
            FROM network_inputs
            WHERE COALESCE(network_point_id, (SELECT id FROM network_points ORDER BY id LIMIT 1)) IS NOT NULL
        ');
        DB::statement('DROP TABLE network_inputs');
        DB::statement('ALTER TABLE network_inputs_old RENAME TO network_inputs');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
