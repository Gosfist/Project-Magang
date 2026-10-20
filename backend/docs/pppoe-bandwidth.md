# Limit kecepatan PPPoE

Paket menyimpan kecepatan pelanggan dalam Mbps. `RadiusService.sync` mengirim
`Mikrotik-Rate-Limit := uploadM/downloadM`; RX router berarti upload pelanggan,
TX berarti download pelanggan. Contoh download 20 Mbps/upload 3 Mbps menjadi
`3M/20M`. Paket 5/5 menjadi `5M/5M`, tanpa konfigurasi burst.

Referensi resmi: [MikroTik RADIUS](https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS).
Referensi lokal yang diperiksa: Salfanet `backend/src/server/services/mikrotik/rate-limit.ts`
dan `backend/src/app/api/pppoe/profiles/route.ts` pada checkout referensi.
Salfanet memperbarui atribut RADIUS dan menerapkan perubahan sesi aktif melalui
CoA/API dengan fallback disconnect. Jangan menyalin urutan download/upload
di komentar referensi: dokumentasi MikroTik menetapkan upload/download.

Perubahan RADIUS hanya diterapkan saat autentikasi. Project Magang memakai
RADIUS Disconnect-Request UDP 3799 agar modem login ulang
dengan limit/pool baru. Ini dilakukan setelah transaksi RADIUS tersimpan saat
kecepatan atau pool paket berubah, serta saat paket/router akun diganti.
Edit harga/nama saja tidak memutus sesi. Kegagalan pemutusan menghasilkan
peringatan di respons, sehingga penyimpanan paket tidak dianggap bukti penerapan
limit pada router. Pembaruan accounting setiap lima menit bukan mekanisme
penerapan ulang limit. Tidak membuat Accounting-Stop palsu.

## Diagnosis router

Jalankan perintah baca saat transfer benar-benar berlangsung dari pelanggan:

```routeros
/ppp active print detail where name="000002"
/queue simple print detail where name="<pppoe-000002>"
/queue simple print stats where name="<pppoe-000002>"
/queue simple print detail where name="CLIENT"
/ip firewall filter print detail where action=fasttrack-connection
/ip firewall connection print count-only where fasttrack=yes
/ip pool print detail where name="pool-pppoe"
```

Pastikan sesi RADIUS, max-limit sesuai paket, queue tidak disabled/invalid,
dan counter bertambah saat transfer. Bila queue punya parent, target parent
harus mencakup IP pelanggan. FastTrack dapat melewati Simple Queue; rule yang
dinonaktifkan juga dapat meninggalkan koneksi lama yang masih FastTracked.
Lihat [Queues](https://help.mikrotik.com/docs/spaces/ROS/pages/328088/Queues).

### Temuan live 11 Oktober 2026

Output pengguna: akun 000002 memakai 192.168.75.254 melalui RADIUS. Child queue
max-limit=5M/5M, burst=0/0, parent=CLIENT, seluruh counter=0 saat pengujian;
tidak ada rule FastTrack dan koneksi FastTrack=0. Parent CLIENT mempunyai target
192.168.33.0/24,192.168.76.0/24, max-limit=97M/97M, sehingga tidak mencakup
IP pelanggan. Pool pool-pppoe mempunyai ranges=192.168.75.2-192.168.75.254.

Perbaikan pada **router tersebut**, mempertahankan target lama dan menambah pool:

```routeros
/queue simple set [find where name="CLIENT"] target=192.168.33.0/24,192.168.76.0/24,192.168.75.0/24
```

Jangan menjalankan contoh target ini pada router lain tanpa membaca target/pool
yang sebenarnya. Update backend Ubuntu tidak mengubah konfigurasi parent router.
Ulangi pengujian: counter child harus bertambah dan kecepatan mendekati batas
paket; 5 Mbps setara 0,625 MB/s sebelum overhead. Build/unit test tidak membuktikan
hasil throughput perangkat. Perbaikan router dan pengujian ulang masih perlu
dibuktikan melalui output pengguna.

### Temuan terverifikasi 20 Oktober 2026

Akun wisnu mempunyai `Mikrotik-Rate-Limit := 20M/20M` di SQL dan queue dinamis
`<pppoe-wisnu>` dengan max-limit=20M/20M tanpa burst. FastTrack kosong dan
koneksi FastTrack=0. Queue CLIENT di urutan pertama sudah mencakup
192.168.75.0/24, tetapi queue wisnu mempunyai parent=none dan bytes/packets=0.
Queue yang lebih dahulu cocok dapat menangkap trafik sebelum queue pelanggan;
ini berbeda dari kasus target parent yang belum mencakup subnet pada 11 Oktober.

Perbaikan khusus router tersebut, melalui Terminal Winbox:

```routeros
/ppp profile set [find where name="UNZANET-INTERNET-1"] parent-queue=CLIENT
/ppp active remove [find where name="wisnu" service=pppoe]
```

Baris kedua memutus hanya sesi wisnu agar modem login ulang dan queue dibuat
sebagai anak CLIENT. Setelahnya pengguna mengirim parent=CLIENT,
max-limit=20M/20M, rate download=19.1Mbps, bytes=267859/9868583 dan
packets=4250/7064, serta mengonfirmasi speedtest berhasil dibatasi.
Penyebab terverifikasi pada susunan queue router, bukan pengiriman limit RADIUS.
`limit-bytes-in/out=0` pada PPP Active adalah kuota byte, bukan batas Mbps.

Nama parent berbeda pada tiap router. Jangan menambahkan CLIENT ke script semua
NAS: router tanpa queue tersebut akan gagal. Atur Parent Queue pada profil
internet NAS sesuai queue induk yang benar dan pastikan target induk mencakup
subnet pelanggan. Pengaturan profil bertahan untuk login berikutnya; pemasangan
ulang profil baru melalui script add tetap memerlukan pemeriksaan queue router.

Untuk keluaran yang tidak terpotong saat speedtest:

```routeros
/queue simple print detail without-paging where dynamic=yes
/queue simple print stats without-paging where dynamic=yes
```

Rujukan: [urutan dan parent Simple Queue](https://help.mikrotik.com/docs/spaces/ROS/pages/328088/Queues)
dan [parent-queue pada profil PPP](https://help.mikrotik.com/docs/spaces/ROS/pages/132350049/PPP+AAA).
