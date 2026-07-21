<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FoClosure extends Model
{
    use HasFactory;

    protected $table = 'fo_closure';
    protected $primaryKey = 'fo_closure';
    public $timestamps = false;

    protected $fillable = ['nama_cl', 'alamat_cl', 'catatan'];

    public function endpoints(): HasMany
    {
        return $this->hasMany(FiberCoreEndpoint::class, 'fo_closure', 'fo_closure');
    }

    public function getNameAttribute(): ?string
    {
        return $this->nama_cl;
    }

    public function getAddressAttribute(): ?string
    {
        return $this->alamat_cl;
    }

    public function getNotesAttribute(): ?string
    {
        return $this->catatan;
    }
}
