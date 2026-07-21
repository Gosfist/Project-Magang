<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiberCoreEndpoint extends Model
{
    use HasFactory;

    public const SIDES = ['A', 'B'];

    protected $table = 'fo_core_endpoint';
    protected $primaryKey = 'fo_core_endpoint';
    public $timestamps = false;

    protected $fillable = ['fo_core', 'fo_closure', 'endpoint_side'];

    public function fiberCore(): BelongsTo
    {
        return $this->belongsTo(FiberCore::class, 'fo_core', 'fo_core');
    }

    public function closure(): BelongsTo
    {
        return $this->belongsTo(FoClosure::class, 'fo_closure', 'fo_closure');
    }

    public function getDisplayNameAttribute(): string
    {
        $this->loadMissing('fiberCore.cable', 'closure');
        $core = $this->fiberCore;

        return trim(($core?->cable?->nama_kabel ?? 'Kabel') . ' Core ' . ($core?->nomer_core ?? '-') . ' Side ' . $this->endpoint_side);
    }
}
