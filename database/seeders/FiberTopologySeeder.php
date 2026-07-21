<?php

namespace Database\Seeders;

use App\Models\FoClosure;
use App\Services\FiberTopologyService;
use Illuminate\Database\Seeder;

class FiberTopologySeeder extends Seeder
{
    public function run(): void
    {
        $topology = app(FiberTopologyService::class);

        $cl01 = FoClosure::firstOrCreate(['nama_cl' => 'Closure Pusat'], ['alamat_cl' => 'Pusat']);
        $cl02 = FoClosure::firstOrCreate(['nama_cl' => 'Closure Barat'], ['alamat_cl' => 'Barat']);

        $topology->createCable([
            'nama_kabel' => 'Kabel CL01 CL02',
            'jumlah_core' => 4,
            'source_closure_id' => $cl01->fo_closure,
            'destination_closure_id' => $cl02->fo_closure,
            'catatan' => 'Data contoh',
        ]);
    }
}
