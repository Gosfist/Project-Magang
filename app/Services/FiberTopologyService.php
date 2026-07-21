<?php

namespace App\Services;

use App\Models\FiberCore;
use App\Models\FiberCoreEndpoint;
use App\Models\FoCable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiberTopologyService
{
    private const CORE_COLORS = ['Biru', 'Orange', 'Hijau', 'Coklat', 'Abu-abu', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Pink', 'Aqua'];

    public function createCable(array $data): FoCable
    {
        return DB::transaction(function () use ($data) {
            if ((int) $data['jumlah_core'] < 1) {
                throw ValidationException::withMessages(['jumlah_core' => 'Jumlah core minimal satu.']);
            }

            $sourceClosureId = $data['source_closure_id'] ?? null;
            $destinationClosureId = $data['destination_closure_id'] ?? null;
            unset($data['source_closure_id'], $data['destination_closure_id']);

            $cable = FoCable::create($data);

            for ($i = 1; $i <= $cable->jumlah_core; $i++) {
                $core = FiberCore::create([
                    'fo_kabel' => $cable->fo_kabel,
                    'nomer_core' => $i,
                    'warna_core' => self::CORE_COLORS[($i - 1) % count(self::CORE_COLORS)],
                ]);

                FiberCoreEndpoint::create([
                    'fo_core' => $core->fo_core,
                    'fo_closure' => $sourceClosureId,
                    'endpoint_side' => 'A',
                ]);

                if ($destinationClosureId) {
                    FiberCoreEndpoint::create([
                        'fo_core' => $core->fo_core,
                        'fo_closure' => $destinationClosureId,
                        'endpoint_side' => 'B',
                    ]);
                }
            }

            return $cable;
        });
    }

    public function addCoreToCable(FoCable $cable, int $count, int $closureId): void
    {
        DB::transaction(function () use ($cable, $count, $closureId) {
            if ($count < 1) {
                throw ValidationException::withMessages(['jumlah_core' => 'Jumlah core minimal satu.']);
            }

            $lastCoreNumber = (int) $cable->cores()->max('nomer_core');

            for ($i = 1; $i <= $count; $i++) {
                $coreNumber = $lastCoreNumber + $i;
                $core = FiberCore::create([
                    'fo_kabel' => $cable->fo_kabel,
                    'nomer_core' => $coreNumber,
                    'warna_core' => self::CORE_COLORS[($coreNumber - 1) % count(self::CORE_COLORS)],
                ]);

                FiberCoreEndpoint::create([
                    'fo_core' => $core->fo_core,
                    'fo_closure' => $closureId,
                    'endpoint_side' => 'A',
                ]);
            }

            $cable->update(['jumlah_core' => $cable->cores()->count()]);
        });
    }
}
