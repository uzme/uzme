# Profile Activity System

Profil activity systemi uchta public signalni bir joyga yig‘adi: current engineering holati, haftalik shipping tarixi va muhim qarorlar.

| Hujjat | Nima uchun | Yangilanishi |
|---|---|---|
| [Engineering Dashboard](../profile/engineering-dashboard.md) | Public flagship repository’lardagi so‘nggi mazmunli workflow, ochiq PR va Dependabot update PR holati. | Har kuni avtomatik. |
| [Weekly Build Log](../profile/weekly-build-log.md) | Oxirgi yetti kundagi public merge va release dalillari. | Har dushanba 08:45 UTC hamda qo‘lda ishga tushirilganda. |
| [Build Notes](./BUILD_NOTES.md) | Muhim product va engineering qarorlarining contexti hamda trade-offlari. | Kerak bo‘lganda qo‘lda. |
| [Profile Reliability Actions](./PROFILE_RELIABILITY_ACTIONS.md) | Link reliability, workflow attention va monthly delivery history. | Jadval bo‘yicha va qo‘lda. |

## Telefon orqali ko‘rish

GitHub profilingizdagi `Building in public` bo‘limidan kerakli hujjatga bosing. Tezkor holat uchun avval Engineering Dashboard’ni, haftalik rivojlanish uchun Weekly Build Log’ni o‘qing. Qizil yoki `ATTENTION` holat chiqsa, jadvaldagi workflow linkini bosing va birinchi qizil stepni ko‘ring.

## Weekly Build Log’ni qo‘lda yangilash

`uzme/uzme` repository’ni oching, `Actions`ga kiring, **Weekly Build Log** workflowini tanlang va `Run workflow`ni bosing. Workflow faqat public flagship repository’larning GitHub API signalini o‘qiydi va faqat log o‘zgarsa generated Markdown fayllarini commit qiladi.

## Build Note qo‘shish

`docs/BUILD_NOTES.md` faylini telefondan `Edit` qilib, tepada berilgan template asosida yangi sana bilan yozuv qo‘shing. Qaror uchun context, decision, evidence va trade-off yoziladi. Secret, token, private endpoint yoki shaxsiy ma’lumot kiritilmaydi.

> Engineering Dashboard va Weekly Build Log avtomatik yaratiladi. Ularni qo‘lda tahrirlash o‘rniga manba repository’dagi real merge, release yoki workflow holatini tuzatish kerak.

Reliability reportlarining aniq jadvali va `ATTENTION` holatiga javob berish tartibi uchun [Profile Reliability Actions](./PROFILE_RELIABILITY_ACTIONS.md) yo‘riqnomasini oching.
