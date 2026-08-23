# Build Notes

Build Notes — bu mahsulot yoki engineering qarorlarining qisqa, isbotli jurnali. U release notes o‘rnini bosmaydi: release notes **nima** ship qilinganini, Build Notes esa **nega va qanday** qaror qabul qilinganini tushuntiradi.

> Secret, token, private endpoint, foydalanuvchi ma’lumoti yoki private loyiha ichki tafsilotlarini bu hujjatga yozmang.

## Yozish formati

Har muhim qarorda sana, context, qaror, dalil va trade-off qayd etiladi. Kichik texnik o‘zgarishlar emas, kelajakdagi ishlash usulini o‘zgartiradigan qarorlar yoziladi.

```md
## YYYY-MM-DD — Qaror nomi

**Context:** Qanday muammo yoki imkoniyat bor edi?

**Decision:** Nima tanlandi?

**Evidence:** Qaysi test, release, issue, workflow yoki dokument bunga dalil?

**Trade-off:** Nimadan ongli ravishda voz kechildi?
```

## 2026-08-23 — Public signalga tayangan profil activity system

**Context:** Profilni faol va professional ko‘rsatish kerak edi, lekin soxta statistics, fake contribution yoki private project tafsilotlarini ishlatmaslik shart.

**Decision:** Mavjud GitHub Actions automationi bilan public flagship repository’lardan Weekly Build Log va Engineering Dashboard yaratish, muhim qarorlarni shu hujjatda saqlash tanlandi.

**Evidence:** Public Portfolio, BioLab va Developer Portfolio workflowlari; [Developer Roadmap](https://github.com/users/uzme/projects/1); profil repository’dagi generated Markdown fayllari.

**Trade-off:** Alohida interaktiv dashboard va qo‘shimcha hosting ishlatilmadi. Buning evaziga profil soddaroq, arzonroq va GitHub ichida boshqariladigan bo‘lib qoladi.
