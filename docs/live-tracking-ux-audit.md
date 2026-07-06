# UX Audit — Live Tracking

Audit atas halaman **Live Tracking** saat ini, plus keputusan desain yang
diimplementasikan di halaman percobaan **Live Tracking Testing**. Sudut
pandang: *user-centered design* untuk persona utama — **ops/dispatcher** yang
memantau ±40 trip per hari dan harus menemukan + menangani trip bermasalah
(offline / telat) secepat mungkin.

---

## 1. Temuan audit

### 🔴 Berat (menghambat tugas utama)

| # | Temuan | Dampak ke user |
|---|--------|----------------|
| 1 | **Ringkasan status tidak persisten.** Stat card (Late / To Check) di-hide, urgency ticker default hidden. | Dispatcher tidak bisa menjawab "sekarang ada berapa masalah?" tanpa membuka switcher dulu. Situational awareness hilang. |
| 2 | **Dua sumbu scan.** Trip urgent ada di ticker *horizontal* di atas peta, daftar lengkap ada di list *vertikal* di kanan. | Mata harus bolak-balik antara dua arah scan; item urgent dan konteksnya terpisah secara spasial. |
| 3 | **Aksi buntu di detail.** Drawer detail hanya menampilkan data — tidak ada aksi (notify, tandai ditangani). | User melihat masalah tapi harus mencari tempat lain untuk bertindak → ekstra klik, ekstra beban ingatan. |
| 4 | **"Take it" hanya ada di ticker** — yang default-nya hidden. | Aksi triage utama praktis tersembunyi dari alur kerja default. |

### 🟡 Sedang (menambah friksi)

| # | Temuan | Dampak ke user |
|---|--------|----------------|
| 5 | **Test Console mencampur kontrol produk & kontrol QA** (map theme, card variation, simulate, per-driver override) dan mengambang menutupi list. | Kontrol tampilan tersembunyi di tool developer; panel menutupi data yang sedang dipantau. |
| 6 | **Terlalu banyak variasi** (6 urgent card × 4 vertical card × 3 tab × 4 marker). | Bagus untuk eksplorasi, tapi keputusan desain dilempar ke user. Produk akhir butuh *satu* jawaban terbaik per komponen. |
| 7 | **Counts dan filter terpisah.** Angka ringkasan (dulu stat card) dan filter (tab) adalah dua elemen berbeda padahal secara mental itu satu: "tunjukkan 6 yang telat". | Duplikasi elemen, ekstra langkah dari *melihat angka* → *memfilter*. |
| 8 | **ETA "-" untuk trip offline** tanpa penjelasan di kartu ringkas. | "-" ambigu: belum ada data, atau error? Harusnya langsung menjawab: *terakhir terlihat kapan*. |

### 🟢 Ringan

| # | Temuan |
|---|--------|
| 9 | Tidak ada empty-state yang actionable saat filter/search tidak menghasilkan apa-apa (tidak ada tombol "clear"). |
| 10 | Elemen klik berupa `div` tanpa fokus keyboard yang konsisten di beberapa kartu. |
| 11 | Setelah trip ditangani, tidak ada jejak visual ("sudah di-take siapa/kapan") di list utama. |

### ✅ Yang sudah baik (dipertahankan)

- Klik marker ⇄ klik card tersinkron (satu `selectedId`), map pan + zoom ke trip.
- Label status konsisten dengan switcher (Offline ≠ To Check).
- Counter + pulse di tab Offline/Late — pola "angka memancing aksi" terbukti pas.
- Bus-badge marker berwarna status — status terbaca tanpa klik.

---

## 2. Prinsip revamp (Live Tracking Testing)

1. **Counts are filters.** Satu KPI bar di atas: setiap chip = angka + filter
   sekaligus. Melihat "Late 6" dan mengklik-nya adalah satu gerakan.
2. **Satu sumbu scan.** Tidak ada ticker horizontal. Trip urgent **dipin di
   atas list vertikal** dalam grup "Needs attention" — selalu terlihat, di
   sumbu baca yang sama dengan daftar lainnya.
3. **Aksi di tempat konteks.** "Take it" inline di kartu urgent; drawer detail
   punya aksi nyata: **Notify driver** (status → Notified) dan **Mark
   handled**.
4. **Progressive disclosure.** Kartu list memuat yang perlu untuk scan (route
   code, jam mulai, nama depan, plat, ETA/status); detail lengkap di drawer.
5. **Satu desain terbaik, bukan katalog.** Kartu, marker (bus badge), theme
   (Silver) dipilihkan; kontrol yang tersisa hanya kontrol *layer* yang memang
   milik ops (routes, traffic, simulate) dalam satu popover kecil di peta.
6. **Setiap state punya jalan keluar.** Empty state punya tombol "Clear
   filters"; offline card menampilkan "Last seen …" bukan "-"; trip yang
   ditangani diberi tag "Handled".

---

## 3. Yang diimplementasikan

| Komponen | Sebelum | Sesudah (Testing) |
|---|---|---|
| Ringkasan | Stat card hidden + tab terpisah | **KPI bar klikabel** (All / On Time / Late / Offline / Notified) dengan pulse di chip urgent |
| Urgensi | Ticker horizontal, default hidden | **Grup "Needs attention"** dipin di atas list, selalu tampil, "Take it" inline |
| Detail | Drawer tanpa aksi | **Drawer + aksi**: Notify driver, Mark handled |
| Kartu list | 4 variasi | 1 desain: accent bar status, route chip, jam mulai, ETA/last-seen, nama depan + plat |
| Kontrol peta | Test Console mengambang | Popover **Layers** kecil di peta (routes / traffic / simulate) |
| Marker | 4 variasi | Bus badge berwarna status (varian terbaik) |
| Empty state | Teks saja | Teks + **Clear filters** |

## 4. Rekomendasi lanjutan (belum diimplementasi)

- **Persist preferensi** (filter terakhir, panel collapse) ke `localStorage`.
- **Umur data** per kartu ("updated 12s ago") saat backend real tersedia.
- **Bulk action** saat >1 trip offline dari fleet owner yang sama (satu
  eskalasi untuk semuanya).
- **Notifikasi browser** opsional saat trip baru masuk ke Needs attention.
- Audit aksesibilitas penuh (kontras badge kuning, focus ring konsisten).
