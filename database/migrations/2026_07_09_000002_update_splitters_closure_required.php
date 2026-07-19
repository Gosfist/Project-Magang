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
            CREATE TABLE splitters_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                network_point_id INTEGER NULL,
                main_core_id INTEGER NOT NULL,
                network_input_id INTEGER NOT NULL,
                splitter_name VARCHAR NOT NULL,
                splitter_ratio VARCHAR NOT NULL,
                total_ports INTEGER NOT NULL,
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(network_point_id) REFERENCES network_points(id) ON DELETE SET NULL,
                FOREIGN KEY(main_core_id) REFERENCES main_cores(id) ON DELETE CASCADE,
                FOREIGN KEY(network_input_id) REFERENCES network_inputs(id) ON DELETE CASCADE
            )
        ');
        DB::statement('
            INSERT INTO splitters_new (
                id, network_point_id, main_core_id, network_input_id, splitter_name,
                splitter_ratio, total_ports, description, created_at, updated_at
            )
            SELECT
                s.id,
                s.network_point_id,
                COALESCE(ni.main_core_id, (SELECT id FROM main_cores ORDER BY id LIMIT 1)),
                s.network_input_id,
                s.splitter_name,
                s.splitter_ratio,
                s.total_ports,
                s.description,
                s.created_at,
                s.updated_at
            FROM splitters s
            LEFT JOIN network_inputs ni ON ni.id = s.network_input_id
            WHERE COALESCE(ni.main_core_id, (SELECT id FROM main_cores ORDER BY id LIMIT 1)) IS NOT NULL
        ');
        DB::statement('DROP TABLE splitters');
        DB::statement('ALTER TABLE splitters_new RENAME TO splitters');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::statement('PRAGMA foreign_keys = OFF');
        DB::statement('
            CREATE TABLE splitters_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                network_point_id INTEGER NOT NULL,
                network_input_id INTEGER NOT NULL,
                splitter_name VARCHAR NOT NULL,
                splitter_ratio VARCHAR NOT NULL,
                total_ports INTEGER NOT NULL,
                description TEXT NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(network_point_id) REFERENCES network_points(id) ON DELETE CASCADE,
                FOREIGN KEY(network_input_id) REFERENCES network_inputs(id) ON DELETE CASCADE
            )
        ');
        DB::statement('
            INSERT INTO splitters_old (
                id, network_point_id, network_input_id, splitter_name,
                splitter_ratio, total_ports, description, created_at, updated_at
            )
            SELECT
                id,
                COALESCE(network_point_id, (SELECT id FROM network_points ORDER BY id LIMIT 1)),
                network_input_id,
                splitter_name,
                splitter_ratio,
                total_ports,
                description,
                created_at,
                updated_at
            FROM splitters
            WHERE COALESCE(network_point_id, (SELECT id FROM network_points ORDER BY id LIMIT 1)) IS NOT NULL
        ');
        DB::statement('DROP TABLE splitters');
        DB::statement('ALTER TABLE splitters_old RENAME TO splitters');
        DB::statement('PRAGMA foreign_keys = ON');
    }
};
