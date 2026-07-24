<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainServerCore extends Model
{
    protected $table = 'main_server_core';
    protected $primaryKey = 'main_server_core';
    public $timestamps = false;

    protected $fillable = ['core', 'tanggal', 'catatan'];

    public function odcs(): HasMany
    {
        return $this->hasMany(MainOdc::class, 'main_server_core', 'main_server_core');
    }
}
