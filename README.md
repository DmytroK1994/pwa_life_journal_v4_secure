# Opus — PWA цифровий сейф

Готовий офлайн PWA-проєкт на HTML/CSS/Vanilla JS.

## Запуск

1. Завантажте папку на GitHub Pages або будь-який статичний хостинг.
2. Відкрийте `index.html` через HTTPS.
3. На iPhone: Safari → Поділитися → На початковий екран.

## Що є

- IndexedDB для записів і вкладень.
- AES-GCM 256-bit через Web Crypto API.
- PBKDF2 для ключа з PIN.
- PIN мінімум 6 цифр.
- Автоблокування.
- Експорт/імпорт `.vault`.
- Фото, відео, аудіо, голосові нотатки, документи.
- Offline cache через service worker.
- Заготовка для Firebase/Supabase у `modules/sync.js`.

## Важливо

Face ID у вебі напряму не дає ключ шифрування. Для повноцінного Passkey потрібна серверна challenge-логіка або окрема інтеграція з бекендом.
