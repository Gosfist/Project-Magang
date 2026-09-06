<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PppoeAccount extends Model
{
    protected $fillable = [
        'pppoe_package_id',
        'customer_name',
        'username',
        'password',
        'phone',
        'address',
        'expires_at',
        'is_active',
        'notes',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'expires_at' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(PppoePackage::class, 'pppoe_package_id');
    }
}
