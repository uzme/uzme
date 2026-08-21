# Tashqi Bildirishnomalar

Profil repository’sidagi notification workflow Telegram xabarlarini faqat repository secretlari sozlangandan keyin yuboradi. Token yoki chat ID README, code, issue yoki workflow loglariga yozilmaydi.

## Telefon orqali sozlash

GitHub mobil brauzerida `uzme/uzme` repository’sini oching. So‘ng **Settings → Secrets and variables → Actions → New repository secret** yo‘liga o‘ting. `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` nomlari bilan ikkita secret yarating. Qiymatlarni Telegram botingizdan olasiz; ularni chatga yubormang.

Secretlar qo‘shilgandan keyin **Actions → Send External Notification → Run workflow** orqali test xabari jo‘natish mumkin. Haftalik Automation Report esa har dushanba avtomatik qisqa status yuboradi.

> Xavfsizlik qoidasi: bot tokenini hech qachon code, README, screenshot, issue yoki commit xabariga qo‘shmang. Token tasodifan oshkor bo‘lsa, Telegram BotFather orqali darhol yangisini yarating.
