# Profile Reliability & History Actions

Bu qo‘shimcha Actions profil activity systemidagi dalillarni ishonchli va o‘qilishi oson saqlaydi. Ular public Markdown linklari va public flagship GitHub signalini o‘qiydi; private loyiha ma’lumoti, token yoki secret ishlatilmaydi.

| Action | Qachon ishlaydi | Qayerga qarash kerak |
|---|---|---|
| **Profile Link Health** | Juma 07:30 UTC, README/docs/profile pull requestlarida va qo‘lda | [`profile/link-health-report.md`](../profile/link-health-report.md) |
| **Workflow Health Rollup** | Har kuni 07:20 UTC va qo‘lda | [`profile/workflow-health-rollup.md`](../profile/workflow-health-rollup.md) |
| **Monthly Engineering Snapshot** | Har oyning 1-kuni 08:10 UTC va qo‘lda | [`profile/monthly-engineering-snapshot.md`](../profile/monthly-engineering-snapshot.md) |

## Telefon orqali tezkor qaror

`ATTENTION` ko‘rinsa, avval reportdagi linkni bosing. Link Health’da noto‘g‘ri URLni manba Markdown faylida tuzating. Workflow Rollup’da qizil workflow URLini oching va birinchi qizil stepni tekshiring. Monthly Snapshot esa xato signal emas, bir oylik public delivery dalilidir.

## Qo‘lda ishga tushirish

`uzme/uzme → Actions`da action nomini tanlang va `Run workflow`ni bosing. Link Health pull requestda `404` yoki `410` kabi confirmed unavailable havola topsa qizil bo‘lishi kutiladi; scheduled/manual run esa reportni avval saqlaydi, keyin confirmed unhealthy link bo‘lsa failure qaytaradi. External URLlar cached, sakkiztadan parallel va besh soniyalik limit bilan tekshiriladi. Instagram kabi rate-limit, login-wall yoki vaqtinchalik network javoblari `UNVERIFIED` deb qayd etiladi va qayta tekshiruv kutadi.

> Generated `profile/` reportlarini qo‘lda tahrirlamang. Muammoni source Markdown yoki flaghship repository workflowida tuzating, keyin Action yangi real signalni yozadi.

> Generated report workflowlari turli vaqtlarda ishlashi uchun schedule offsetlari qo‘llanadi. Qo‘lda bir paytda bir nechta report ishga tushirilsa, har commit qadamidagi uch martalik rebase/retry `main` branch push race’ini bartaraf etadi; runlar cancel qilinmaydi.
