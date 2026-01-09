# Toko Contoh (static product data, QRIS & Tunai)

Deskripsi singkat:
- Produk disimpan sebagai array JS di `products.js` (bukan database, bukan localStorage).
- UI SPA sederhana: filter kategori, tambah ke keranjang, checkout.
- Metode pembayaran: QRIS (menampilkan QR code) dan Tunai (hitung kembalian otomatis).

Cara pakai:
1. Simpan semua file (`index.html`, `styles.css`, `products.js`, `app.js`) dalam satu folder.
2. Buka `index.html` di browser (cukup klik dua kali atau jalankan dengan server sederhana).
3. Tambahkan produk ke keranjang → Checkout → Pilih metode pembayaran:
   - QRIS: scan QR (saat ini QR hanyalah teks payload contoh, ganti dengan QR merchant sebenarnya jika diperlukan).
   - Tunai: masukkan jumlah uang yang diberikan pelanggan → kembalian akan dihitung otomatis.
4. Setelah konfirmasi pembayaran, struk akan ditampilkan; keranjang akan dikosongkan.

Catatan pengembangan / perbaikan yang bisa dilakukan:
- Ganti generator QR dengan integrasi QRIS resmi / static image merchant.
- Simpan riwayat transaksi ke server, atau ke file, jika dibutuhkan.
- Tambahkan validasi, diskon, atau pajak.
- Buat server backend untuk data produk dan pemrosesan pembayaran nyata.

Jika Anda mau, saya bisa:
- Menambahkan integrasi QRIS resmi (mis. payload EMVCo atau integrasi provider),
- Mengubah UI agar bisa menyimpan riwayat transaksi ke file atau backend,
- Menambahkan fitur login, admin untuk menambah/ubah produk (tetap tanpa DB).
Beri tahu mana yang ingin Anda tambahkan.