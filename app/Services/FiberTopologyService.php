<?php

namespace App\Services;

use App\Models\FiberCore;
use App\Models\FiberCoreEndpoint;
use App\Models\FoCable;
use App\Models\FoClosure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiberTopologyService
{
    public function createCable(array $data): FoCable
    {
        return DB::transaction(function () use ($data) {
            if ((int) $data['jumlah_core'] < 1) {
                throw ValidationException::withMessages(['jumlah_core' => 'Jumlah core minimal satu.']);
            }

            $sourceClosureId = $data['source_closure_id'] ?? null;
            $destinationClosureId = $data['destination_closure_id'] ?? null;
            unset($data['source_closure_id'], $data['destination_closure_id']);

            $sourceClosure = $sourceClosureId ? FoClosure::find($sourceClosureId) : null;
            $destinationClosure = $destinationClosureId ? FoClosure::find($destinationClosureId) : null;

            $cable = FoCable::create([
                ...$data,
                'fo_closure' => $sourceClosureId,
                'target_closure' => $destinationClosureId,
            ]);

            $pairedCable = null;
            if ($sourceClosureId && $destinationClosureId) {
                $pairedCable = FoCable::create([
                    'nama_kabel' => 'to ' . ($sourceClosure?->nama_cl ?? 'closure ' . $sourceClosureId),
                    'jumlah_core' => $data['jumlah_core'],
                    'fo_closure' => $destinationClosureId,
                    'target_closure' => $sourceClosureId,
                    'catatan' => $data['catatan'] ?? null,
                ]);

                $cable->update(['paired_cable' => $pairedCable->fo_kabel]);
                $pairedCable->update(['paired_cable' => $cable->fo_kabel]);
            }

            for ($i = 1; $i <= $cable->jumlah_core; $i++) {
                $core = FiberCore::create([
                    'fo_kabel' => $cable->fo_kabel,
                    'nomer_core' => $i,
                ]);

                FiberCoreEndpoint::create([
                    'fo_core' => $core->fo_core,
                    'fo_closure' => $sourceClosureId,
                    'endpoint_side' => 'A',
                ]);

                if ($pairedCable && $destinationClosure) {
                    $pairedCore = FiberCore::create([
                        'fo_kabel' => $pairedCable->fo_kabel,
                        'nomer_core' => $i,
                    ]);

                    FiberCoreEndpoint::create([
                        'fo_core' => $pairedCore->fo_core,
                        'fo_closure' => $destinationClosureId,
                        'endpoint_side' => 'A',
                    ]);

                    $core->update(['paired_core' => $pairedCore->fo_core]);
                    $pairedCore->update(['paired_core' => $core->fo_core]);
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
            $pairedCable = $cable->pairedCable;

            for ($i = 1; $i <= $count; $i++) {
                $coreNumber = $lastCoreNumber + $i;
                $core = FiberCore::create([
                    'fo_kabel' => $cable->fo_kabel,
                    'nomer_core' => $coreNumber,
                ]);

                FiberCoreEndpoint::create([
                    'fo_core' => $core->fo_core,
                    'fo_closure' => $closureId,
                    'endpoint_side' => 'A',
                ]);

                if ($pairedCable) {
                    $pairedCore = FiberCore::create([
                        'fo_kabel' => $pairedCable->fo_kabel,
                        'nomer_core' => $coreNumber,
                    ]);

                    FiberCoreEndpoint::create([
                        'fo_core' => $pairedCore->fo_core,
                        'fo_closure' => $pairedCable->fo_closure,
                        'endpoint_side' => 'A',
                    ]);

                    $core->update(['paired_core' => $pairedCore->fo_core]);
                    $pairedCore->update(['paired_core' => $core->fo_core]);
                }
            }

            $cable->update(['jumlah_core' => $cable->cores()->count()]);
            $pairedCable?->update(['jumlah_core' => $pairedCable->cores()->count()]);
        });
    }
}
