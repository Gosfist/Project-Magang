<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FoSplice extends Model
{
    protected $table = 'fo_splice';
    protected $primaryKey = 'fo_splice';
    public $timestamps = false;

    protected $fillable = ['fo_closure', 'core_a', 'core_b', 'catatan'];

    public function closure(): BelongsTo
    {
        return $this->belongsTo(FoClosure::class, 'fo_closure', 'fo_closure');
    }

    public function coreA(): BelongsTo
    {
        return $this->belongsTo(FiberCore::class, 'core_a', 'fo_core');
    }

    public function coreB(): BelongsTo
    {
        return $this->belongsTo(FiberCore::class, 'core_b', 'fo_core');
    }
}
