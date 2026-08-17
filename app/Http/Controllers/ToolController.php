<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class ToolController extends Controller
{
    public function attenuationCalculator(): View
    {
        return view('dashboard.tools.attenuation-calculator');
    }
}
