USE modul_viewer;

INSERT INTO modules (title, slug, original_file, optimized_file, status, file_size)
VALUES ('Modul Contoh', 'modul-contoh', 'contoh-asli.pdf', 'contoh.pdf', 'ready', 0)
ON DUPLICATE KEY UPDATE optimized_file = VALUES(optimized_file), status = 'ready';