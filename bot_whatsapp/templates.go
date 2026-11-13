package main

var templateDefaults = map[string]string{
	"sales":                 "Halo Bapak/Ibu {nama},\n\nProses registrasi pelanggan baru telah berhasil. Mohon bersabar, teknisi kami akan melakukan kunjungan.\n\nNo. Pelanggan: {nomor_pelanggan}\nNama: {nama}\nNomor WA: {nomor_wa}\nAlamat: {alamat}\nLayanan: {layanan}\n\n— PT Unzanet",
	"psb":                   "Halo Bapak/Ibu {nama},\n\nInternet Anda telah aktif.\n\nNo. Pelanggan: {nomor_pelanggan}\nLayanan: {layanan}\nBiaya PSB: {biaya_psb}\nPembayaran berikutnya tanggal {tanggal_mulai}-{tanggal_akhir} setiap bulan. Jika melewati jatuh tempo, layanan dapat diisolir.\n\n— PT Unzanet",
	"registration":          "Halo {nama}, akun internet Anda telah didaftarkan.\nNo. Pelanggan: {nomor_pelanggan}\nPaket: {paket}\nUsername: {username}\nPassword: {password}\n\n— PT Unzanet",
	"isolation":             "Halo {nama}, layanan internet No. {nomor_pelanggan} diisolir karena tagihan belum diselesaikan.\nPaket: {paket}\nTotal: {total_tagihan}\nJatuh tempo: {jatuh_tempo}\n\n— PT Unzanet",
	"deposit_collector":     "Halo {nama}, pembayaran {jumlah} untuk No. {nomor_pelanggan} telah diterima kolektor {nama_kolektor} pada {tanggal_setor}. Statusnya sedang diverifikasi.\n\n— PT Unzanet",
	"deposit_accepted":      "Halo {nama}, pembayaran {jumlah} untuk tagihan {bulan_tagihan} telah diterima perusahaan pada {tanggal_diterima}.\n\n— PT Unzanet",
	"termination_approved":  "Halo Bapak/Ibu {nama},\n\nPermohonan berhenti langganan Anda telah disetujui. Teknisi kami akan segera mengunjungi alamat Anda untuk mengambil perangkat.\n\nNo. Pelanggan: {nomor_pelanggan}\nPaket: {paket}\nTanggal berhenti: {tanggal_berhenti}\nTagihan bulan berjalan (prorata): {prorata}\nTunggakan / biaya lainnya: {tunggakan}\nTotal yang harus dibayar: {total_tagihan}\n\nPembayaran diserahkan kepada petugas saat pengambilan perangkat. Tidak ada tambahan tagihan langganan setelah tanggal berhenti.\n\n- PT Unzanet",
	"termination_completed": "Halo Bapak/Ibu {nama},\n\nPerangkat internet No. Pelanggan {nomor_pelanggan} telah diambil oleh {nama_petugas}. Langganan telah dihentikan sejak {tanggal_berhenti}.\nPembayaran akhir diterima petugas: {jumlah} (menunggu verifikasi finance).\n\nTerima kasih telah menggunakan layanan PT Unzanet.\n\n- PT Unzanet",
}
