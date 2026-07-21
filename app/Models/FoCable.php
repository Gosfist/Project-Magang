<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FoCable extends Model
{
    use HasFactory;

    protected $table = 'fo_kabel';
    protected $primaryKey = 'fo_kabel';
    public $timestamps = false;

    protected $fillable = ['nama_kabel', 'jumlah_core', 'catatan'];

    protected function casts(): array
    {
        return ['jumlah_core' => 'integer'];
    }

    public function cores(): HasMany
    {
        return $this->hasMany(FiberCore::class, 'fo_kabel', 'fo_kabel')->orderBy('nomer_core');
    }

    public function getNameAttribute(): ?string
    {
        return $this->nama_kabel;
    }

    public function getCoreCountAttribute(): ?int
    {
        return $this->jumlah_core;
    }

    public function getNotesAttribute(): ?string
    {
        return $this->catatan;
    }
}
