<?php

namespace App\Http\Controllers;

use App\Models\MainOdc;
use App\Models\MainOdcOutput;
use App\Models\MainOdp;
use App\Models\MainOdpPort;
use App\Models\MainServerCore;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FiberDashboardController extends Controller
{
    public function index()
    {
        return redirect()->route('fiber.server');
    }

    public function server()
    {
        return view('dashboard.fiber.index', [
            'section' => 'server',
            'serverCores' => MainServerCore::orderBy('core')->get(),
            'odcs' => collect(),
            'odps' => collect(),
        ]);
    }

    public function odc()
    {
        return view('dashboard.fiber.index', [
            'section' => 'odc',
            'serverCores' => MainServerCore::orderBy('core')->get(),
            'odcs' => MainOdc::with('serverCore')->orderBy('nama_odc')->get(),
            'odps' => collect(),
        ]);
    }

    public function odp()
    {
        return view('dashboard.fiber.index', [
            'section' => 'odp',
            'serverCores' => collect(),
            'odcs' => collect(),
            'odps' => MainOdp::withCount('ports')->orderBy('nama_odp')->get(),
        ]);
    }

    public function storeServer(Request $request)
    {
        MainServerCore::create($this->validatedServer($request));

        return redirect()->route('fiber.server')->with('success', 'Server core berhasil ditambahkan.');
    }

    public function updateServer(Request $request, MainServerCore $server)
    {
        $server->update($this->validatedServer($request, $server));

        return redirect()->route('fiber.server')->with('success', 'Server core berhasil diperbarui.');
    }

    public function destroyServer(MainServerCore $server)
    {
        $server->delete();

        return redirect()->route('fiber.server')->with('success', 'Server core berhasil dihapus.');
    }

    public function storeOdc(Request $request)
    {
        $odc = MainOdc::create($this->validatedOdc($request));
        $this->syncOdcOutputs($odc);

        return redirect()->route('fiber.odc')->with('success', 'ODC berhasil ditambahkan.');
    }

    public function showOdc(MainOdc $odc)
    {
        return view('dashboard.fiber.odcs.show', [
            'odc' => $odc->load('serverCore', 'outputs.odp'),
            'odps' => MainOdp::orderBy('nama_odp')->get(),
        ]);
    }

    public function updateOdc(Request $request, MainOdc $odc)
    {
        $odc->update($this->validatedOdc($request, $odc));
        $this->syncOdcOutputs($odc);

        return redirect()->route('fiber.odc')->with('success', 'ODC berhasil diperbarui.');
    }

    public function destroyOdc(MainOdc $odc)
    {
        $odc->delete();

        return redirect()->route('fiber.odc')->with('success', 'ODC berhasil dihapus.');
    }

    public function updateOdcOutput(Request $request, MainOdc $odc, MainOdcOutput $output)
    {
        abort_unless($output->main_odc === $odc->main_odc, 404);

        $data = $request->validate([
            'main_odp' => ['nullable', 'exists:main_odp,main_odp'],
            'redaman' => ['nullable', 'numeric'],
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string'],
        ]);

        $output->update([
            'main_odp' => $data['main_odp'] ?: null,
            'redaman' => $data['redaman'] ?? null,
            'tanggal' => $data['tanggal'] ?? null,
            'catatan' => $data['catatan'] ?? null,
        ]);

        return redirect()->route('fiber.odcs.show', $odc)->with('success', 'Output ODC berhasil diperbarui.');
    }

    public function destroyOdcOutput(MainOdc $odc, MainOdcOutput $output)
    {
        abort_unless($output->main_odc === $odc->main_odc, 404);

        $output->update([
            'main_odp' => null,
            'redaman' => null,
            'tanggal' => null,
            'catatan' => null,
        ]);

        return redirect()->route('fiber.odcs.show', $odc)->with('success', 'Output ODC berhasil dikosongkan.');
    }

    public function storeOdp(Request $request)
    {
        $odp = MainOdp::create($this->validatedOdp($request));
        $this->syncOdpPorts($odp);

        return redirect()->route('fiber.odp')->with('success', 'ODP berhasil ditambahkan.');
    }

    public function showOdp(MainOdp $odp)
    {
        return view('dashboard.fiber.odps.show', [
            'odp' => $odp->load('ports'),
        ]);
    }

    public function updateOdp(Request $request, MainOdp $odp)
    {
        $odp->update($this->validatedOdp($request, $odp));
        $this->syncOdpPorts($odp);

        return redirect()->route('fiber.odp')->with('success', 'ODP berhasil diperbarui.');
    }

    public function destroyOdp(MainOdp $odp)
    {
        $odp->delete();

        return redirect()->route('fiber.odp')->with('success', 'ODP berhasil dihapus.');
    }

    public function updateOdpPort(Request $request, MainOdp $odp, MainOdpPort $port)
    {
        abort_unless($port->main_odp === $odp->main_odp, 404);

        $port->update($request->validate([
            'redaman' => ['nullable', 'numeric'],
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string'],
        ]));

        return redirect()->route('fiber.odps.show', $odp)->with('success', 'Port ODP berhasil diperbarui.');
    }

    public function destroyOdpPort(MainOdp $odp, MainOdpPort $port)
    {
        abort_unless($port->main_odp === $odp->main_odp, 404);

        $port->update([
            'redaman' => null,
            'tanggal' => null,
            'catatan' => null,
        ]);

        return redirect()->route('fiber.odps.show', $odp)->with('success', 'Port ODP berhasil dikosongkan.');
    }

    private function validatedServer(Request $request, ?MainServerCore $server = null): array
    {
        return $request->validate([
            'core' => ['required', 'integer', 'min:1', Rule::unique('main_server_core', 'core')->ignore($server?->main_server_core, 'main_server_core')],
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string'],
        ], [
            'core.unique' => 'Core server sudah ada.',
        ]);
    }

    private function validatedOdc(Request $request, ?MainOdc $odc = null): array
    {
        return $request->validate([
            'nama_odc' => ['required', 'string', 'max:255', Rule::unique('main_odc', 'nama_odc')->ignore($odc?->main_odc, 'main_odc')],
            'main_server_core' => ['required', 'exists:main_server_core,main_server_core'],
            'rasio_split' => ['required', Rule::in(MainOdc::RATIOS)],
            'redaman' => ['nullable', 'numeric'],
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string'],
        ], [
            'nama_odc.unique' => 'Nama ODC sudah ada.',
        ]);
    }

    private function validatedOdp(Request $request, ?MainOdp $odp = null): array
    {
        return $request->validate([
            'nama_odp' => ['required', 'string', 'max:255', Rule::unique('main_odp', 'nama_odp')->ignore($odp?->main_odp, 'main_odp')],
            'rasio_split' => ['required', Rule::in(MainOdp::RATIOS)],
            'redaman' => ['nullable', 'numeric'],
            'tanggal' => ['nullable', 'date'],
            'catatan' => ['nullable', 'string'],
        ], [
            'nama_odp.unique' => 'Nama ODP sudah ada.',
        ]);
    }

    private function syncOdcOutputs(MainOdc $odc): void
    {
        $count = $odc->split_count;
        $odc->outputs()->where('output_number', '>', $count)->delete();

        for ($number = 1; $number <= $count; $number++) {
            MainOdcOutput::firstOrCreate([
                'main_odc' => $odc->main_odc,
                'output_number' => $number,
            ]);
        }
    }

    private function syncOdpPorts(MainOdp $odp): void
    {
        $count = $odp->split_count;
        $odp->ports()->where('port_number', '>', $count)->delete();

        for ($number = 1; $number <= $count; $number++) {
            MainOdpPort::firstOrCreate([
                'main_odp' => $odp->main_odp,
                'port_number' => $number,
            ]);
        }
    }
}
