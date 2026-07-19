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
            CREATE TABLE splitter_outputs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                splitter_id INTEGER NOT NULL,
                port_number INTEGER NOT NULL,
                destination_network_point_id INTEGER NULL,
                destination_main_core_id INTEGER NULL,
                output_attenuation NUMERIC NULL,
                attenuation_difference NUMERIC NULL,
                status VARCHAR NOT NULL DEFAULT "empty",
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(splitter_id) REFERENCES splitters(id) ON DELETE CASCADE,
                FOREIGN KEY(destination_network_point_id) REFERENCES network_points(id) ON DELETE SET NULL,
                FOREIGN KEY(destination_main_core_id) REFERENCES main_cores(id) ON DELETE SET NULL,
                UNIQUE(splitter_id, port_number)
            )
        ');
        DB::statement('
            INSERT INTO splitter_outputs_new (
                id, splitter_id, port_number, destination_network_point_id, destination_main_core_id,
                output_attenuation, attenuation_difference, status, description, created_at, updated_at
            )
            SELECT
                id, splitter_id, port_number, destination_network_point_id, NULL,
                output_attenuation, attenuation_difference, status, description, created_at, updated_at
            FROM splitter_outputs
        ');
        DB::statement('DROP TABLE splitter_outputs');
        DB::statement('ALTER TABLE splitter_outputs_new RENAME TO splitter_outputs');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('
            CREATE TABLE splitter_outputs_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                splitter_id INTEGER NOT NULL,
                port_number INTEGER NOT NULL,
                destination_network_point_id INTEGER NULL,
                output_attenuation NUMERIC NULL,
                attenuation_difference NUMERIC NULL,
                status VARCHAR NOT NULL DEFAULT "empty",
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(splitter_id) REFERENCES splitters(id) ON DELETE CASCADE,
                FOREIGN KEY(destination_network_point_id) REFERENCES network_points(id) ON DELETE SET NULL,
                UNIQUE(splitter_id, port_number)
            )
        ');
        DB::statement('
            INSERT INTO splitter_outputs_old (
                id, splitter_id, port_number, destination_network_point_id,
                output_attenuation, attenuation_difference, status, description, created_at, updated_at
            )
            SELECT
                id, splitter_id, port_number, destination_network_point_id,
                output_attenuation, attenuation_difference, status, description, created_at, updated_at
            FROM splitter_outputs
        ');
        DB::statement('DROP TABLE splitter_outputs');
        DB::statement('ALTER TABLE splitter_outputs_old RENAME TO splitter_outputs');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
