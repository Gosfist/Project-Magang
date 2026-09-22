-- Foto profil akun petugas.
ALTER TABLE users
  ADD COLUMN photo LONGTEXT NULL AFTER phone;
