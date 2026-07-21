<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FoSplitter extends Model
{
    public const RATIOS = ['1:2', '1:4', '1:8', '1:16', '1:32', '1:64'];

    protected $table = 'fo_splitter';
    protected $primaryKey = 'fo_splitter';
    public $timestamps = false;

    protected $fillable = ['fo_core', 'fo_closure', 'rasio_split', 'catatan'];

    public function core(): BelongsTo
    {
        return $this->belongsTo(FiberCore::class, 'fo_core', 'fo_core');
    }

    public function closure(): BelongsTo
    {
        return $this->belongsTo(FoClosure::class, 'fo_closure', 'fo_closure');
    }

    public function outputs(): HasMany
    {
        return $this->hasMany(FoSplitterOutput::class, 'fo_splitter', 'fo_splitter')->orderBy('nomor_output');
    }
}
