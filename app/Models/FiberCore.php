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

    protected $fillable = ['fo_kabel', 'redaman', 'nomer_core', 'warna_core', 'catatan'];

    protected function casts(): array
    {
        return ['nomer_core' => 'integer', 'redaman' => 'decimal:3'];
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

    public function getCoreNumberAttribute(): ?int
    {
        return $this->nomer_core;
    }

    public function getCoreColorAttribute(): ?string
    {
        return $this->warna_core;
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
