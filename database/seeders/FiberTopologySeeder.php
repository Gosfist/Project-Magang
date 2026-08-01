<?php

namespace Database\Seeders;

use App\Models\MainCore;
use Illuminate\Database\Seeder;

class FiberTopologySeeder extends Seeder
{
    public function run(): void
    {
        $server = MainCore::firstOrCreate([
            'nama_titik' => 'Server Pusat',
        ], [
            'tipe_titik' => 'server',
            'alamat' => 'Ruang server utama',
        ]);

        $rasio = MainCore::firstOrCreate([
            'nama_titik' => 'Rasio 01 Jalur Utama',
        ], [
            'parent_id' => $server->id,
            'tipe_titik' => 'rasio',
            'redaman_in' => -1.20,
            'alamat' => 'Jalur utama',
            'spesifikasi' => ['jenis_splitter' => '1:2'],
        ]);

        $odc = MainCore::firstOrCreate([
            'nama_titik' => 'ODC 01 Balai Desa',
        ], [
            'parent_id' => $rasio->id,
            'parent_port_out' => 1,
            'tipe_titik' => 'odc',
            'redaman_in' => -3.40,
            'alamat' => 'Balai Desa',
            'spesifikasi' => ['jenis_splitter' => '1:4'],
        ]);

        MainCore::firstOrCreate([
            'nama_titik' => 'ODP 01 Gang Melati',
        ], [
            'parent_id' => $odc->id,
            'parent_port_out' => 1,
            'tipe_titik' => 'odp',
            'redaman_in' => -6.10,
            'alamat' => 'Gang Melati',
            'spesifikasi' => ['jenis_splitter' => '1:8'],
        ]);
    }
}
