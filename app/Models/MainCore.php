<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainCore extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'total_core',
        'start_location',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'total_core' => 'integer',
        ];
    }

    /**
     * Get the network inputs that use this main core.
     */
    public function networkInputs(): HasMany
    {
        return $this->hasMany(NetworkInput::class);
    }
}
