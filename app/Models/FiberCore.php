<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FiberCore extends Model
{
    use HasFactory;

    protected $table = 'fo_core';
    protected $primaryKey = 'fo_core';
    public $timestamps = false;

    private const CORE_COLORS = ['Biru', 'Orange', 'Hijau', 'Coklat', 'Abu-abu', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Pink', 'Aqua'];

    protected $fillable = ['fo_kabel', 'redaman', 'nomer_core', 'target_closure', 'target_core', 'paired_core', 'direct_redaman_awal', 'catatan'];

    protected function casts(): array
    {
        return ['nomer_core' => 'integer', 'redaman' => 'decimal:3', 'direct_redaman_awal' => 'decimal:3'];
    }

    public function cable(): BelongsTo
    {
        return $this->belongsTo(FoCable::class, 'fo_kabel', 'fo_kabel');
    }

    public function endpoints(): HasMany
    {
        return $this->hasMany(FiberCoreEndpoint::class, 'fo_core', 'fo_core')->orderBy('endpoint_side');
    }

    public function splitter(): HasOne
    {
        return $this->hasOne(FoSplitter::class, 'fo_core', 'fo_core');
    }

    public function incomingSplitterOutputs(): HasMany
    {
        return $this->hasMany(FoSplitterOutput::class, 'target_core', 'fo_core')->orderBy('nomor_output');
    }

    public function targetClosure(): BelongsTo
    {
        return $this->belongsTo(FoClosure::class, 'target_closure', 'fo_closure');
    }

    public function targetCore(): BelongsTo
    {
        return $this->belongsTo(self::class, 'target_core', 'fo_core');
    }

    public function pairedCore(): BelongsTo
    {
        return $this->belongsTo(self::class, 'paired_core', 'fo_core');
    }

    public function incomingDirectCores(): HasMany
    {
        return $this->hasMany(self::class, 'target_core', 'fo_core')->orderBy('nomer_core');
    }

    public function getCoreNumberAttribute(): ?int
    {
        return $this->nomer_core;
    }

    public function getCoreColorAttribute(): ?string
    {
        if (! $this->nomer_core) {
            return null;
        }

        return self::CORE_COLORS[($this->nomer_core - 1) % count(self::CORE_COLORS)];
    }

    public function getAttenuationDbAttribute(): mixed
    {
        return $this->redaman;
    }

    public function getDescriptionAttribute(): ?string
    {
        return $this->catatan;
    }
}
